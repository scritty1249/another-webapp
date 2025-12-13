// main.gs - Google Apps Script file

const MAX_COOKIE_DAYS = 400; // Chrome limit
const DB_CONN_TIMEOUT = 60000; // ms
const TABLES = {
    users: "Account",
    userinfo: "AccountInfo",
    gamedata: "Game",
    tokens: "LiveTokens",
    instances: "InstanceTokens",
    attacklogs: "AttackHistory",
};
const REFRESH_HANDLER = "refreshServer";
const LAST_REFRESH_KEY = "lastRefresh";
const REFRESH_INTERVAL_S = 900; // 15 minutes
const REFRESH_DELAY_S = 5;

function atob(b64str) {
    const bytes = Utilities.base64Decode(b64str);
    return Utilities.newBlob(bytes).getDataAsString("UTF-8");
}
function btoa(str) {
    return Utilities.base64Encode(str);
}

function tryCreateTrigger(functionName, executeDelayMs = 1000) {
    const triggers = ScriptApp.getProjectTriggers();

    for (let i = 0; i < triggers.length; i++)
        if (
            triggers[i].getHandlerFunction() === functionName &&
            triggers[i].getEventType() === ScriptApp.EventType.CLOCK
        )
            return false;

    ScriptApp.newTrigger(functionName)
        .timeBased()
        .after(executeDelayMs)
        .create();
    return true;
}

function deleteTrigger(functionName) {
    var triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
        if (
            triggers[i].getHandlerFunction() == functionName &&
            triggers[i].getEventType() === ScriptApp.EventType.CLOCK
        ) {
            ScriptApp.deleteTrigger(triggers[i]);
            return true;
        }
    }
    return false;
}

function runInterval() {
    const scriptProps = PropertiesService.getScriptProperties();
    const lastRefresh = scriptProps.getProperty(LAST_REFRESH_KEY);
    const nowUtc = Server.getNowUTCSeconds();
    if (
        lastRefresh &&
        nowUtc < parseInt(lastRefresh) + REFRESH_INTERVAL_S + REFRESH_DELAY_S
    )
        return;
    scriptProps.setProperty(
        LAST_REFRESH_KEY,
        (nowUtc + REFRESH_INTERVAL_S + REFRESH_DELAY_S).toString()
    );
    tryCreateTrigger(REFRESH_HANDLER, REFRESH_DELAY_S * 1000);
}

function refreshServer() {
    // run this at regular intervals, or just during active periods
    try {
        const conn = new DatabaseConnection(SSID, DB_CONN_TIMEOUT);
        Server.clearLoginTokens(conn);
        conn.commit();
    } catch (err) {
        console.error(err);
    } finally {
        deleteTrigger(REFRESH_HANDLER);
    }
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
            else {
                const userid = Server.getUserId(conn, username);
                return Server.createResponse({
                    token: Server.createToken(conn, userid),
                    id: userid,
                });
            }
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
                ...conn.lookupEntry(TABLES.gamedata, token.id)
            );
            return Server.createResponse({
                game: {
                    backdrop: gamedata.backdrop,
                    layout: gamedata.layout,
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
                payload?.game.hasOwnProperty("layout")
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
    getDefenseHistory: function (conn, params, cookies) {
        if (
            cookies.session &&
            Server.verifyRefreshToken(conn, cookies.session)
        ) {
            const token = Server.getToken(conn, cookies.session);
            const markAsProcessed = params?.process?.[0];
            const history = Server.getDefenseHistory(
                conn,
                token.id,
                markAsProcessed
            );
            return Server.createResponse({ history: history });
        }
        return Server.createErrorResponse(
            0,
            "Invalid or expired session token"
        );
    },
    finishAttack: function (conn, params, payload, cookies) {
        if (
            cookies.session &&
            Server.verifyRefreshToken(conn, cookies.session)
        ) {
            if (!payload?.result)
                return Server.createErrorResponse(
                    0,
                    "Invalid request: Missing attack result in payload"
                );
            const attackData = JSON.parse(payload.result);
            if (
                !(
                    attackData.hasOwnProperty("timestamp") &&
                    attackData.hasOwnProperty("username") &&
                    attackData.hasOwnProperty("processed") &&
                    attackData.hasOwnProperty("losses") &&
                    attackData.hasOwnProperty("id")
                )
            )
                return Server.createErrorResponse(
                    0,
                    "Invalid request: Malformed attack result data"
                );
            const targetid = params?.id?.[0];
            if (!targetid)
                return Server.createErrorResponse(
                    0,
                    "Invalid request: Missing target id in parameters"
                );
            return Server.pushDefenseHistory(conn, targetid, attackData);
        }
        return Server.createErrorResponse(
            0,
            "Invalid or expired session token"
        );
    },
    updateLocation: function (conn, cookies, geo) {
        if (
            cookies.session &&
            Server.verifyRefreshToken(conn, cookies.session)
        ) {
            if (!geo)
                return Server.createErrorResponse(
                    0,
                    "Invalid request: Malformed geodata"
                );
            const token = Server.getToken(conn, cookies.session);
            Server.updateUserLocation(conn, token.id, geo);
            return Server.createSuccessResponse();
        }
        return Server.createErrorResponse(
            0,
            "Invalid or expired session token"
        );
    },
};

// Backend compute
const Server = {
    createNewUser: function (conn, username, password, rawGeoData) {
        const passhash = this.hash(password);
        const userid = this.hash(btoa(username));
        conn.insertEntry(TABLES.users, userid, username, passhash, rawGeoData);
        conn.insertEntry(TABLES.gamedata, userid);
        conn.insertEntry(TABLES.attacklogs, userid, "[]", "[]");
        return this.createResponse({ token: this.createToken(conn, userid) });
    },
    updateGameData: function (conn, userid, gamedata) {
        conn._selectTable(TABLES.gamedata);
        const backdrop = gamedata.game.backdrop;
        const layout = JSON.stringify(gamedata.game.layout);
        conn.updateEntry(TABLES.gamedata, userid, backdrop, layout);
    },
    updateUserLocation: function (conn, userid, rawGeoData) {
        const geoDataColumn = 4; // not zero indexed
        conn.updateEntryAt(TABLES.users, userid, geoDataColumn, rawGeoData);
    },
    getUserId: function (conn, username) {
        conn._selectTable(TABLES.users);
        const row = conn._findRow(username, 2);
        return conn._getEntryAt(row)?.[0];
    },
    checkPassword: function (conn, username, password) {
        const userid = this.getUserId(conn, username);
        return (
            this.entryToJson(...conn.lookupEntry(TABLES.users, userid))
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
            layout: conn._getColumnAt(3, gameBlankRow),
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
                        layout: gamedata.layout[i],
                    },
                });
        });
        return data;
    },
    getDefenseHistory: function (conn, userid, markProcessed = true) {
        // [!] also marks all returned attacks as processed. Avoid needs an extra interaction with client (runs off unsafe assumption client WILL process the entries)
        const defenseColumn = 2; // NOT zero-indexed; because google is gay
        const historyStr = conn.lookupEntryAt(
            TABLES.attacklogs,
            userid,
            defenseColumn
        );
        if (!historyStr) return [];
        if (markProcessed) {
            const history = JSON.parse(historyStr); // mark all entries
            history.forEach((result) => (result.processed = true));
            conn.updateEntryAt(
                TABLES.attacklogs,
                userid,
                defenseColumn,
                JSON.stringify(history)
            );
        }
        return JSON.parse(historyStr);
    },
    pushDefenseHistory: function (conn, targetid, newDefenseEntry) {
        const defenseColumn = 2; // NOT zero-indexed; because google is gay
        const historyStr = conn.lookupEntryAt(
            TABLES.attacklogs,
            targetid,
            defenseColumn
        );
        if (!historyStr)
            return this.createErrorResponse(
                1,
                "Failed to record attack in target history: target history does not exist"
            );
        const history = JSON.parse(historyStr);
        history.push(newDefenseEntry);
        conn.updateEntryAt(
            TABLES.attacklogs,
            targetid,
            defenseColumn,
            JSON.stringify(history)
        );
        return this.createSuccessResponse();
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
        const exp =
            expires <= 0
                ? this.maxExpirationUTC()
                : this.getNowUTCSeconds() + expires;
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
        return this.entryToJson(...conn.lookupEntry(table, token));
    },
    tokenExpired: function (conn, tokenData, instance = false) {
        // [!] also deletes expired tokens. So we clear old ones only when we care about them!
        const table = instance ? TABLES.instances : TABLES.tokens;
        const result = tokenData.expires <= this.getNowUTCSeconds();
        if (result) conn.deleteEntry(table, tokenData.token);
        return result;
    },
    clearLoginTokens: function (conn) {
        // collect ids
        conn._selectTable(TABLES.users);
        const _ubr = conn._findBlankRow() - 2;
        const validIds = new Set(conn._getColumnAt(1, _ubr));
        // collect rows
        conn._selectTable(TABLES.tokens);
        const rowCount = conn.activeTable.getMaxRows();
        const range = conn.activeTable.getRange(2, 1, rowCount - 1, 3);
        const rangeValues = range.getValues();
        // collect valid tokens
        const newRows = [];
        const nowUtc = this.getNowUTCSeconds();
        const sessions = {};
        const ids = new Set(rangeValues.map((r) => r[1])).intersection(
            validIds
        );
        ids.forEach(
            (id) =>
                (sessions[id] = rangeValues
                    .filter((r) => r[1] == id)
                    .map((r) => [r[0], r[1], parseInt(r[2])]))
        );
        Object.values(sessions).forEach((rows) => {
            // wipe out all duplicates, keep the newest one
            const winner = rows
                .filter((r) => r[2] > nowUtc)
                .sort((a, b) => b[2] - a[2])?.[0];
            if (winner) newRows.push(winner);
        });
        // wipe all rows, add back the valid ones
        range.clearContent();
        if (newRows.length)
            conn.activeTable
                .getRange(2, 1, newRows.length, 3)
                .setValues(newRows);
    },
    // utils
    _matchValue: function (conn, userid, tableName, key, value) {
        return (
            this.entryToJson(...conn.lookupEntry(tableName, userid))?.[key] ==
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
        return Math.floor(new Date().getTime() / 1000);
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
        throw new Error(
            `[DatabaseConnection] | Timed out waiting for connection thread lock after ${
                this.connTimeout / 1000
            } seconds.`
        );
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
DatabaseConnection.prototype.lookupEntry = function (tableName, id) {
    this._selectTable(tableName);
    const entry = this._getEntry(id);
    const headers = this._getHeaders();
    return [headers, entry];
};
DatabaseConnection.prototype.lookupEntryAt = function (
    tableName,
    id,
    columnNum
) {
    this._selectTable(tableName);
    return this.activeTable.getRange(this._findRow(id), columnNum).getValue();
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
DatabaseConnection.prototype.updateEntryAt = function (
    tableName,
    id,
    columnNum,
    value
) {
    this._selectTable(tableName);
    this.activeTable.getRange(this._findRow(id), columnNum).setValue(value);
};
DatabaseConnection.prototype.deleteEntry = function (tableName, id) {
    this._selectTable(tableName);
    this.activeTable.deleteRow(this._findRow(id));
};
