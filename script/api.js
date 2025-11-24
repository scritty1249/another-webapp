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

function sendRequest (path, params = {}, method = "GET", body = undefined, cookieJar = undefined) {
    const url = buildURL(path, params, cookieJar);
    const data = {
        method: method.toUpperCase(),
        redirect: "follow",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        }
    };
    if (body) {
        // [!] Google Apps Script does not expose the request body for GET requests. Use POST if sending a request body!
        data.body = JSON.stringify(body);
    }
    Logger.debug(`[API] | ${method.toUpperCase()} Request to "${path}"`);
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
}

export function login (username, password) {
    return sendRequest("/api/login", {login: btoa(username + ":" + password)})
        .then(data => data?.token);
}

export function createAccount (username, password) {
    return sendRequest("/api/newlogin", {}, "POST", {username: username, password: password})
        .then(data => data?.token);
}

export function getOwnBase (sessionToken) {
    return sendRequest("/game/load", {}, "GET", {}, {session: sessionToken})
        .then(data => data);
}

export function refreshSession (sessionToken) {
    return sendRequest("/api/refresh", {}, "GET", {}, {session: sessionToken})
        .then(data => data?.token.expires);
}

export function saveGame (sessionToken, backdrop, layout, ...currency) {
    return sendRequest("/game/save", {}, "POST", {
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