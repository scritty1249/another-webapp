import { API_ENDPOINT } from "./endpoint.js";

function buildURL (path, params = undefined, cookieJar = undefined) {
    let url = API_ENDPOINT;
    url += "?path=" + path.replaceAll("/", ".");
    if (cookieJar)
        Object.entries(cookieJar).forEach(([key, value]) => {
            url += `&cookie-${key}=${value}`;
        });
    if (params)
        Object.entries(params).forEach(([key, value]) => {
            url += `&${key}=${value}`;
        });
    return url;
}

function sendRequest (path, params = {}, method = "GET", body = undefined, cookieJar = undefined, keepAlive = false) {
    const url = buildURL(path, params, cookieJar);
    const data = {
        method: method.toUpperCase(),
        redirect: "follow",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
    };
    if (keepAlive) {
        // [!] keepalive = true requests are restricted to 64KB of data
        data.keepalive = keepAlive;
    }
    if (body) {
        // [!] Google Apps Script does not expose the request body for GET requests. Use POST if sending a request body!
        data.body = JSON.stringify(body);
    }
    Logger.debug(`[API] | ${method.toUpperCase()} Request to "${path}"\n${url}\n`, DEBUG_MODE ? (params, data) : "");
    try {
        return fetch(url, data)
            .then(resp => {
                if (!resp.ok)
                    Logger.error(`[API] | Response returned error: ${resp.status}`);
                else
                    return resp.json();
            }).then(data => {
                if (data?.error) {
                    Logger.error(
                        `[API] | Server returned error ${data.error.code}${data.error?.detail ? ": "+ data.error.detail : ""}`
                    );
                    if (data.error.code) // Made sure all the server-side error codes are falsey. Go me!
                        Logger.alert(
                            `Internal Server Error. Please contact developer and try again later.`
                        );
                }
                return data;
            });
    } catch (err) {
        Logger.throw("[API] | Failed to contact server. Error:\n" + err.message);
    }
}

export function login (username, password) {
    return sendRequest("/api/login", {login: btoa(username + ":" + password)});
}

export function createAccount (username, password, location) {
    return sendRequest("/api/newlogin", undefined, "POST", {username: username, password: password, geo: location})
}

export function getAttackTargets (sessionToken) {
    return sendRequest("/attack/select", {limit: 999}, "GET", undefined, {session: sessionToken})
}

export function getOwnBase (sessionToken) {
    return sendRequest("/game/load", undefined, "GET", undefined, {session: sessionToken})
}

export function refreshSession (sessionToken) {
    return sendRequest("/api/refresh", undefined, "GET", undefined, {session: sessionToken})
}

export function saveGame (sessionToken, payload) {
    return sendRequest("/game/save", undefined, "POST", payload, {session: sessionToken}, true);
}

export function updateLocation (sessionToken, location) {
    return sendRequest("/game/save", undefined, "POST", {geo: location}, {session: sessionToken}, true)
}

export function getDefenseHistory (sessionToken, markAsProcessed) {
    return sendRequest("/attack/history/defense", {process: markAsProcessed}, "GET", undefined, {session: sessionToken})
}

export function sendAttackResult (sessionToken, targetid, attackResult) {
    return sendRequest("/attack/result", {id: targetid}, "POST", {result: attackResult}, {session: sessionToken}, true)
}