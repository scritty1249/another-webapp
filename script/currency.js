export function Currency (type, amount) {
    const currency = function () {
        return currency.type === undefined || !currency.amount ? undefined : currency.toJSON();
    };
    currency.toJSON = function () {
        return {
            type: currency.type,
            amount: currency.amount,
        };
    };
    currency.toString = function () {
        return currency()
            ? currency.amount > 1 && CURRENCY_KEY[currency.type]?.pluralname
                ? `${currency.amount} ${CURRENCY_KEY[currency.type]?.pluralname}`
                : `${currency.amount} ${CURRENCY_KEY[currency.type]?.name}`
            : "None";
    };
    currency.isCurrency = true;
    currency.type = type;
    currency.amount = Math.floor(amount); // only deal with integers
    return currency;
};

export function Cost (...currencies) {
    const cost = function () {
        return cost.isFree ? undefined : cost.toJSON();
    };
    cost.toJSON = function () {
        return cost.total;
    };
    cost.toString = function () {
        return cost() ? cost.currencies.filter((c) => c()).map((c) => c.toString()).join(", ") : "None";
    };
    cost.forEach = function (callbackFn) {
        cost.currencies
            .filter((c) => c())
            .forEach((c, i) => callbackFn(c, i));
    };
    cost.canAfford = function (other) {
        const self = cost.total;
        if (other.isCost) {
            return Object.entries(other.total).every(([type, amount]) => {
                return self[type] !== undefined && self[type] - amount > 0;
            });
        } else if (other.isCurrency) {
            return self[other.type] !== undefined && self[other.type] - other.amount > 0;
        }
        return false; // not a Cost or Currency object
    };
    cost.deduct = function (other) {
        const self = cost.total;
        if (other.isCost) {
            Object.entries(other.total).forEach(([type, amount]) => {
                if (!self[type])
                    cost.currencies.push(Currency(type, -amount));
                else
                    cost.currencies.filter((c) => c.type == type)[0].amount -= amount;
            });
        } else if (other.isCurrency) {
            if (!self[other.type])
                cost.currencies.push(Currency(other.type, -other.amount));
            else
                cost.currencies.filter((c) => c.type == other.type)[0].amount -= other.amount;
        }
        return cost; // for chaining
    };
    cost.fromObj = function (obj) { // appends
        Object.entries(obj).forEach(([type, amount]) => {
            cost.currencies.push(Currency(type, amount));
        });
        return cost; // for chaining
    };
    cost.multiplyScalar = function (scalar) {
        cost.currencies.forEach((c) => c.amount *= scalar);
    };
    Object.defineProperty(cost, "isFree", {
        get: function () {
            return cost.currencies.every((c) => c() === undefined);
        }
    });
    Object.defineProperty(cost, "total", {
        get: function () {
            const total = {};
            cost.currencies
                .filter((c) => c())
                .forEach((c) => {
                    if (!total[c?.type])
                        total[c?.type] = c?.amount;
                    else if (c?.amount)
                        total[c.type] += c.amount;
                });
            return total;
        }
    });
    cost.currencies = [];
    if (currencies.every((c) => c?.isCurrency))
        cost.currencies = currencies;
    else if (currencies.every((c, i) =>
        c === undefined ||
        i % 2 === 0
            ? typeof c === "string"
            : Number.isFinite(c)
    ))
        for (let i = 0; i < currencies.length; i += 2)
            cost.currencies.push( Currency(currencies[i], currencies[i+1]) );

    cost.isCost = true;
    return cost;
}

const CURRENCY_KEY = {
    cash: {
        id: "cash",
        name: "Cash"
    },
    crypto: {
        id: "crypto",
        name: "Credit",
        pluralname: "Credits"
    },
};