import * as API from "./api.js";

async function hash (input) { // crypto module should be available in all modern (2021+) browsers. Just assume funcitonality ATP
    const textBuf = new TextEncoder().encode(input);
    const hashBuf = await window.crypto.subtle.digest("SHA-256", textBuf);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    const hash = hashArr
        .map((item) => item.toString(16).padStart(2, "0"))
        .join("");
    return hash;
}

function throwFalse (value, message="") {
    if (!value)
        throw new Error(message);
    else
        return value;
}

function setSession (tokenObj) {
    CookieJar.bake("session", tokenObj.token, tokenObj.expires);
    return tokenObj.token; // for chaining
}

export function login (username, password) {
    Logger.info(`[Session] | Logging into account "${username}"`);
    return hash(password)
        .then(passhash =>
            API.login(username, passhash))
        .then(tokenObj =>
            setSession(throwFalse(tokenObj)))
        .catch(err => false);
}

export function newlogin (username, password, gamedata, bankdata) {
    Logger.info(`[Session] | Creating new account "${username}"`);
    return hash(password)
        .then(passhash =>
            API.createAccount(username, passhash))
        .then(tokenObj =>
            setSession(throwFalse(tokenObj)))
        .then(sessionToken =>
            API.saveGame(sessionToken, gamedata.background, gamedata.layout, bankdata.cash, bankdata.crypto))
        .catch(err => false);
}

export function getsave () {
    if (!CookieJar.has("session")) {
        Logger.error("[Session] | Cannot load game data: No session token found!");
        return Promise.resolve(undefined);
    }
    const sessionToken = CookieJar.get("session");
    return API.getOwnBase(sessionToken).then(data => {
        if (data) {
            const { game, bank } = data; // [!] currency data not implemented yet
            return {
                background: game.backdrop,
                layout: JSON.parse(game.layout),
            }
        }
    });
}