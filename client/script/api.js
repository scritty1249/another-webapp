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
    Logger.debug(`[API] | ${method.toUpperCase()} Request to "${path}"\n\t${url}`);
    try {
        return fetch(url, data)
            .then(resp => {
                if (!resp.ok)
                    Logger.error(`[API] | Response returned error: ${resp.status}`);
                else
                    return resp.json();
            }).then(data => {
                if (data?.error)
                    Logger.error(
                        `[API] | Server returned error ${data.error.code}${data.error?.detail ? ": "+ data.error.detail : ""}`
                    );
                else
                    return data;
            });
    } catch (err) {
        Logger.throw("[API] | Failed to contact server. Error:\n" + err.message);
    }
}

export function login (username, password) {
    return sendRequest("/api/login", {login: btoa(username + ":" + password)})
        .then(data => data?.token);
}

export function createAccount (username, password, location) {
    return sendRequest("/api/newlogin", undefined, "POST", {username: username, password: password, geo: location})
        .then(data => data?.token);
}

export function getAttackTargets (sessionToken) {
    return sendRequest("/attack/select", {limit: 999}, "GET", undefined, {session: sessionToken})
        .then(data => data?.targets);
}

export function getOwnBase (sessionToken) {
    return sendRequest("/game/load", undefined, "GET", undefined, {session: sessionToken})
        .then(data => data);
}

export function refreshSession (sessionToken) {
    return sendRequest("/api/refresh", undefined, "GET", undefined, {session: sessionToken})
        .then(data => data?.token.expires);
}

export function saveGame (sessionToken, backdrop, layout, ...currency) {
    return sendRequest("/game/save", undefined, "POST", {
        game: {
            backdrop: backdrop,
            layout: layout
        },
        bank: {
            cash: currency[0],
            crypto: currency[1]
        }
    }, {session: sessionToken})
        .then(data => Boolean(data?.success));
}

export function saveGameAsync (sessionToken, backdrop, layout, ...currency) {
    return sendRequest("/game/save", undefined, "POST", {
        game: {
            backdrop: backdrop,
            layout: layout
        },
        bank: {
            cash: currency[0],
            crypto: currency[1]
        }
    }, {session: sessionToken}, true)
        .then(data => Boolean(data?.success));
}