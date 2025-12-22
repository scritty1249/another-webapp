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

const _thumbnailPath = "./source/node-thumbs/";


export const DataStore = {
    AttackerData: {
        icons: {
            particle: "./source/attacks/particle/attack-icon.png",
            laser: "./source/attacks/laser/attack-icon.png",
            pascualcannon: "./source/attacks/pascualcannon/attack-icon.png",
            _unknown: "./source/attacks/unknown-attack-icon.png",
            _empty: "./source/attacks/blank-attack-icon.png"
        },
        attacks: {
            particle: {
                cost: {
                    type: "crypto",
                    amount: 1
                },
                name: "Worms",
                description:
                    "Malicious attack, nasty stuff. When injected, it seeks out a nearby Node with the lowest health, and applies sustained pressure until that Node is taken.",
            },
            pascualcannon: {
                cost: {
                    type: "crypto",
                    amount: 4
                },
                name: "[Name TBD] Special Beam Cannon",
                description:
                    "Devastating attack that stuns any target hit. Requires all slots on a Node to be empty before injecting.",
            },
            laser: {
                cost: {
                    type: "crypto",
                    amount: 2
                },
                name: "[Name TBD] Brute Force v1",
                description:
                    "Applies single target, sustained stress to any nearby Node upon injection.",
            }
        },
    },
    BuilderData: {
        icons: {}
    },
    AttackTypeData: function (camera) {
        return {
            particle: {
                mesh: AttackManagerFactory.Particle,
                sfx: "pew",
                damage: 15,
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
                damage: 50,
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
    NodeOverlay: {
        Build: {
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
        Attack: {
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
            core: {
                offset: _currencyOverlayData.offset,
                geometry: _currencyOverlayData.geometry,
                material: SSMaterialType.Mask(
                    "./source/node-overlay/currency/core-bar.png",
                    _currencyOverlayData.alphaMap,
                    _currencyOverlayData.mapSize,
                    _currencyOverlayData.alphaMapSize
                ),
            },
        },
    },
    AttackSfx: {
        "emptied-store": "coin",
    },
    SelectPhaseBackground: "_world",
};

Object.values(CONFIG.NODES).forEach(({id}) => DataStore.BuilderData.icons[id] = _thumbnailPath + id + ".gif");