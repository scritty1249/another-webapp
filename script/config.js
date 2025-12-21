import { Vector3, Color } from "three";

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
        ECONOMY: [
            {name: "Cash farm", id: "cashfarm"},
            {name: "Credit farm", id: "cryptofarm"},
            {name: "Cash storage", id: "cashstore"},
            {name: "Credits storage", id: "cryptostore"}
        ],
        DEFENSE: [
            {name: "Sentinal", id: "cube"},
            {name: "Scanner", id: "scanner"},
            {name: undefined, id: undefined},
            {name: undefined, id: undefined}
        ],
        BASE: [
            {name: "Placeholder Node", id: "placeholder"},
            {name: "Processing Web", id: "botnet"},
            {name: "Access Port", id: "globe"},
            {name: "Computer Rack", id: "barracks"},
            {name: undefined, id: undefined}
        ],
    },
};