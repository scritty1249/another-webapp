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
        if (conn && conn.lock)
            conn.close();
        runInterval();
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
        if (conn && conn.lock)
            conn.close();
        runInterval();
    }
}
