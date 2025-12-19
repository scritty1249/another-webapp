import { AttackManagerFactory } from "./mesh.js";
import { AttackLogic } from "./attacker.js";
import { Vector2, Vector3, PlaneGeometry }  from "three";
import { SSMaterialType, SSFramesMesh } from "./spritesheet.js";

const _currencyOverlayData = {
    // avoid reinitializing where possible
    offset: new Vector3(0, 1.5, 0),
    geometry: new PlaneGeometry(0.9, 0.3),
    alphaMap: "./source/node-overlay/currency/currency-bar-mask.png",
    staticMap: "./source/node-overlay/currency/static-bar-mask.png",
    mapSize: new Vector2(300, 100),
    alphaMapSize: new Vector2(600, 100),
};

const _baseHealthRegenPercentage = .02 * .05; // laziness, regens 10% health every X ticks

export const DataStore = {
    AttackerData: {
        icons: {
            particle: "./source/attacks/particle/attack-icon.png",
            laser: "./source/attacks/laser/attack-icon.png",
            pascualcannon: "./source/attacks/pascualcannon/attack-icon.png",
            _unknown: "./source/attacks/unknown-attack-icon.png",
            _empty: "./source/attacks/blank-attack-icon.png"
        },
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
                sfx: "pew",
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
                sfx: undefined,
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
                sfx: undefined,
                damage: 10,
                cooldown: 1000, // ms
                logic: AttackLogic.BasicLogicFactory,
                effect: (nodeManager, attackid) => {
                    const _purp = 0x341539;
                    const attack = nodeManager.getAttack(attackid);
                    const targetData = nodeManager.getNodeData(attack.target);
                    const targetid = attack.target;
                    nodeManager.resetNodeColorTint(targetid);
                    nodeManager.resetNodeEmissive(targetid);
                    nodeManager.setNodeColorTint(targetid, _purp, 0.95);
                    nodeManager.setNodeEmissive(targetid, _purp);
                    targetData.state.disabled.set(
                        true,
                        1800,
                        () => {
                            if (!targetData.isFriendly) {
                                nodeManager.resetNodeColorTint(targetid);
                                nodeManager.resetNodeEmissive(targetid);
                            }
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
                sfx: undefined,
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
    AttackNodeTypeData: {
        placeholder: {
            health: 50,
            slots: 4,
            regen: _baseHealthRegenPercentage // per tick
        },
        cube: {
            health: 100,
            slots: 5,
            regen: _baseHealthRegenPercentage // per tick
        },
        scanner: {
            health: 75,
            slots: 4,
            regen: _baseHealthRegenPercentage // per tick
        },
        globe: {
            health: 0,
            slots: 3,
            regen: 0
        },
        cashfarm: {
            health: 75,
            slots: 2,
            regen: _baseHealthRegenPercentage // per tick
        },
        cashstore: {
            health: 125,
            slots: 3,
            regen: _baseHealthRegenPercentage // per tick
        },
        cryptofarm: {
            health: 75,
            slots: 2,
            regen: _baseHealthRegenPercentage // per tick
        },
        cryptostore: {
            health: 125,
            slots: 3,
            regen: _baseHealthRegenPercentage // per tick
        },
        botnet: {
            health: 225,
            slots: 5,
            regen: _baseHealthRegenPercentage // per tick
        },
    },
    BuildNodeOverlayData: {
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
            material: SSMaterialType.DoubleMask(
                "./source/node-overlay/currency/cash-bar.png",
                _currencyOverlayData.alphaMap,
                _currencyOverlayData.mapSize,
                _currencyOverlayData.alphaMapSize,
                _currencyOverlayData.staticMap
            ),
        },
        crypto: {
            offset: _currencyOverlayData.offset,
            geometry: _currencyOverlayData.geometry,
            material: SSMaterialType.DoubleMask(
                "./source/node-overlay/currency/crypto-bar.png",
                _currencyOverlayData.alphaMap,
                _currencyOverlayData.mapSize,
                _currencyOverlayData.alphaMapSize,
                _currencyOverlayData.staticMap
            ),
        },
    },
    AttackNodeOverlayData: {
        health: {
            offset: new Vector3(-0.95, -0.95, 0),
            geometry: new PlaneGeometry(0.6, 0.6),
            material: SSMaterialType.CircleProgress(0xE3E3E3),
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
    AttackSfx: {
        "emptied-store": "coin",
    },
    NodeDetailedInfo: {
        placeholder: {
            cost: {
                type: "cash",
                amount: 10,
            },
            sell: {
                type: "cash",
                amount: 0,
            },
            limit: {
                base: 99,
                increase: 0 // this can be a decimal, but final value is floored after calculation
            },
            name: "_???_",
            description: "Placeholder. Doesn't do anything.",
            thumb: "./source/node-thumbs/placeholder.gif",
        },
        cube: {
            cost: {
                type: "crypto",
                amount: 6,
            },
            sell: {
                type: "crypto",
                amount: 3,
            },
            limit: {
                base: 2,
                increase: 1 // this can be a decimal, but final value is floored after calculation
            },
            highlightSteps: 1,
            name: "Cube",
            description: "Captures hostile Nodes within 1 step.",
            thumb: "./source/node-thumbs/cube.gif", // placeholder
        },
        globe: {
            cost: undefined,
            sell: undefined,
            limit: {
                base: 2,
                increase: 0.34 // this can be a decimal, but final value is floored after calculation
            },
            freecount: 2,
            highlightSteps: CONFIG.maxStepsFromGlobe,
            name: "Access Port",
            description: `Required for your net to exist.\nAll nodes exist within ${CONFIG.maxStepsFromGlobe} steps of an Access Port.\nAll attacks start in your net from here.`,
            thumb: "./source/node-thumbs/globe.gif",
        },
        scanner: {
            cost: {
                type: "cash",
                amount: 550,
            },
            sell: {
                type: "cash",
                amount: 240,
            },
            limit: {
                base: .5,
                increase: .5 // this can be a decimal, but final value is floored after calculation
            },
            highlightSteps: 2,
            name: "Sentinal",
            description: "Scans for Attacker activity within 2 steps.",
            thumb: "./source/node-thumbs/scanner.gif",
        },
        cashfarm: {
            cost: {
                type: "crypto",
                amount: 5,
            },
            sell: {
                type: "crypto",
                amount: 2,
            },
            limit: {
                base: 1,
                increase: 1 // this can be a decimal, but final value is floored after calculation
            },
            freecount: 1,
            name: "Cash Farm",
            description:
                "Farms for cash. Can be collected from to use for purchases.",
            thumb: "./source/node-thumbs/cashfarm.gif",
        },
        cryptofarm: {
            cost: {
                type: "cash",
                amount: 275,
            },
            sell: {
                type: "cash",
                amount: 135,
            },
            limit: {
                base: 1,
                increase: 1 // this can be a decimal, but final value is floored after calculation
            },
            freecount: 0,
            name: "Credits Farm",
            description:
                "Farms for credits. Can be collected from to use for purchases.",
            thumb: "./source/node-thumbs/cryptofarm.gif",
        },
        cashstore: {
            cost: {
                type: "crypto",
                amount: 5,
            },
            sell: {
                type: "crypto",
                amount: 2,
            },
            limit: {
                base: 2,
                increase: 1 // this can be a decimal, but final value is floored after calculation
            },
            freecount: 1,
            name: "Cash Storage",
            description: "Holds Cash",
            thumb: "./source/node-thumbs/cashstore.gif",
        },
        cryptostore: {
            cost: {
                type: "cash",
                amount: 500,
            },
            sell: {
                type: "cash",
                amount: 250,
            },
            limit: {
                base: 2,
                increase: 1 // this can be a decimal, but final value is floored after calculation
            },
            freecount: 0,
            name: "Credits Storage",
            description: "Holds Credits",
            thumb: "./source/node-thumbs/cryptostore.gif",
        },
        botnet: {
            cost: {
                type: "crypto",
                amount: 35,
            },
            sell: {
                type: "crypto",
                amount: 18,
            },
            limit: {
                base: 1,
                increase: .34 // this can be a decimal, but final value is floored after calculation
            },
            freecount: 1,
            name: "Botnet Processing Farm",
            description:
                "Uses a processing network to compile and upgrade Attacks.",
            thumb: "./source/node-thumbs/botnet.gif",
        },
    },
    SelectPhaseBackground: "_world",
};
