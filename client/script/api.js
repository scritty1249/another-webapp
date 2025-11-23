import { API_ENDPOINT } from "./endpoint.js";

function buildURL (path, params = {}, cookieJar = {}) {
    let url = API_ENDPOINT;
    url += "?path=" + path.replace("\\", ".");
    if (cookieJar)
        Object.entries(cookieJar).forEach(([key, value]) => {
            url += `&cookie-${key}=${value}`;
        });
    if (params)
        Object.entries(params).forEach(([key, value]) => {
            url += `&${key}=${value}`;
        });
    
}

function sendRequest (path, params = {}, method = "GET", body = {}, cookieJar = {}) {
    const url = buildURL(path, params, cookieJar);
    const data = { method: method.toUpperCase() };
    if (body) {
        // [!] Google Apps Script does not expose the request body for GET requests. Use POST if sending a request body!
        data.headers = { "Content-Type": "application/json" };
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
                    `[API] | Server returned error ${data.error.code} ${data.error?.detail ? ": "+ data.error.detail : ""}`
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
    return sendRequest("/game/load", {}, "GET", {}, {session: sessionToken})
        .then(data => data?.token.expires);
}