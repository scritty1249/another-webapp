// main.gs - Google Apps Script file

const MAX_COOKIE_DAYS = 400; // Chrome limit
const DB_CONN_TIMEOUT = 10000; // ms
const TABLES = {
    users: "Account",
    userinfo: "AccountInfo",
    gamedata: "Game",
    tokens: "LiveTokens",
    instances: "InstanceTokens",
};

function atob(b64str) {
    const bytes = Utilities.base64Decode(b64str);
    return Utilities.newBlob(bytes).getDataAsString("UTF-8");
}
function btoa(str) {
    return Utilities.base64Encode(str);
}

function processCookies(e) {
    // since we don't get real cookies...
    const params = e.parameter;
    const cookies = Object.keys(e.parameter).filter((key) =>
        key.startsWith("cookie-")
    );
    const cookieJar = {};
    cookies.forEach((cookie) => {
        // "cookie-".length == 7
        cookieJar[cookie.slice(7)] = params[cookie];
    });
    return cookieJar;
}

// API handlers
const Handlers = {
    _debug: function (e) {
        return Server.createResponse({ ...e, cookies: processCookies(e) });
    },
    newUser: function (conn, username, password, geo) {
        if (Server.userExists(conn, username)) {
            console.error("Error while processing new user request");
            console.info(`Account with username "${username}" already exists`);
            return Server.createErrorResponse(0, "Account already exists");
        } else {
            return Server.createNewUser(conn, username, password, geo);
        }
    },
    login: function (conn, params) {
        const loginData = params.login;
        try {
            const [username, password] = atob(loginData?.[0]).split(":", 2);
            if (!Server.userExists(conn, username))
                return Server.createErrorResponse(
                    1,
                    `Username "${username}" does not exist`
                );
            else if (!Server.checkPassword(conn, username, password))
                return Server.createErrorResponse(1, "Wrong password entered");
            else
                return Server.createResponse({
                    token: Server.createToken(
                        conn,
                        Server.getUserId(conn, username)
                    ),
                });
        } catch {
            console.error("Error while processing login request");
            console.info("Dump:", params);
            return Server.createErrorResponse(0, "Failed to login");
        }
    },
    getTargets: function (conn, params, cookies) {
        const limit = Number(params.limit[0]);
        if (!limit)
            return Server.createErrorResponse(1, `Invalid limit ${limit}`);
        if (
            cookies.session &&
            Server.verifyRefreshToken(conn, cookies.session)
        ) {
            const token = Server.getToken(conn, cookies.session);
            const targets = Server.getTargets(conn, token.id, limit);
            return Server.createResponse({
                targets: targets,
            });
        }
        return Server.createErrorResponse(
            0,
            "Invalid or expired session token"
        );
    },
    loadGameData: function (conn, cookies) {
        if (
            cookies.session &&
            Server.verifyRefreshToken(conn, cookies.session)
        ) {
            const token = Server.getToken(conn, cookies.session);
            const gamedata = Server.entryToJson(
                ...conn.lookupEntry(token.id, TABLES.gamedata)
            );
            return Server.createResponse({
                game: {
                    backdrop: gamedata.backdrop,
                    layout: gamedata.layout,
                },
                bank: {
                    cash: gamedata.cash,
                    crypto: gamedata.crypto,
                },
            });
        }
        return Server.createErrorResponse(
            0,
            "Invalid or expired session token"
        );
    },
    saveGameData: function (conn, payload, cookies) {
        if (
            cookies.session &&
            Server.verifyRefreshToken(conn, cookies.session)
        ) {
            const token = Server.getToken(conn, cookies.session);
            if (
                payload?.game &&
                payload?.game.hasOwnProperty("backdrop") &&
                payload?.game.hasOwnProperty("layout") &&
                payload?.bank &&
                payload?.bank.hasOwnProperty("cash") &&
                payload?.bank.hasOwnProperty("crypto")
            ) {
                Server.updateGameData(conn, token.id, payload); // [!] may be unsafe, verify and revise later
                return Server.createSuccessResponse();
            }
            return Server.createErrorResponse(
                1,
                "Invalid gamedata payload:\n" + JSON.stringify(payload)
            );
        }
        return Server.createErrorResponse(
            0,
            "Invalid or expired session token"
        );
    },
    refreshSession: function (conn, cookies) {
        return cookies.session &&
            Server.verifyRefreshToken(conn, cookies.session)
            ? Server.createResponse(Server.getToken(conn, cookies.session))
            : Server.createErrorResponse(0, "Invalid or expired session token");
    },
};

// Backend compute
const Server = {
    createNewUser: function (conn, username, password, rawGeoData) {
        const passhash = this.hash(password);
        const userid = this.hash(btoa(username));
        conn.insertEntry(TABLES.users, userid, username, passhash, rawGeoData);
        conn.insertEntry(TABLES.gamedata, userid);
        return this.createResponse({ token: this.createToken(conn, userid) });
    },
    updateGameData: function (conn, userid, gamedata) {
        conn._selectTable(TABLES.gamedata);
        const backdrop = gamedata.game.backdrop;
        const layout = JSON.stringify(gamedata.game.layout);
        const cash = gamedata.bank.cash;
        const crypto = gamedata.bank.crypto;
        conn.updateEntry(
            TABLES.gamedata,
            userid,
            backdrop,
            layout,
            cash,
            crypto
        );
    },
    getUserId: function (conn, username) {
        conn._selectTable(TABLES.users);
        const row = conn._findRow(username, 2);
        return conn._getEntryAt(row)?.[0];
    },
    checkPassword: function (conn, username, password) {
        const userid = this.getUserId(conn, username);
        return (
            this.entryToJson(...conn.lookupEntry(userid, TABLES.users))
                ?.password == this.hash(password)
        );
    },
    getTargets: function (conn, userid, limit) {
        conn._selectTable(TABLES.users);
        const ids = conn._getColumnAt(1, limit);
        const geos = conn._getColumnAt(4, limit);
        const names = conn._getColumnAt(2, limit);
        const blankRow = conn._findBlankRow() - 2;
        conn._selectTable(TABLES.gamedata);
        const gameBlankRow = conn._findBlankRow() - 2;
        const gamedata = {
            id: conn._getColumnAt(1, gameBlankRow),
            backdrop: conn._getColumnAt(2, gameBlankRow),
            layout: conn._getColumnAt(3, gameBlankRow)
        };
        if (blankRow && ids.length > blankRow) {
            ids.splice(blankRow);
            geos.splice(blankRow);
            names.splice(blankRow);
        }
        const removeRow = ids.indexOf(userid);
        if (removeRow != -1) {
            ids.splice(removeRow, 1);
            geos.splice(removeRow, 1);
            names.splice(removeRow, 1);
        }
        const data = [];
        ids.forEach((userid, idx) => {
            const i = gamedata.id.indexOf(userid);
            if (i != -1)
                data.push({
                    id: userid,
                    username: names[idx],
                    geo: geos[idx],
                    game: {
                        backdrop: gamedata.backdrop[i],
                        layout: gamedata.layout[i]
                    }
                });
        });
        return data;
    },
    // token management
    verifyRefreshToken: function (conn, token, instance = false) {
        if (this.tokenExists(conn, token, instance)) {
            const tokenData = this.getToken(conn, token, instance);
            if (!this.tokenExpired(conn, tokenData, instance)) {
                this.refreshToken(conn, token, instance);
                return true;
            }
        }
        return false;
    },
    createToken: function (conn, userid, expires = 0, instance = false) {
        const table = instance ? TABLES.instances : TABLES.tokens;
        const exp = expires <= 0 ? this.maxExpirationUTC() : this.getNowUTCSeconds() + expires;
        const token = this.token();
        conn.insertEntry(table, token, userid, exp);
        return {
            token: token,
            expires: exp,
        };
    },
    refreshToken: function (conn, token, instance = false) {
        const table = instance ? TABLES.instances : TABLES.tokens;
        const tokenData = this.getToken(conn, token);
        if (!this.tokenExpired(conn, tokenData)) {
            const { token: t, id } = tokenData;
            const expires = this.maxExpirationUTC();
            conn.updateEntry(table, t, id, expires);
            return true;
        }
        return false;
    },
    tokenExists: function (conn, token, instance = false) {
        const table = instance ? TABLES.instances : TABLES.tokens;
        conn._selectTable(table);
        return conn._findRow(token) != -1;
    },
    getToken: function (conn, token, instance = false) {
        const table = instance ? TABLES.instances : TABLES.tokens;
        return this.entryToJson(...conn.lookupEntry(token, table));
    },
    tokenExpired: function (conn, tokenData, instance = false) {
        // [!] also deletes expired tokens. So we clear old ones only when we care about them!
        const table = instance ? TABLES.instances : TABLES.tokens;
        const result = tokenData.expires <= this.getNowUTCSeconds();
        if (result) conn.deleteEntry(table, tokenData.token);
        return result;
    },
    // utils
    _matchValue: function (conn, userid, tableName, key, value) {
        return (
            this.entryToJson(...conn.lookupEntry(userid, tableName))?.[key] ==
            value
        );
    },
    createResponse: function (jsonObj) {
        const jsonStr = JSON.stringify(jsonObj);
        return ContentService.createTextOutput(jsonStr).setMimeType(
            ContentService.MimeType.JSON
        );
    },
    createErrorResponse: function (code, message) {
        const response = { code: code };
        if (message) response.detail = message;
        return this.createResponse({ error: response });
    },
    createSuccessResponse: function () {
        return this.createResponse({ success: true });
    },
    maxExpirationUTC: function () {
        // returns in seconds
        const now = new Date();
        now.setDate(now.getDate() + MAX_COOKIE_DAYS);
        return Math.floor(now.getTime() / 1000);
    },
    getNowUTCSeconds: function () {
        return new Date().getUTCSeconds();
    },
    token: function () {
        // time based, since that's how it'll be used
        return (
            Date.now().toString(36).substring(2) +
            Math.random().toString(36).substring(2)
        );
    },
    hash: function (text) {
        // only works in Google Apps Script- can't port to normal JS
        const bytes = Utilities.computeDigest(
            Utilities.DigestAlgorithm.SHA_256,
            text
        );
        const hexstr = bytes
            .map((byte) => ("0" + (byte & 0xff).toString(16)).slice(-2))
            .join("");
        return hexstr;
    },
    entryToJson: function (headers, row) {
        const jsonObj = {};
        headers.forEach((header, idx) => (jsonObj[header] = row[idx]));
        return jsonObj;
    },
    userExists: function (conn, username) {
        conn._selectTable(TABLES.users);
        return conn._findRow(username, 2) != -1;
    },
};

// Backend query info
function DatabaseConnection(spreadsheetid, connectionTimeout = 10000) {
    this.database = SpreadsheetApp.openById(spreadsheetid);
    this.connTimeout = connectionTimeout;
}
DatabaseConnection.prototype = {
    connTimeout: 0,
    lock: undefined,
    database: undefined,
    activeTable: undefined,
};
DatabaseConnection.prototype.open = function () {
    this.lock = LockService.getScriptLock();
    if (!this.lock.tryLock(this.connTimeout))
        throw new Error(`[DatabaseConnection] | Timed out waiting for connection thread lock after ${this.connTimeout / 1000} seconds.`);
};
DatabaseConnection.prototype.commit = function () {
    SpreadsheetApp.flush();
};
DatabaseConnection.prototype.close = function () {
    this.lock.releaseLock();
};
DatabaseConnection.prototype._findRow = function (value, columnIdx = 1) {
    const idx = this.activeTable
        .getRange(2, columnIdx, this.activeTable.getLastRow())
        .getValues()
        .map((row) => row[0])
        .indexOf(value);
    return idx === -1 ? idx : idx + 2; // 1 offset for header row, another offset becase GayAppsScript doesn't zero-index their spreadsheets
};
DatabaseConnection.prototype._findBlankRow = function () {
    const idx = this.activeTable
        .getRange(2, 1, this.activeTable.getLastRow())
        .getValues()
        .filter((c) => c).length;
    return idx === -1 ? idx : idx + 1; // need to get the next row
};
DatabaseConnection.prototype._getEntryAt = function (idx) {
    return this.activeTable
        .getRange(idx, 1, 1, this.activeTable.getLastColumn())
        .getValues()?.[0];
};
DatabaseConnection.prototype._getColumnAt = function (idx, limit) {
    return this.activeTable
        .getRange(2, idx, limit)
        .getValues()
        ?.map((row) => row[0]);
};
DatabaseConnection.prototype._getEntry = function (id) {
    const entryIdx = this._findRow(id);
    return entryIdx != -1 ? this._getEntryAt(entryIdx) : undefined;
};
DatabaseConnection.prototype._getHeaders = function () {
    return this.activeTable
        .getRange(1, 1, 1, this.activeTable.getLastColumn())
        .getValues()?.[0];
};
DatabaseConnection.prototype._selectTable = function (tableName) {
    this.activeTable = this.database.getSheetByName(tableName);
};
DatabaseConnection.prototype.lookupEntry = function (id, tableName) {
    this._selectTable(tableName);
    const entry = this._getEntry(id);
    const headers = this._getHeaders();
    return [headers, entry];
};
DatabaseConnection.prototype.insertEntry = function (tableName, ...columns) {
    this._selectTable(tableName);
    this.activeTable
        .getRange(this._findBlankRow(), 1, 1, columns.length)
        .setValues([columns]);
};
DatabaseConnection.prototype.updateEntry = function (
    tableName,
    id,
    ...columns
) {
    this._selectTable(tableName);
    this.activeTable
        .getRange(this._findRow(id), 2, 1, columns.length)
        .setValues([columns]);
};
DatabaseConnection.prototype.deleteEntry = function (tableName, id) {
    this._selectTable(tableName);
    this.activeTable.deleteRow(this._findRow(id));
};

// Executed automatically upon webapp GET request
function doGet(e) {
    let conn;
    try {
        const params = e.parameters;
        const cookies = processCookies(e);
        const path = params.path?.[0];
        let response;
        conn = new DatabaseConnection(SSID, DB_CONN_TIMEOUT);
        conn.open();
        switch (path) {
            case ".api.debug":
                response = Handlers._debug(e);
                break;
            case ".api.login":
                response = Handlers.login(conn, params);
                break;
            case ".game.load":
                response = Handlers.loadGameData(conn, cookies);
                break;
            case ".api.refresh":
                response = Handlers.refreshSession(conn, cookies);
                break;
            case ".attack.select":
                response = Handlers.getTargets(conn, params, cookies);
                break;
            default:
                response = Server.createErrorResponse(
                    2,
                    "Unknown GET endpoint"
                );
        }
        conn.commit();
        return response;
    } catch (err) {
        console.error(err);
        return Server.createErrorResponse(
            4,
            err.message +
                "\nDump:\n" +
                JSON.stringify(e) +
                "\nTrace:\n" +
                err.stack
        );
    } finally {
        if (conn)
            conn.close();
    }
}

// Executed automatically upon webapp POST request
function doPost(e) {
    let conn;
    try {
        const params = e.parameters;
        const cookies = processCookies(e);
        const path = params.path?.[0];
        const payload = JSON.parse(e.postData.contents);
        let response;
        conn = new DatabaseConnection(SSID, DB_CONN_TIMEOUT);
        conn.open();
        switch (path) {
            case ".api.debug":
                response = Handlers._debug(e);
                break;
            case ".api.newlogin":
                response = Handlers.newUser(
                    conn,
                    payload.username,
                    payload.password,
                    payload.geo
                );
                break;
            case ".attack.result":
                response = Server.createSuccessResponse();
                break;
            case ".game.save":
                response = Handlers.saveGameData(conn, payload, cookies);
                break;
            default:
                response = Server.createErrorResponse(
                    2,
                    "Unknown POST endpoint"
                );
        }
        conn.commit();
        return response;
    } catch (err) {
        console.error(err);
        return Server.createErrorResponse(
            4,
            err.message +
                "\nDump:\n" +
                JSON.stringify(e) +
                "\nTrace:\n" +
                err.stack
        );
    } finally {
        if (conn)
            conn.close();
    }
}
