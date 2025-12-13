import { AttackManagerFactory } from "./mesh.js";
import { AttackLogic } from "./attacker.js";
import { Vector2, Vector3, PlaneGeometry }  from "three";
import { SSMaterialType, SSFramesMesh } from "./spritesheet.js";

const _currencyOverlayData = {
    // avoid reinitializing where possible
    offset: new Vector3(0, 3, 0),
    geometry: new PlaneGeometry(0.9, 0.3),
    alphaMap: "./source/node-overlay/currency/currency-bar-mask.png",
    mapSize: new Vector2(300, 100),
    alphaMapSize: new Vector2(600, 100),
};

export const DataStore = {
    AttackerData: {
        attacks: [
            {
                type: "particle",
                amount: 99,
            },
            {
                type: "pascualcannon",
                amount: 99,
            },
            {
                type: "laser",
                amount: 99,
            },
        ],
    },
    AttackTypeData: function (camera) {
        return {
            particle: {
                mesh: AttackManagerFactory.Particle,
                damage: 8,
                cooldown: 650, // ms
                logic: AttackLogic.ParticleLogicFactory, // don't need to instantite logic controllers for "dumb" attackers- they're stateless!
                effect: (nodeManager, attackid) => {},
                canAdd: (nodeData) => {
                    return (
                        nodeData.isFriendly &&
                        !nodeData.attackers.some((a) => a.type == "pascualcannon")
                    );
                },
            },
            laser: {
                mesh: AttackManagerFactory.Laser,
                damage: 5,
                cooldown: 0, // ms
                logic: AttackLogic.ParticleLogicFactory, // don't need to instantite logic controllers for "dumb" attackers- they're stateless!
                effect: (nodeManager, attackid) => {},
                canAdd: (nodeData) => {
                    return (
                        nodeData.isFriendly &&
                        !nodeData.attackers.some((a) => a.type == "pascualcannon")
                    );
                },
            },
            pascualcannon: {
                mesh: (a) => AttackManagerFactory.PascualCannon(camera, a),
                damage: 10,
                cooldown: 1000, // ms
                logic: AttackLogic.BasicLogicFactory,
                effect: (nodeManager, attackid) => {
                    const _purp = 0x341539;
                    const attack = nodeManager.getAttack(attackid);
                    const targetData = nodeManager.getNodeData(attack.target);
                    const targetid = attack.target;
                    nodeManager.resetNodeColorTint(targetid);
                    nodeManager.setNodeColorTint(attack.target, _purp, 0.95);
                    targetData.state.disabled.set(
                        true,
                        1800,
                        () => {
                            nodeManager.resetNodeColorTint(targetid);
                        },
                        true
                    );
                },
                canAdd: (nodeData) => {
                    return nodeData.isFriendly && nodeData.attackers.length == 0;
                },
            },
            cubedefense: {
                mesh: AttackManagerFactory.CubeDefense,
                damage: 12,
                cooldown: 1500, // ms
                logic: AttackLogic.BasicLogicFactory,
                effect: (nodeManager, attackid) => {},
                canAdd: (nodeData) => {
                    return !nodeData.isFriendly;
                },
            },
        };
    },
    NodeTypeData: {
        placeholder: {
            health: 50,
            slots: 4,
        },
        cube: {
            health: 100,
            slots: 5,
        },
        scanner: {
            health: 75,
            slots: 4,
        },
        globe: {
            health: 0,
            slots: 3,
        },
        cashfarm: {
            health: 75,
            slots: 2,
        },
        cashstore: {
            health: 125,
            slots: 3,
        },
        cryptofarm: {
            health: 75,
            slots: 2,
        },
        cryptostore: {
            health: 125,
            slots: 3,
        },
    },
    NodeOverlayData: {
        slots: {
            tiles: 7,
            offset: new Vector3(-0.9, -0.95, 0),
            geometry: new PlaneGeometry(0.7, 0.7),
            material: SSMaterialType.Mask(
                "./source/node-overlay/slots.png",
                "./source/node-overlay/slots-mask.png",
                new Vector2(500, 500),
                new Vector2(4000, 3500)
            ),
        },
        cash: {
            offset: _currencyOverlayData.offset,
            geometry: _currencyOverlayData.geometry,
            material: SSMaterialType.Mask(
                "./source/node-overlay/currency/cash-bar.png",
                _currencyOverlayData.alphaMap,
                _currencyOverlayData.mapSize,
                _currencyOverlayData.alphaMapSize
            ),
        },
        crypto: {
            offset: _currencyOverlayData.offset,
            geometry: _currencyOverlayData.geometry,
            material: SSMaterialType.Mask(
                "./source/node-overlay/currency/crypto-bar.png",
                _currencyOverlayData.alphaMap,
                _currencyOverlayData.mapSize,
                _currencyOverlayData.alphaMapSize
            ),
        },
    },
    NodeDetailedInfo: {
        placeholder: {
            cost: {
                type: "cash",
                amount: 1,
            },
            sell: {
                type: "cash",
                amount: 1,
            },
            name: "_placeholder_",
            description: "Placeholder. Doesn't do anything.",
        },
        cube: {
            cost: {
                type: "crypto",
                amount: 2,
            },
            sell: {
                type: "crypto",
                amount: 1,
            },
            name: "Cube",
            description: "Captures hostile Nodes within 1 step.",
        },
        globe: {
            cost: undefined,
            sell: undefined,
            name: "Access Port",
            description: `Required for your net to exist.\nAll nodes exist within ${CONFIG.maxStepsFromGlobe} steps of an Access Port.\nAll attacks start in your net from here.`,
        },
        scanner: {
            cost: {
                type: "cash",
                amount: 10,
            },
            sell: {
                type: "cash",
                amount: 5,
            },
            name: "Sentinal",
            description: "Scans for Attacker activity within [TBD] steps.",
        },
        cashfarm: {
            cost: {
                type: "crypto",
                amount: 1,
            },
            sell: {
                type: "crypto",
                amount: 1,
            },
            name: "Cash Farm",
            description:
                "Farms for cash. Can be collected from to use for purchases.",
        },
        cryptofarm: {
            cost: {
                type: "cash",
                amount: 5,
            },
            sell: {
                type: "cash",
                amount: 5,
            },
            name: "Credits Farm",
            description:
                "Farms for credits. Can be collected from to use for purchases.",
        },
        cashstore: {
            cost: undefined,
            sell: undefined,
            name: "Cash Storage",
            description: "Holds Cash"
        },
        cryptostore: {
            cost: undefined,
            sell: undefined,
            name: "Credits Storage",
            description: "Holds Credits"
        },
    },
};
