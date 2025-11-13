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
            .map(arg =>
                typeof arg === "string" || arg instanceof String
                    ? arg
                    : arg.isObject3D && arg.type !== "Line2"
                    ? arg.toJSON()
                    : JSON.stringify(arg, getCircularReplacer(), "\t")
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
        console.warn(...args);
        self._history.push(
            `WARN [${new Date().toISOString()}] ` + this._argsToString(args)
        );
    };
    this.error = function (...args) {
        console.error(...args);
        const message = this._argsToString(args);
        self._history.push(
            `ERROR [${new Date().toISOString()}] ` + message
        );
        return new Error(message);
    };
    this.info = function (...args) {
        console.info(...args);
        self._history.push(
            `INFO [${new Date().toISOString()}] ` + this._argsToString(args)
        );
    };
    this.debug = function (...args) {
        console.debug(...args);
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
    this.alert = function (message) {
        self._history.push(
            `ALERTED [${new Date().toISOString()}] ` + message
        );
        console.warn(message);
        alert(message);
    }

    this.eventDomElement = document.createElement("div");
    this.eventDomElement.style.display = "none";
    this._triggers = {};
    this.eventDomElement.addEventListener("debug_trigger", function (event) {
        const id = event.detail?.id;
        if (Object.keys(self._triggers).includes(id)) {
            self._triggers[id].callback?.();
            if (self._triggers[id].once)
                delete self._triggers[id];
        } else {
            self.warn(`[LogManager] | Missed debug trigger: ID ${id}`);
        }
        event.preventDefault();
    });
    this.trigger = function (eventid = Date.now().toString()) {
        self.eventDomElement.dispatchEvent(new CustomEvent("debug_trigger", {
            bubbles: false,
            cancelable: true,
            detail: {id: eventid}
        }));
    };
    this.when = function (eventid, callback = () => {}, once = false) {
        self._triggers[eventid] = {
            callback: callback,
            once: once
        }
    }
    return this;
}
