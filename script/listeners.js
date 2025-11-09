function Listener (type, listener) {
    const self = this;
    this.type = type;
    this.listener = listener;
    this.remove = function (target) {
        target.removeEventListener(self.type, self.listener);
    }
    return this;
}

function ListenerCollection (target) {
    const self = this;
    this.target = target;
    this.listeners = [];
    this.add = function (type, callback, params = {}) {
        const listener = callback;
        self.target.addEventListener(type, listener, params);
        self.listeners.push(new Listener(type, listener));
        return self; // return self instead of new Listener for chaining
    }
    this.clear = function () {
        self.listeners.forEach(listener => listener.remove(self.target));
        delete self.listeners;
        self.listeners = [];
    }
    return this;
}

export function ListenerManager () {
    const self = this;
    this.targets = [];
    this.listeners = {};
    this._hash = function () {
        return Date.now(); // lol
    }
    this._addTarget = function (targetObj) {
        const hash = self._hash();
        self.targets.push({
            hash: hash,
            object: targetObj
        });
        self.listeners[hash] = new ListenerCollection(targetObj);
        return hash;
    }
    this.getHash = function (targetObj) { // [!] adds the targeted object to hash collection if not already present
        const index = self.targets.findIndex(t => t.object === targetObj);
        return index == -1 ? self._addTarget(targetObj) : self.targets[index].hash;
    }
    this.listener = function (target) { // [!] returns Listener object for chaining
        const hash = self.getHash(target);
        return self.listeners[hash];
    }
    this.clear = function () {
        Object.values(self.listeners).forEach(l => l.clear());
        delete self.listeners;
        delete self.targets;
        self.listeners = {};
        self.targets = [];
    }
    return this;
}
