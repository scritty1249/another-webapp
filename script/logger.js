const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return "<cyclical reference removed>"; // override value instead of just discarding key
            }
            seen.add(value);
        }
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
            `THROWN [${new Date().toISOString()}] ` + this._argsToString(args)
        );
        throw error;
    };
    return this;
}
