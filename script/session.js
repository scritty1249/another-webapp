import * as API from "./api.js";
import * as UTIL from "./utils.js";

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
        .then(tokenObj => {
            if (!tokenObj)
                Logger.alert(`Wrong username or password!`);
            else
                return setSession(throwFalse(tokenObj));
        })
        .catch(err => false);
}

export function newlogin (username, password, gamedata, bankdata) {
    Logger.info(`[Session] | Creating new account "${username}"`);
    return Promise.all([
            hash(password), UTIL.getLocation()
        ])
        .then(([passhash, location]) =>
            API.createAccount(username, passhash, btoa(JSON.stringify(location))))
        .then(tokenObj => {
            if (!tokenObj)
                Logger.alert(`Failed to create new account. Username ${username} already exists.`);
            else
                return setSession(throwFalse(tokenObj));
        })
        .then(sessionToken =>
            API.saveGameAsync(sessionToken, gamedata.background, gamedata.layout, bankdata.cash, bankdata.crypto))
        .catch(err => false);
}

export function getAttackTargets () {
    if (!CookieJar.has("session")) {
        Logger.error("[Session] | Cannot query attack targets: No session token found!");
        return Promise.resolve(undefined);
    }
    const sessionToken = CookieJar.get("session");
    return API.getAttackTargets(sessionToken).then(data => {
        if (data) {
            return Array.from(data, d => {
                return {
                    geo: d.geo ? JSON.parse(atob(d.geo)) : UTIL.DEFAULT_GEO,
                    id: d.id,
                    username: d.username,
                    game: {
                        background: d?.game.backdrop,
                        layout: d?.game.layout ? JSON.parse(d.game.layout) : undefined
                    }
                };
            });
        }
    });
}

export function getsave () {
    if (!CookieJar.has("session")) {
        Logger.error("[Session] | Cannot load game data: No session token found!");
        return Promise.resolve(undefined);
    }
    const sessionToken = CookieJar.get("session");
    return API.getOwnBase(sessionToken).then(data => {
        if (data) {
            const { game } = data; // [!] currency data not implemented yet
            return {
                game: {
                    background: game.backdrop,
                    layout: JSON.parse(game.layout), // still not sure if i want to store layout data raw or obfuscated, when I decide we'll parse this server-side before sending to client...
                }
            };
        }
    });
}

export function savegame (layoutObj) { // [!] currency data not implemented yet
    if (!CookieJar.has("session")) {
        Logger.error("[Session] | Cannot load game data: No session token found!");
        return Promise.resolve(undefined);
    }
    const sessionToken = CookieJar.get("session");
    return API.saveGameAsync(sessionToken, layoutObj.background, layoutObj.layout);
}