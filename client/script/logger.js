const getCircularReplacer = () => {
    const seen = new WeakSet();
    return function (key, value) {
        if (typeof value === "object" && value !== null) {
            if (Array.isArray(value) && value.length > 10 && value.every(e => typeof e === "number"))
                return "<number array>"; // I don't think I'll ever need to these this and it takes up a ton of space in the output...
            if (seen.has(value))
                return "<cyclical reference>"; // override value instead of just discarding key
            seen.add(value);
        } else if (typeof value === "number" && !isNaN(value) && value % 1 !== 0)
            return value.toFixed(2); // restrict decimal place for sanity
        return value;
    };
};

export function LogManager() {
    const self = this;
    this._history = [];
    this.filter = function (...types) {
        const filter = types ? types.map((type) => type.toUpperCase()) : [];
        return filter.includes("ALL")
            ? self.history
            : self._history
                  .filter((entry) => filter.some((f) => entry.startsWith(f)))
                  .join("\n");
    };
    Object.defineProperty(self, "history", {
        get: function () {
            return self._history.join("\n");
        },
    });
    this._argsToString = function (args) {
        return args
            .map((arg) =>
                typeof arg === "string" || arg instanceof String
                    ? arg
                    : JSON.stringify(arg, getCircularReplacer())
            )
            .join("\n\t");
    };
    this.log = function (...args) {
        console.log(...args);
        self._history.push(
            `LOG [${new Date().toISOString()}] ` + this._argsToString(args)
        );
    };
    this.warn = function (...args) {
        console.log(...args);
        self._history.push(
            `WARN [${new Date().toISOString()}] ` + this._argsToString(args)
        );
    };
    this.error = function (...args) {
        console.log(...args);
        self._history.push(
            `ERROR [${new Date().toISOString()}] ` + this._argsToString(args)
        );
    };
    this.info = function (...args) {
        console.log(...args);
        self._history.push(
            `INFO [${new Date().toISOString()}] ` + this._argsToString(args)
        );
    };
    this.debug = function (...args) {
        console.log(...args);
        self._history.push(
            `DEBUG [${new Date().toISOString()}] ` + this._argsToString(args)
        );
    };
    this.throw = function (error) {
        self._history.push(
            `THROWN [${new Date().toISOString()}] ` + error.toString()
        );
        throw error;
    };
    return this;
}
