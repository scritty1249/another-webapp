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

function setLoginSession (tokenObj, username = undefined, userid = undefined) {
    CookieJar.bake("session", tokenObj.token, tokenObj.expires);
    if (username) CookieJar.bake("username", username, tokenObj.expires);
    if (userid) CookieJar.bake("userid", userid, tokenObj.expires);
    return tokenObj.token; // for chaining
}

function resetIfExpiredSession (response) {
    if (response.error && response.error.code == 5) {
        Logger.alert("Session expired, please log in again.");
        wipeLastSavedSessionData();
        window.location.reload();
    }
    return response;
}

export function setSessionData (gameData = undefined, barracksData = undefined, purchaseData = undefined, profileData = undefined) {
    if (gameData) {
        Storage.set(
            "localLayout",
            gameData
        );
        Storage.set(
            "lastSavedLayout",
            gameData,
            true
        );
    }
    if (barracksData) {
        Storage.set(
            "localBarracks",
            barracksData
        );
        Storage.set(
            "lastSavedBarracks",
            barracksData,
            true
        );
    }
    if (purchaseData) {
        Storage.set(
            "localPurchases",
            purchaseData
        );
        Storage.set(
            "lastSavedPurchases",
            purchaseData,
            true
        );
    }
    if (profileData) {
        Storage.set(
            "localProfileOptions",
            profileData
        );
        Storage.set(
            "lastSavedProfileOptions",
            profileData,
            true
        );
    }
}

export function wipeLastSavedSessionData() {
    Storage.set(
        "lastSavedLayout",
        undefined,
        true
    );
    Storage.set(
        "lastSavedBarracks",
        undefined,
        true
    );
    Storage.set(
        "lastSavedPurchases",
        undefined,
        true
    );
    Storage.set(
        "lastSavedProfileOptions",
        undefined,
        true
    );
}

export function clearSession () {
    if (CookieJar.has("session")) CookieJar.remove("session");
    if (CookieJar.has("username")) CookieJar.remove("username");
    if (CookieJar.has("userid")) CookieJar.remove("userid");
    Storage.nuke();
}

export function isLoggedIn () {
    return (
        CookieJar.has("session") &&
        CookieJar.get("session")
    );
}

export function login (username, password) {
    Logger.info(`[Session] | Logging into account "${username}"`);
    return hash(password)
        .then(passhash =>
            API.login(username, passhash))
        .then(resp => {
            if (resp.error)
                if (resp.error?.code == 4)
                    Logger.alert(`Failed to login: ${resp.error.detail}`);
            return resp;
        })
        .then(({token, id}) => {
            return setLoginSession(token, username, id);
        })
        .catch(err => {
            Logger.warn(`[Session] | Something went wrong during login.`, err);
            return false;
        });
}

export function newlogin (username, password, gamedata) {
    Logger.info(`[Session] | Creating new account "${username}"`);
    return Promise.all([
            hash(password), UTIL.getLocation()
        ])
        .then(([passhash, location]) =>
            API.createAccount(username, passhash, btoa(JSON.stringify(location))))
        .then((data) => {
            if (data.error) {
                if (data.error.code == 4)
                    Logger.alert(`Failed to create new account. Username ${username} already exists.`);
                return false;
            }
            return data?.token;
        })
        .then(tokenObj => {
            if (!tokenObj)
                Logger.alert(`Failed to create new account. Username ${username} already exists.`);
            else
                return setLoginSession(throwFalse(tokenObj));
        })
        .then(sessionToken =>
            API.saveGame(sessionToken, gamedata.background, gamedata.layout, {}, {}, {}))
        .catch(err => false);
}

export function getAttackTargets () {
    if (!CookieJar.has("session")) {
        Logger.error("[Session] | Cannot query attack targets: No session token found!");
        return Promise.resolve(undefined);
    }
    const sessionToken = CookieJar.get("session");
    return API.getAttackTargets(sessionToken)
        .then(resp => {
            if (resetIfExpiredSession(resp) && resp?.targets) {
                return Array.from(resp.targets, data => {
                    return {
                        geo: data.geo ? JSON.parse(atob(data.geo)) : UTIL.DEFAULT_GEO,
                        id: data.id,
                        username: data.username,
                        game: {
                            background: data?.game.backdrop,
                            layout: data?.game.layout ? JSON.parse(data.game.layout) : undefined
                        }
                    };
                });
            } else {
                Logger.warn(`[Session] | Failed to get attack targets. Got response:`, resp);
            }
        });
}

export function getsave () {
    if (!CookieJar.has("session")) {
        Logger.error("[Session] | Cannot load game data: No session token found!");
        return Promise.resolve(undefined);
    }
    const sessionToken = CookieJar.get("session");
    return API.getOwnBase(sessionToken).then(resp => {
        if (resetIfExpiredSession(resp) && !resp.error) {
            const { game, barracks, purchases, profile } = data;
            return {
                game: {
                    background: game.backdrop,
                    layout: JSON.parse(game.layout),
                },
                barracks: JSON.parse(barracks),
                purchases: JSON.parse(purchases),
                profile: JSON.parse(profile),
            };
        } 
    });
}

export function savegame (layoutObj, barracksData, purchaseData, profileData) {
    if (!CookieJar.has("session")) {
        Logger.error("[Session] | Cannot load game data: No session token found!");
        return Promise.resolve(undefined);
    }
    const sessionToken = CookieJar.get("session");
    const payload = {
        game: {
            backdrop: layoutObj.background,
            layout: layoutObj.layout
        },
        barracks: barracksData,
        purchases: purchaseData,
        profile: profileData
    };
    return API.saveGame(sessionToken, payload)
        .then(resp => Boolean(resetIfExpiredSession(resp)?.success));
}

export function sendAttackResult (targetid, resultObj) {
    if (!CookieJar.has("session")) {
        Logger.error("[Session] | Cannot load game data: No session token found!");
        return Promise.resolve(undefined);
    }
    const sessionToken = CookieJar.get("session");
    return API.sendAttackResult(sessionToken, targetid, JSON.stringify(resultObj))
        .then(resp => Boolean(resetIfExpiredSession(resp)?.success));
}

export function getDefenseHistory (markAsProcessed = true) {
    if (!CookieJar.has("session")) {
        Logger.error("[Session] | Cannot load game data: No session token found!");
        return Promise.resolve(undefined);
    }
    const sessionToken = CookieJar.get("session");
    return API.getDefenseHistory(sessionToken, markAsProcessed)
        .then(resp => resetIfExpiredSession(resp)?.history ? resp.history : []);
}

export function updateLocation (location) {
    if (!CookieJar.has("session")) {
        Logger.error("[Session] | Cannot load game data: No session token found!");
        return Promise.resolve(undefined);
    }
    const sessionToken = CookieJar.get("session");
    return API.updateLocation(sessionToken, btoa(JSON.stringify(location)))
        .then(resp => Boolean(resetIfExpiredSession(resp)?.success));
}