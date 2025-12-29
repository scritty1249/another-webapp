import { Attacks } from "./mesh.js";
import { AttackLogic } from "./attacker.js";
import { Vector2, Vector3, PlaneGeometry }  from "three";
import { SSMaterialType, SSFramesMesh } from "./spritesheet.js";
import { Cost, Currency } from "./currency.js";

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
                cost: Cost ("crypto", 1),
                name: "Worms",
                description:
                    "Malicious attack, nasty stuff. When injected, it seeks out a nearby Node with the lowest health, and applies sustained pressure until that Node is taken.",
            },
            pascualcannon: {
                cost: Cost ("crypto", 4),
                name: "[Name TBD] Special Beam Cannon",
                description:
                    "Devastating attack that stuns any target hit. Requires all slots on a Node to be empty before injecting.",
            },
            laser: {
                cost: Cost ("crypto", 2 ),
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
                mesh: Attacks.Particle,
                sfx: "pew",
                maxTargets: 1,
                cooldown: 650, // ms
                logic: AttackLogic.ParticleLogicFactory, // don't need to instantite logic controllers for "dumb" attackers- they're stateless!
                effect: (attack, nodeManager) => {
                    const targetData = attack.instancedata[0].targetNodeData;
                    if (!targetData.damage(15)) {

                    }
                },
                canAdd: (nodeData) => {
                    return (
                        nodeData.isFriendly &&
                        !nodeData.attackers.some((a) => a.type == "pascualcannon")
                    );
                },
            },
            laser: {
                mesh: Attacks.Laser,
                sfx: undefined,
                maxTargets: 1,
                cooldown: 0, // ms
                logic: AttackLogic.ParticleLogicFactory, // don't need to instantite logic controllers for "dumb" attackers- they're stateless!
                effect: (attack, nodeManager) => {
                    const targetData = attack.instancedata[0].targetNodeData;
                    if (!targetData.damage(5)) {

                    }
                },
                canAdd: (nodeData) => {
                    return (
                        nodeData.isFriendly &&
                        !nodeData.attackers.some((a) => a.type == "pascualcannon")
                    );
                },
            },
            pascualcannon: {
                mesh: (a) => Attacks.PascualCannon(camera, a),
                maxTargets: 1,
                sfx: undefined,
                cooldown: 1000, // ms
                logic: AttackLogic.BasicLogicFactory,
                effect: (attack, nodeManager) => {
                    const _purp = 0x341539;
                    const targetData = attack.instancedata[0].targetNodeData;
                    const targetid = attack.instancedata[0].target;
                    if (!targetData.damage(50)) {
                        targetData.state.disabled.set(
                            true,
                            1800,
                            () => {
                                targetData.state.updateVfx();
                            },
                            true
                        );
                        targetData.state.updateVfx();
                    }
                },
                canAdd: (nodeData) => {
                    return nodeData.isFriendly && nodeData.attackers.length == 0;
                },
            },
        };
    },
    DefenseTypeData: function (camera) {
        return {
            cube: {
                mesh: (a) => Attacks.CubeDefense(camera, a),
                maxTargets: 7, // [!] unlimited, but for now cap it at the maximum number of node connections we technically support.
                sfx: undefined,
                cooldown: 2150, // ms
                logic: AttackLogic.CubeDefenseLogicFactory,
                effect: (attack, nodeManager) => {
                    const statusEffectName = "cubed"; // lol
                    const maxStatusEffectStacks = 5;
                    attack.instancedata
                        .filter(({target}) => target !== undefined)
                        .map(({targetNodeData}) => targetNodeData)
                        .forEach((targetData) => {
                            if (targetData.isFriendly)
                                targetData.damage(5);
                            else // apply stacks on enemy nodes
                                if (
                                    targetData.state.detail[statusEffectName] &&
                                    targetData.state.detail[statusEffectName] >= maxStatusEffectStacks - 1
                                ) { // propogate status
                                    nodeManager.addAttackToNode("cube", targetData.uuid);
                                    targetData.state[statusEffectName].set(true, -1);
                                    delete targetData.state.detail[statusEffectName];
                                    targetData.state.updateVfx();
                                } else {
                                    if (targetData.state.detail[statusEffectName])
                                        targetData.state.detail[statusEffectName]++;
                                    else
                                        targetData.state.detail[statusEffectName] = 1;
                                }
                        });
                },
                canAdd: (nodeData) => {
                    return !nodeData.isFriendly && (nodeData.nodeType == "cube" || !nodeData.state.cubed.active);
                },
            },
        };
    },
    StatusEffects: {
        disabled: {
            color: {
                value: 0x341539,
                strength: 0.95
            },
            emissive: {
                value: 0x341539,
                strength: undefined
            },
        },
        cubed: {
            color: {
                value: 0x050505,
                strength: 1
            },
            emissive: {
                value: undefined,
                strength: undefined
            },
        }
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