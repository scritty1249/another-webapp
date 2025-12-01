export function StorageManager() {
    const self = this;
    const getstore = (persistent) => (persistent) ? localStorage : sessionStorage;
    const now = () => Math.floor(Date.now() / 1000); // UTC seconds
    this._keydata = function (key, value) {
        return [
            key + "_data",
            JSON.stringify({
                type: typeof value,
                updated: now()
            })
        ];
    }
    this.set = function (key, value, persistent = false) {
        const store = getstore(persistent);
        const data = this._keydata(key, value);
        store.setItem(key, 
            data.type == "string"
                ? value
                : JSON.stringify(value)
        );
        store.setItem(...data);
    }
    this.has = function (key, persistent = false) {
        const store = getstore(persistent);
        return (
            store.getItem(key) !== null &&
            store.getItem(key + "_data") !== null
        );
    }
    this.get = function (key, persistent = false) {
        const store = getstore(persistent);
        const keydata = JSON.parse(store.getItem(key + "_data"))
        const keycontent = store.getItem(key);
        return {
            updated: keydata.updated,
            value: keydata.type != "string" ? JSON.parse(keycontent) : keycontent
        };
    }
    this.update = function (key, persistent = false) {
        const store = getstore(persistent);
        const keydata = JSON.parse(store.getItem(key + "_data"))
        store.setItem(key + "_data", JSON.stringify({
            type: keydata.type,
            updated: now()
        }));
    }
    this.updated = function (key, persistent = false) {
        const store = getstore(persistent);
        const keydata = JSON.parse(store.getItem(key + "_data"))
        return keydata?.updated;
    }
    this.remove = function (key, persistent = false) {
        const store = getstore(persistent);
        store.removeItem(key);
        store.removeItem(key + "_data");
    }
    this.clear = function (persistent = false) {
        const store = getstore(persistent);
        store.clear();
    }
    this.nuke = function () {
        this.clear(true);
        this.clear(false);
    }
    return this;
}