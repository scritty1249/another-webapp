import { Vector3, Color } from "three";
import { Cost } from  "./currency.js";

export const Configuration = {
    tetherForce: 0.2,
    passiveForce: 0.003, // used for elements gravitating towards y=0
    shapeMinProximity: 5.5,
    shapeMaxProximity: 4,
    mouseClickDurationThreshold: 0.4 * 1000, // ms
    maxStepsFromGlobe: 9, // max number of steps from a Globe each node is allowed to be
    maxCameraDistance: 25,
    minCameraDistance: 2,
    TICKSPEED: 0.1, // seconds
    TARGETS_TTL: 300, // seconds, how long we should store targets for before querying again - 5 minutes
    WORLD_TARGET_COUNT: 5,
    DEFAULT_CAM_POS: new Vector3(0, 5, 10),
    AUTOSAVE_INTERVAL: 45000, // ms, interval for autosaves. Shouldn't overlap with saving when leaving the page
    CURRENCY_THEFT_RATIO: 1 / 2, // how much attackers can make from stealing
    CURRENCY_LOSS_RATIO: 2 / 3, // how much defenders can lose when stolen from
    CURRENCY_THEFT_TICKSPEED: 5, // how many ticks to wait before stealing 1 currency from captured nodes
    ATTACK_NODE_REGEN_DELAY: 4.5, // seconds
    ATTACK_BASE_SECONDS_LIMIT: 120,
    FRIENDLY_NODE_COLOR: new Color(0xff0000),
    FRIENDLY_NODE_TINT: new Color(0xff0000),
    BLOOM: {
        STRENGTH: .08,
        RADIUS: .2,
        THRESHOLD: 5
    },
    AMBIENT_LIGHT_STRENGTH: 300, // basically, brightness
    NODE_REFUND_RATIO: .4, // how much you get back from selling, including cost of upgrades
    
};

const BASE_REGEN = .1 * Configuration.TICKSPEED; // % max hp applied per tick

Configuration.NODES = {
    // defense nodes
    cube: {
        id: "cube",
        catagory: "def",
        name: "Sentinal",
        data: null, // Node type-specific data, overrided with most recent version when loading from server
        settings: { // Node type-specific info to be evaluated at creation time
            init: function (nodeData) {},
            upgrade: function (nodeData) {},
        },
        unlock: 0, // Core level required to buy
        build: {
            description: "Spreads a combative Antivirus throughout your network during Attacks.",
            highlightSteps: 999999, // when clicked, highlight connections for X steps
            freeCount: 0, // number of these you can get for free (limit still applies)- intended for new players
            connections: {
                base: 5,
                increase: .5, // flat value per Node level, floored when totaled
            },
            limit: {
                base: 2,
                increase: 1, // flat value per Core level, floored when totaled
            },
            buy: Cost ("crypto", 15),
            upgrade: { // upgrade tiers
                1: {
                    level: 0,
                    cost: Cost ("crypto", 15),
                },
                2: {
                    level: 0,
                    cost: Cost ("crypto", 225),
                },
                3: {
                    level: 4,
                    cost: Cost ("crypto", 3375),
                },
                4: {
                    level: 4,
                    cost: Cost ("crypto", 50625),
                },
                5: {
                    level: 5,
                    cost: Cost ("crypto", 759375),
                },
            },
        },
        attack: {
            regen: BASE_REGEN, // percentage of health, applied per tick
            slots: {
                base: 5,
                increase: .5,  // flat value per Node level, floored when totaled
            },
            health: {
                base: 100,
                increase: 20,  // flat value per Node level
            },
        }
    },
    scanner: {
        id: "scanner",
        catagory: "def",
        name: "Scanner",
        data: null,
        settings: {
            init: function (nodeData) {},
            upgrade: function (nodeData) {},
        },
        unlock: 1,
        build: {
            description: "Scans for Attacker activity within 2 steps.",
            highlightSteps: 2,
            freeCount: 0,
            connections: {
                base: 5,
                increase: .5,
            },
            limit: {
                base: 1,
                increase: .5,
            },
            buy: Cost ("crypto", 15),
            upgrade: {
                1: {
                    level: 0,
                    cost: Cost ("crypto", 15),
                },
                2: {
                    level: 0,
                    cost: Cost ("crypto", 225),
                },
                3: {
                    level: 4,
                    cost: Cost ("crypto", 3375),
                },
                4: {
                    level: 4,
                    cost: Cost ("crypto", 50625),
                },
                5: {
                    level: 5,
                    cost: Cost ("crypto", 759375),
                },
            },
        },
        attack: {
            regen: BASE_REGEN,
            slots: {
                base: 4,
                increase: .25,
            },
            health: {
                base: 75,
                increase: 15,
            },
        }
    },
    // base nodes
    placeholder: {
        id: "placeholder",
        catagory: "base",
        name: "<_???>",
        data: null,
        settings: {
            init: function (nodeData) {},
            upgrade: function (nodeData) {},
        },
        unlock: 0,
        build: {
            description: "Placeholder. Doesn't do anything.\nWILL BE REMOVED SOON!",
            highlightSteps: 0,
            freeCount: 0,
            connections: {
                base: 3,
                increase: 0,
            },
            limit: {
                base: 99,
                increase: 0,
            },
            buy: Cost ("cash", 50),
            upgrade: {},
        },
        attack: {
            regen: BASE_REGEN * .5, // these are supposed to be shitter, discourage people from using them
            slots: {
                base: 4,
                increase: 0,
            },
            health: {
                base: 50,
                increase: 0,
            },
        }
    },
    core: {
        id: "core",
        catagory: "base",
        name: "Cloud Core",
        data: {
            logs: undefined,
            download: undefined,
        },
        settings: {
            increase: {
                max: 400
            },
            init: function (nodeData) {
                nodeData.data.logs = {};
                nodeData.data.download = {
                    amount: 600, // overrided with max value in NodeManager
                    max: 600
                };
            },
            upgrade: function (nodeData) {
                nodeData.data.max = Configuration.NODES.core.data.max + (nodeData.level *
                    Configuration.NODES.core.settings.increase.max
                );
            },
        },
        unlock: 0,
        build: {
            description: "\"NTS: Write Core bio.\"\n\nCore veeeeeery important...",
            highlightSteps: 0,
            freeCount: 1,
            connections: {
                base: 7,
                increase: 0,
            },
            limit: {
                base: 1,
                increase: 0,
            },
            buy: undefined,
            upgrade: {
                1: {
                    level: 0,
                    cost: Cost (
                        "crypto", 45,
                        "cash", 22000,
                    ),
                },
                2: {
                    level: 0,
                    cost: Cost (
                        "crypto", 1500,
                        "cash", 30000,
                    ),
                },
                3: {
                    level: 4,
                    cost: Cost (
                        "crypto", 2000,
                        "cash", 35000,
                    ),
                },
                4: {
                    level: 4,
                    cost: Cost (
                        "crypto", 2500,
                        "cash", 40000,
                    ),
                },
                5: {
                    level: 5,
                    cost: Cost (
                        "crypto", 3000,
                        "cash", 45000,
                    ),
                },
            },
        },
        attack: {
            regen: BASE_REGEN,
            slots: {
                base: 7,
                increase: 0,
            },
            health: {
                base: 350,
                increase: 150,
            },
        }
    },
    globe: {
        id: "globe",
        catagory: "base",
        name: "Access Port",
        data: null,
        settings: {
            init: function (nodeData) {},
            upgrade: function (nodeData) {},
        },
        unlock: 0,
        build: {
            description: `Required for your net to exist.\nAll nodes exist within ${Configuration.maxStepsFromGlobe} steps of an Access Port.\nAll attacks start in your net from here.`,
            highlightSteps: Configuration.maxStepsFromGlobe,
            freeCount: 1,
            connections: {
                base: 1,
                increase: 0,
            },
            limit: {
                base: 2,
                increase: .34,
            },
            buy: undefined,
            upgrade: {},
        },
        attack: {
            regen: 0,
            slots: {
                base: 3,
                increase: 0,
            },
            health: {
                base: 0,
                increase: 0,
            },
        }
    },
    botnet: {
        id: "botnet",
        catagory: "base",
        name: "Processing Subnet",
        data: {
            active: undefined,
            queue: undefined,
            max: 8
        },
        settings: {
            _activeSlotProto: {
                started: 0,
                duration: 0,
                type: undefined
            },
            increase: {
                active: 1,
                max: 4,
            },
            init: function (nodeData) {
                nodeData.data.active = {
                    0: Object.create(Configuration.NODES.botnet.settings._activeSlotProto),
                    1: Object.create(Configuration.NODES.botnet.settings._activeSlotProto),
                    2: Object.create(Configuration.NODES.botnet.settings._activeSlotProto),
                }
                nodeData.data.queue = [];
            },
            upgrade: function (nodeData) {
                for (let i = 3; i < nodeData.level + 3; i++) {
                    Array(Configuration.NODES.botnet.settings.increase.active).forEach(() =>
                        nodeData.data.active[`${i}`] = Object.create(Configuration.NODES.botnet.settings._activeSlotProto));
                    nodeData.data.max += Configuration.NODES.botnet.settings.increase.max;
                }
            },
        },
        unlock: 0,
        build: {
            description: "Uses a piggybacked network to compile and upgrade your Attacks.",
            highlightSteps: 0,
            freeCount: 0,
            connections: {
                base: 3,
                increase: .25,
            },
            limit: {
                base: 1,
                increase: .34,
            },
            buy: Cost ("crypto", 1),
            upgrade: {
                1: {
                    level: 0,
                    cost: Cost ("crypto", 100),
                },
                2: {
                    level: 3,
                    cost: Cost ("crypto", 10000),
                },
                3: {
                    level: 5,
                    cost: Cost ("crypto", 100000000),
                },
            },
        },
        attack: {
            regen: BASE_REGEN,
            slots: {
                base: 5,
                increase: .25,
            },
            health: {
                base: 225,
                increase: 50,
            },
        }
    },
    barracks: {
        id: "barracks",
        catagory: "base",
        name: "Program Storage",
        data: {
            max: 20   
        },
        settings: {
            increase: {
                max: 15
            },
            init: function (nodeData) {},
            upgrade: function (nodeData) {
                nodeData.data.max = Configuration.NODES.barracks.data.max + (nodeData.level *
                    Configuration.NODES.barracks.settings.increase.max
                );
            },
        },
        unlock: 0,
        build: {
            description: "Racks of unused computers left at an abondoned warehouse, remotely activated in secret to house your compiled Attacks. Any Attacks stored here are ready to deploy on other networks.",
            highlightSteps: 0,
            freeCount: 1,
            connections: {
                base: 4,
                increase: 0,
            },
            limit: {
                base: 1,
                increase: .75,
            },
            buy: Cost ("crypto", 10),
            upgrade: {
                1: {
                    level: 2,
                    cost: Cost ("crypto", 25),
                },
                2: {
                    level: 4,
                    cost: Cost ("crypto", 625),
                },
                3: {
                    level: 5,
                    cost: Cost ("crypto", 390625),
                },
            },
        },
        attack: {
            regen: BASE_REGEN,
            slots: {
                base: 3,
                increase: 0,
            },
            health: {
                base: 135,
                increase: 50,
            },
        }
    },
    // econ type nodes
    cashfarm: {
        id: "cashfarm",
        catagory: "econ",
        name: "Cash Farm",
        data: {
            type: "cash",
            amount: 0,
            max: 6750,
            rate: 2700, // per hour
            lastUpdated: undefined,   
        },
        settings: {
            increase: {
                max: 1500,
                rate: 1000
            },
            init: function (nodeData) {
                nodeData.data.lastUpdated = Math.floor(Date.now() / 1000);
            },
            upgrade: function (nodeData) {
                nodeData.data.max = Configuration.NODES.cashfarm.data.max + (nodeData.level *
                    Configuration.NODES.cashfarm.settings.increase.max
                );
                nodeData.data.rate = Configuration.NODES.cashfarm.data.rate + (nodeData.level *
                    Configuration.NODES.cashfarm.settings.increase.rate
                );
            },
        },
        unlock: 0,
        build: {
            description: "Farms for Cash. Can be collected from to spend for purchases.",
            highlightSteps: 0,
            freeCount: 1,
            connections: {
                base: 3,
                increase: .34,
            },
            limit: {
                base: 1,
                increase: 1,
            },
            buy: Cost ("crypto", 5),
            upgrade: {
                1: {
                    level: 0,
                    cost: Cost ("crypto", 25),
                },
                2: {
                    level: 1,
                    cost: Cost ("crypto", 50),
                },
                3: {
                    level: 2,
                    cost: Cost ("crypto", 100),
                },
                4: {
                    level: 4,
                    cost: Cost ("crypto", 200),
                },
                5: {
                    level: 5,
                    cost: Cost ("crypto", 400),
                },
            },
        },
        attack: {
            regen: BASE_REGEN,
            slots: {
                base: 2,
                increase: .34,
            },
            health: {
                base: 75,
                increase: 15,
            },
        }
    },
    cryptofarm: {
        id: "cryptofarm",
        catagory: "econ",
        name: "Credits Farm",
        data: {
            type: "crypto",
            amount: 0,
            max: 350,
            rate: 100, // per hour
            lastUpdated: undefined,   
        },
        settings: {
            increase: {
                max: 75,
                rate: 45
            },
            init: function (nodeData) {
                nodeData.data.lastUpdated = Math.floor(Date.now() / 1000);
            },
            upgrade: function (nodeData) {
                nodeData.data.max = Configuration.NODES.cryptofarm.data.max + (nodeData.level *
                    Configuration.NODES.cryptofarm.settings.increase.max
                );
                nodeData.data.rate = Configuration.NODES.cryptofarm.data.rate + (nodeData.level *
                    Configuration.NODES.cryptofarm.settings.increase.rate
                );
            },
        },
        unlock: 0,
        build: {
            description: "Farms for Credits. Can be collected from to spend for network upgrades.",
            highlightSteps: 0,
            freeCount: 0,
            connections: {
                base: 3,
                increase: .34,
            },
            limit: {
                base: 1,
                increase: 1,
            },
            buy: Cost ("cash", 100),
            upgrade: {
                1: {
                    level: 0,
                    cost: Cost ("cash", 250),
                },
                2: {
                    level: 1,
                    cost: Cost ("cash", 500),
                },
                3: {
                    level: 2,
                    cost: Cost ("cash", 1000),
                },
                4: {
                    level: 4,
                    cost: Cost ("cash", 2000),
                },
                5: {
                    level: 5,
                    cost: Cost ("cash", 4000),
                },
            },
        },
        attack: {
            regen: BASE_REGEN,
            slots: {
                base: 2,
                increase: .34,
            },
            health: {
                base: 75,
                increase: 15,
            },
        }
    },
    cashstore: {
        id: "cashstore",
        catagory: "econ",
        name: "Cash Store",
        data: {
            type: "cash",
            amount: 0,
            max: 10000,
        },
        settings: {
            increase: {
                max: 2500
            },
            init: function (nodeData) {},
            upgrade: function (nodeData) {
                nodeData.data.max = Configuration.NODES.cashstore.data.max + (nodeData.level *
                    Configuration.NODES.cashstore.settings.increase.max
                );
            },
        },
        unlock: 0,
        build: {
            description: "Stores collected Cash. Vulnerable to theft by others.",
            highlightSteps: 0,
            freeCount: 1,
            connections: {
                base: 3,
                increase: .34,
            },
            limit: {
                base: 2,
                increase: 1,
            },
            buy: Cost ("crypto", 10),
            upgrade: {
                1: {
                    level: 0,
                    cost: Cost ("crypto", 35),
                },
                2: {
                    level: 1,
                    cost: Cost ("crypto", 70),
                },
                3: {
                    level: 2,
                    cost: Cost ("crypto", 140),
                },
                4: {
                    level: 4,
                    cost: Cost ("crypto", 280),
                },
                5: {
                    level: 5,
                    cost: Cost ("crypto", 560),
                },
            },
        },
        attack: {
            regen: BASE_REGEN,
            slots: {
                base: 3,
                increase: .34,
            },
            health: {
                base: 125,
                increase: 20,
            },
        }
    },
    cryptostore: {
        id: "cryptostore",
        catagory: "econ",
        name: "Credits Storage",
        data: {
            type: "crypto",
            amount: 0,
            max: 600,
        },
        settings: {
            increase: {
                max: 150
            },
            init: function (nodeData) {},
            upgrade: function (nodeData) {
                nodeData.data.max = Configuration.NODES.cryptostore.data.max + (nodeData.level *
                    Configuration.NODES.cryptostore.settings.increase.max
                );
            },
        },
        unlock: 0,
        build: {
            description: "Stores collected Credits. Vulnerable to theft by others.",
            highlightSteps: 0,
            freeCount: 1,
            connections: {
                base: 3,
                increase: .34,
            },
            limit: {
                base: 2,
                increase: 1,
            },
            buy: Cost ("cash", 110),
            upgrade: {
                1: {
                    level: 0,
                    cost: Cost ("cash", 350)
                },
                2: {
                    level: 1,
                    cost: Cost ("cash", 700)
                },
                3: {
                    level: 2,
                    cost: Cost ("cash", 1400)
                },
                4: {
                    level: 4,
                    cost: Cost ("cash", 2800)
                },
                5: {
                    level: 5,
                    cost: Cost ("cash", 5600)
                },
            },
        },
        attack: {
            regen: BASE_REGEN,
            slots: {
                base: 3,
                increase: .34,
            },
            health: {
                base: 125,
                increase: 20,
            },
        }
    },
};

const DEFAULT_BACKGROUND = "cubes-lines";
export const Default = {
    BG: DEFAULT_BACKGROUND,
    LAYOUT: {
        background: DEFAULT_BACKGROUND,
        layout: {
            neighbors: [],
            nodes: [{ uuid: "0", type: "core", position: [0, 0, 0], _data: {level: 0} }],
        },
    },
    GEO: {
        // lol
        lat: 63.5888,
        long: 154.4931,
    },
    DEDUCTIONS: {
        currency: {
            cash: 0,
            crypto: 0
        },
        attackers: []
    },
    MATERIAL_PROP_OVERRIDES: {
        "override.emissiveIntensity": "emissiveIntensity"
    },
    WALLPAPER_TYPES: [
        // laziness
        "bubbles",
        "bubbles-lines",
        "cubes",
        "cubes-lines",
        "lines",
        "bubbles-dark",
        "bubbles-lines-dark",
        "cubes-dark",
        "cubes-lines-dark",
        "lines-dark",
    ],
    NODE_TYPES: {
        ECON: [],
        DEF: [],
        BASE: [],
    },
};

function Currency(type, amount) {
    return {
        type: type,
        amount: amount
    };
}

Object.values(Configuration.NODES).forEach(({id, name, catagory}) =>
    id != "core" ? Default.NODE_TYPES[catagory.toUpperCase()].push({id: id, name: name}) : null
);