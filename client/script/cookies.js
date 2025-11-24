const cookieAgeSecondsLimit = 34560000; // chrome limit is 400 days
export function CookieJar () { // we use the lame name here so we can call it "cookie jar" everywhere else
    const self = this;
    this._getMaxSeconds = function (utcSecondsAge) {
        return Math.max(0, utcSecondsAge - (new Date()).getUTCSeconds());
    }
    this.has = function (name) {
        const cookies = document.cookie;
        return cookies.indexOf(name + "=") !== -1;
    }
    this.bake = function (name, value, expiresInSeconds) {
        try {
            document.cookie = `${name}=${value}; path=/; max-age=${this._getMaxSeconds(expiresInSeconds)}`;
        } catch (err) {
            // Chromium based browsers don't allow local pages to set cookies.
            Logger.warn(`[CookieJar] | Failed to set cookie "${name}". Are you using a chromium browser?`);
        }
    }
    this.get = function (name) {
        const crumbs = `; ${document.cookie}`.split(`; ${name}=`);
        if (crumbs.length === 2)
            return crumbs.pop().split(";").shift();
    }
    this.remove = function (name) {
        document.cookie = `${name}=; expires=Fri, 31 Dec 2025 23:59:59 GMT; path=/";`
    }
    return this;
}