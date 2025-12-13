import { Vector3 } from "three";

export const Configuration = {
    tetherForce: 0.2,
    passiveForce: 0.003, // used for elements gravitating towards y=0
    shapeMinProximity: 5.5,
    shapeMaxProximity: 4,
    mouseClickDurationThreshold: 0.4 * 1000, // ms
    maxStepsFromGlobe: 9, // max number of steps from a Globe each node is allowed to be
    TICKSPEED: 0.1, // seconds
    TARGETS_TTL: 300, // seconds, how long we should store targets for before querying again - 5 minutes
    WORLD_TARGET_COUNT: 5,
    DEFAULT_CAM_POS: new Vector3(0, 5, 10),
    AUTOSAVE_INTERVAL: 150000, // ms, interval for autosaves. Shouldn't overlap with saving when leaving the page
    CURRENCY_THEFT_RATIO: 1 / 2, // how much attackers can make from stealing
    CURRENCY_LOSS_RATIO: 2 / 3, // how much defenders can lose when stolen from
};