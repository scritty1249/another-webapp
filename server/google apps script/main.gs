// main.gs - Google Apps Script file

const MAX_COOKIE_DAYS = 400; // Chrome limit
const TABLES = {
    users: "Account",
    userinfo: "AccountInfo",
    gamedata: "Game",
    tokens: "LiveTokens"
};



function processCookies(e) { // since we don't get real cookies...
    const params = e.parameters;
    const cookies = Object.keys(e.parameter).filter(key => key.startsWith("cookie-"));
    const cookieJar = {};
    cookies.forEach(cookie => {
        // "cookie-".length == 7
        cookieJar[cookie.slice(7)] = params[cookie];
    });
    return cookieJar;
}

// API handlers
const Handlers = {
    _debug: function (e) {
      return Server.createResponse(e);
    },
    newUser: function (conn, username, password) {
        if (Server.userExists(conn, username)) {
            console.error("Error while processing new user request");
            console.info(`Account with username "${username}" already exists`);
            return Server.createErrorResponse(0, "Account already exists");
        } else {
            return Server.createNewUser(conn, username, password);
        }
    },
    login: function (conn, params) {
        const loginData = params.login;
        try {
            const [username, password] = Utilities.base64Dencode(loginData[0]).split(":", 2);
            const passhash = Server.hash(password);
            if (!Server.userExists(conn, username))
                return Server.createErrorResponse(1, "Username does not exist");
            else if (!Server.checkPassword(conn, username, password))
                return Server.createErrorResponse(1, "Wrong password entered");
            else
                return Server.createResponse({
                    token: Server.createToken(conn, Server.getUserId(conn, username))
                });
        } catch {
            console.error("Error while processing login request");
            console.info("Dump:", params);
            return Server.createErrorResponse(0, "Failed to login");
        }
    },
    loadGameData: function (conn, cookies) {
        if (
            cookies.session &&
            Server.verifyRefreshToken(conn, cookies.session)
        ) {
            const token = Server.getToken(conn, cookies.session);
            const gamedata = conn.lookupEntry(TABLES.gamedata, token.id);
            return Server.createResponse({
                game: {
                    backdrop: gamedata.backdrop,
                    layout: gamedata.layout
                },
                bank: {
                    cash: gamedata.cash,
                    crypto: gamedata.crypto
                }
            });
        }
        return Server.createErrorResponse(0, "Invalid or expired session token");
    },
    refreshSession: function (conn, cookies) {
        return (
            cookies.session
            && Server.verifyRefreshToken(conn, cookies.session)
        )
        ? Server.createResponse(Server.getToken(conn, cookies.session))
        : Server.createErrorResponse(0, "Invalid or expired session token");
    }
}

// Backend compute
const Server = {
    createNewUser: function (conn, username, password) {
        const passhash = this.hash(password);
        const userid = this.hash(Utilities.base64Encode(username));
        conn.insertEntry(TABLES.users,
            userid,
            username,
            passhash
        );
        conn.insertEntry(TABLES.gamedata,
            userid
        );
        return this.createResponse(this.createToken(conn, userid));
    },
    updateGameData: function (conn, userid, gamedata) {
        conn._selectTable(TABLES.gamedata);
        const columns = conn._getHeaders();
        const backdrop = gamedata.game.backdrop;
        const layout = gamedata.game.layout;
        const cash = gamedata.bank.cash;
        const crypto = gamedata.bank.crypto;
        conn.updateEntry(TABLES.gamedata,
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
        return this.entryToJson(conn.lookupEntry(userid, TABLES.users))?.password == this.hash(password);
    },
    // token management
    verifyRefreshToken: function (conn, token) {
        if (this.tokenExists(conn, token)) {
            const tokenData = this.getToken(conn, token);
            if (!this.tokenExpired(conn, tokenData)) {
                this.refreshToken(conn, token);
                return true;
            }
        }
        return false;
    },
    createToken: function (conn, userid, expires = 0) {
        const exp = (expires <= 0) ? this.maxExpirationUTC() : expires;
        const token = this.token();
        conn.insertEntry(TABLES.tokens,
            token,
            userid,
            exp
        );
        return {
            token: token,
            expires: exp
        };
    },
    refreshToken: function (conn, token) {
        const tokenData = this.getToken(conn, token);
        if (!this.tokenExpired(conn, tokenData)) {
            const { t: token, id } = tokenData;
            const expires = this.maxExpirationUTC();
            conn.updateEntry(TABLES.token, t, id, expires);
            return true;
        }
        return false;
    },
    tokenExists: function (conn, token) {
        conn._selectTable(TABLES.tokens);
        return conn._findRow(token) != -1;
    },
    getToken: function (conn, token) {
        return this.entryToJson(...conn.lookupEntry(token, TABLES.tokens));
    },
    tokenExpired: function (conn, tokenData) { // [!] also deletes expired tokens. So we clear old ones only when we care about them!
        const result = tokenData.expires <= this.getNowUTCSeconds();
        if (result)
            conn.deleteEntry(TABLES.tokens, tokenData.token);
        return result;
    },
    // utils
    _matchValue: function (conn, userid, tableName, key, value) {
        return this.entryToJson(...conn.lookupEntry(userid, tableName))?.[key] == value;
    },
    createResponse: function (jsonObj) {
        const jsonStr = JSON.stringify(jsonObj);
        return ContentService.createTextOutput(jsonStr).setMimeType(ContentService.MimeType.JSON);
    },
    createErrorResponse: function (code, message) {
        const response = { code: code };
        if (message)
            response.detail = message;
        return this.createResponse({ error: response });
    },
    createSuccessResponse: function () {
        return this.createResponse({ success: true });
    },
    maxExpirationUTC: function () { // returns in seconds
        const now  = new Date();
        now.setDate(now.getDate() + MAX_COOKIE_DAYS)
        return Math.floor(now.getTime() / 1000);
    },
    getNowUTCSeconds: function () {
        return (new Date()).getUTCSeconds();
    },
    token: function () { // time based, since that's how it'll be used
        return Date.now().toString(36).substring(2) + Math.random().toString(36).substring(2);
    },
    hash: function (text) { // only works in Google Apps Script- can't port to normal JS
        const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
        const hexstr = bytes.map(byte => ("0" + (byte & 0xFF).toString(16)).slice(-2)).join(""); 
        return hexstr;
    },
    entryToJson: function (headers, row) {
        const jsonObj = {};
        headers.forEach((header, idx) => {
            jsonObj[header] =
                typeof row[idx] === "undefined" ? undefined : row[0][idx];
        });
        return jsonObj;
    },
    userExists: function (conn, username) {
        conn._selectTable(TABLES.users);
        return conn._findRow(username, 2) != -1;
    }
}

// Backend query info
function DatabaseConnection (spreadsheetid) {
    this.database = SpreadsheetApp.openById(spreadsheetid);
}
DatabaseConnection.prototype = {
    database: undefined,
    activeTable: undefined,
};
DatabaseConnection.prototype._findRow = function (value, columnIdx = 1) {
    return this.activeTable
        .getRange(2, columnIdx, this.activeTable.getLastRow())
        .getValues()
        .indexOf(value);
}
DatabaseConnection.prototype._findBlankRow = function () {
    return this.activeTable
        .getRange(2, 1, this.activeTable.getLastRow())
        .getValues()
        .filter(c=>c)
        .length + 1;
}
DatabaseConnection.prototype._getEntryAt = function (idx) {
    return this.activeTable.getRange(idx, 1, 1, this.activeTable.getLastColumn())?.[0];
}
DatabaseConnection.prototype._getEntry = function (id) {
    const entryIdx = this._findRow(id);
    return entryIdx != -1
        ? this._getEntryAt(entryIdx).slice(1)
        : undefined;
}
DatabaseConnection.prototype._getHeaders = function () {
    return this.activeTable.getRange(1, 1, 1, this.activeTable.getLastColumn())?.[0];
}
DatabaseConnection.prototype._selectTable = function (tableName) {
    this.activeTable = this.database.getSheetByName(tableName);
}
DatabaseConnection.prototype.lookupEntry = function (id, tableName) {
    this._selectTable(tableName);
    const entry = this._getEntry(id);
    const headers = this._getHeaders();
    return [headers, entry];
}
DatabaseConnection.prototype.insertEntry = function (tableName, ...columns) {
    this._selectTable(tableName);
    this.activeTable.getRange(this._findBlankRow(), 1, 1, columns.length).setValues([columns]);
}
DatabaseConnection.prototype.updateEntry = function (tableName, id, ...columns) {
    this._selectTable(tableName);
    this.activeTable.getRange(this._findRow(id), 2, 1, columns.length).setValues([columns]);
}
DatabaseConnection.prototype.deleteEntry = function (tableName, id) {
    this._selectTable(tableName);
    this.activeTable.deleteRow(this._findRow(id));
}

// Executed automatically upon webapp GET request
function doGet(e) {
    try {
        const params = e.parameters;
        const cookies = processCookies(e);
        const path = params.path?.[0];
        let response;
        const conn = new DatabaseConnection(SSID);
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
            case ".attack.start":
                response = Server.createSuccessResponse();
                break;
            case ".api.refresh":
                response = Handlers.refreshSession(conn, cookies);
            default:
                response = Server.createErrorResponse(2, "Unknown GET endpoint");
        };
        return response;
    } catch (err) {
        console.error(err);
        return Server.createErrorResponse(4, err.message + "\n" + JSON.stringify(e));
    }
}

// Executed automatically upon webapp POST request
function doPost(e) {
    try {
        const params = e.parameters;
        const cookies = processCookies(e);
        const path = params.path?.[0];
        const payload = (e.postData.type == "application/json") ? JSON.parse(e.postData.contents) : {content: e.postData.contents} ;
        let response;
        const conn = new DatabaseConnection(SSID);
        switch (path) {
            case ".api.debug":
                response = Handlers._debug(e);
                break;
            case ".api.newlogin":
                response = Handlers.newUser(conn, payload.username, payload.password);
                break;
            case ".attack.result":
                response = Server.createSuccessResponse();
                break;
            case ".game.save":
                response = Server.createSuccessResponse();
                break;
            default:
                response = Server.createErrorResponse(2, "Unknown POST endpoint");
        };
        return response;
    } catch (err) {
        console.error(err);
        return Server.createErrorResponse(4, err.message + "\n" + JSON.stringify(e));
    }
}
