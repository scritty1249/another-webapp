// Handles phase changes
import { ListenerManager } from "./listeners.js";
import {
    BuildOverlayManager,
    SelectOverlayManager,
    AttackOverlayManager,
} from "./overlay.js";
import { BuildNodeManager, AttackNodeManager } from "./nodes.js";
import { Color } from "three";
import * as UTIL from "./utils.js";

import { DataStore } from "./data.js";

const nodeDraggedEmissive = new Color(0xff8888);
const tetherStepStartColor = new Color(0xff0000);
const tetherStepEndColor = new Color(0x000000);

export function PhaseManager(
    scene,
    camera,
    rendererDom,
    tickspeed,
    controls,
    Managers
) {
    ({
        Node: this.Managers.Node,
        Overlay: this.Managers.Overlay,
        Physics: this.Managers.Physics,
        World: this.Managers.World,
        Mouse: this.Managers.Mouse,
        Audio: this.Managers.Audio,
        Effects: this.Managers.Effects,
        Menu: this.Managers.Menu,
    } = Managers);
    this._camera = camera;
    this._scene = scene;
    this._controls = controls;
    this._rendererDom = rendererDom;
    this._attackTypes = DataStore.AttackTypeData(camera);
    this.tick.delta = 0;
    this.tick.interval = tickspeed;
    this.Managers.Attacks = new AttackManagerWrapper();
    this._resetUpdateManagers();
    this._unloadPhase = () => {};

    this._constructorArgs.Node = this.Managers.Node._constructorArgs;
    this._constructorArgs.Overlay = this.Managers.Overlay._constructorArgs;

    return this;
}

PhaseManager.prototype = {
    _camera: undefined,
    _scene: undefined,
    _rendererDom: undefined,
    _controls: undefined,
    _attackTypes: undefined,
    _unloadPhase: undefined,
    phase: undefined,
    tick: {
        detla: 0,
        interval: undefined,
    },
    Managers: {
        Node: undefined,
        Overlay: undefined,
        Listener: undefined,
        Physics: undefined,
        World: undefined,
        Mouse: undefined,
        Attacks: undefined,
        Audio: undefined,
        Effects: undefined,
        Menu: undefined,
    },
    _constructorArgs: {
        Node: undefined,
        Overlay: undefined,
    },
    get playerLevel () {
        return this.Managers.Node?.getCore()?.userData.exportData?.level;
    },
};

PhaseManager.prototype._resetUpdateManagers = function () {
    this._updateManagers = {
        perTick: [],
        always: [],
    };
};

PhaseManager.prototype._validateKeys = function (object, expectedNames = []) {
    const names = Object.keys(object);
    let valid = true;
    expectedNames.forEach((expectedName) => {
        if (!names.includes(expectedName)) valid = false;
    });
    return valid;
};

PhaseManager.prototype.selectPhase = function (
    metadata = {},
) {
    const self = this;
    Logger.info("[PhaseManager] | Loading Select phase");
    this._unloadPhase();

    // setup new phase
    const oldMinZoom = this._controls.camera.minDistance;
    const oldMaxZoom = this._controls.camera.maxDistance;
    this._controls.camera.autoRotate = true;

    this._openLoadingAnimation();
    return UTIL.loadBackgroundTexture(DataStore.SelectPhaseBackground, this._scene)
        .then(layoutLoaded => {
            const overlayController = new SelectOverlayManager(
                ...this._constructorArgs.Overlay
            );
            const listenerController = new ListenerManager();
            this.Managers.World.init();
            overlayController.init(self._controls, {
                Mouse: self.Managers.Mouse,
            });

            this._controls.camera.minDistance = (this.Managers.World._mesh.userData.radius * 2) * 1.4;
            this._controls.camera.maxDistance = this._controls.camera.minDistance * 1.7;
            // add targets
            const targets = Storage.get("currentTargets");
            for (const { geo, id, username } of targets) {
                const country = self.Managers.World.markOnWorld(geo.lat, geo.long, id);
                Logger.info("Added marker to " + country);
            }

            // listeners
            let rotateTimeout;
            listenerController
                .listener(self._controls.camera)
                .add("end", function (event) {
                    rotateTimeout = setTimeout(() => {
                        if (
                            self.Managers.World.enabled &&
                            !self.Managers.World.state.focusedCountry &&
                            !self.Managers.World.state.tweeningCamera
                        )
                            self._controls.camera.autoRotate = true;
                    }, 3500);
                })
                .add("start", function (event) {
                    if (rotateTimeout) clearTimeout(rotateTimeout);
                    self._controls.camera.autoRotate = false;
                    self.Managers.World.state.tweeningCamera = false;
                });
            listenerController
                .listener(overlayController.element.refreshButton)
                .add("click", function (event) {
                    Logger.info("[PhaseManager] | Fetching new world targets.");
                    self.Managers.World.unfocusCountry(false);
                    Storage.set("currentTargets", UTIL.getRandomItems(Storage.get("targets", true), CONFIG.WORLD_TARGET_COUNT))
                    self.Managers.Menu._dispatch(
                        "swapphase",
                        {
                            phase: "select",
                            refresh: true
                        }
                    );
                });
            listenerController
                .listener(overlayController.element.menuButton)
                .add("click", function (event) {
                    self.Managers.Menu._dispatch("swapphase", {
                        phase: "build",
                    });
                });
            this.Managers.World.when("click", function (detail) {
                const last = detail.previous;
                const curr = detail.current;
                const target = detail.target;
                if (target) {
                    if (rotateTimeout) clearTimeout(rotateTimeout);
                    Logger.log(`Selected target: `, target);
                    self.Managers.Overlay._menuManager.when(
                        "loadmenu",
                        (detail) => {
                            const targetData = Storage.get("targets", true).filter(
                                (t) => t.id == target.id
                            )?.[0];
                            detail.infoElement.text = targetData
                                ? [
                                    targetData.username,
                                    "\n",
                                    "Currency Stored:",
                                    Array.from(
                                        Object.entries(
                                            UTIL.getStoredCurrencyFromLayout(
                                                targetData.game
                                            )
                                        ),
                                        ([currencyType, currencyAmount]) =>
                                            `${currencyType}: ${Math.floor(
                                                CONFIG.CURRENCY_THEFT_RATIO * currencyAmount
                                            )}`
                                    ).join("\n"),
                                ].join("\n\n")
                                : "-- No Data Found --";
                            detail.infoElement.align("left");
                            detail.buttonElement.addEventListener("click", () => {
                                self.Managers.Menu._dispatch(
                                    "swapphase",
                                    {
                                        phase: "attack",
                                        targetid:
                                            target.id,
                                    }
                                );
                            });
                        },
                        false,
                        true
                    );
                    self.Managers.Overlay._menuManager.open(["targetInfo"]);
                }
            });
            this.Managers.Node = undefined;
            this.Managers.Overlay = overlayController;
            this.Managers.Listener = listenerController;
            this._updateManagers.always.push(
                this.Managers.World,
                this.Managers.Overlay
            );
            this._unloadPhase = () => {
                this._resetUpdateManagers();
                this.Managers.Audio.stop();
                this._controls.camera.minDistance = oldMinZoom;
                this._controls.camera.maxDistance = oldMaxZoom;
                this._controls.camera.autoRotate = false;
                this.Managers.Listener.clear();
                this.Managers.World.clear();
                this.Managers.Overlay.clear();
            };
            this.phase = "select";
            this._closeLoadingAnimation();
            Logger.log("[PhaseManager] | Loaded Select phase");
        });
};

PhaseManager.prototype.attackPhase = function (
    overlayData,
    attackResultCallback,
    layout,
    attackData,
    metadata = {}
) {
    const self = this;
    Logger.info("[PhaseManager] | Loading Attack phase");
    this._unloadPhase();

    const attackerData = {};
    const attackerTypeData = {};
    // remove unknown attacks
    attackerData.attacks = Object.assign({}, attackData);
    Object.keys(attackData).forEach((a) => {
        if (!self._attackTypes.hasOwnProperty(a))
            delete attackerData.attacks[a];
    });
    attackerData.icons = DataStore.AttackerData.icons; // [!]
    // Attacker attacks
    Object.entries(attackerData.attacks).forEach(([type, amount]) => {
        const typeData = self._attackTypes[type];
        attackerTypeData[type] = {
            manager: typeData.mesh(amount),
            damage: typeData.damage,
            logic: typeData.logic,
            cooldown: typeData.cooldown,
            canAdd: typeData.canAdd,
            effect: typeData.effect,
            sfx: typeData?.sfx,
        };
    });
    // Defender attacks
    {
        const _attackType = "cubedefense";
        const cubeCount = layout.layout.nodes
            .map((n) => n.type)
            .filter((t) => t == "cube").length; // need to parse the layout object
        const typeData = self._attackTypes[_attackType];
        attackerTypeData[_attackType] = {
            manager: typeData.mesh(cubeCount),
            damage: typeData.damage,
            logic: typeData.logic,
            cooldown: typeData.cooldown,
            canAdd: typeData.canAdd,
            effect: typeData.effect,
            sfx: typeData?.sfx,
        };
    }

    // init attack managers
    Object.values(attackerTypeData).forEach((typeData) => {
        if (typeData.manager) {
            typeData.manager.init(this._scene);
            if (typeData.sfx)
                typeData.manager.onplayback = (position) =>
                    self.Managers.Audio.play(typeData.sfx, position);
            this.Managers.Attacks.push(typeData.manager);
        }
    });

    const bankController = {
        // pseudo-manager for bank data
        notEmpty: new Set(),
        emptied: new Set(),
        stolen: {
            cash: 0,
            crypto: 0,
        },
        coreDownload: 0,
        tick: 0,
        interval: CONFIG.CURRENCY_THEFT_TICKSPEED,
        get capturedStores() {
            return [
                ...nodeController.getStorageNodes("cash"),
                ...nodeController.getStorageNodes("crypto"),
            ].filter((n) => self.Managers.Node.getNodeData(n.uuid)?.isFriendly);
        },
        get theftPromise () {
            const me = this;
            const coreDownload = nodeController.getCoreData()?.download.max;
            return (async () => {
                while (
                    self.phase == "attack" &&
                    (
                        me.capturedStores.some(n => n.userData.exportData.store.amount > 0) ||
                        coreDownload > me.coreDownload
                    )
                )
                    await new Promise(resolve => setTimeout(resolve, self.tick.interval));
                return;
            })();
        },
        download: function (core) {
            if (core.userData.exportData?.data?.download.amount <= 0) return;
            core.userData.exportData.data.download.amount--;
            this.coreDownload++;
        },
        steal: function (node) {
            // [!] fix redundancy here
            if (node.userData.isStorageNode)
                if (
                    node.userData.exportData.data.amount &&
                    node.userData.exportData.data.amount == node.userData.exportData.data.max
                )
                    this.notEmpty.add(node.uuid);
                else if (!this.emptied.has(node.uuid) && this.notEmpty.has(node.uuid) && node.userData.exportData.data.amount <= 0) {
                    this.emptied.add(node.uuid);
                    self.Managers.Audio.play(DataStore.AttackSfx["emptied-store"], node);
                    return;
                }
            if (node.userData.exportData?.data?.amount <= 0) return;
            node.userData.exportData.data.amount--;
            this.stolen[node.userData.exportData.data.type]++;
        },
        update: function () {
            if (this.tick < this.interval) {
                this.tick++;
                return;
            }
            this.tick = 0;
            const core = nodeController.getCore();
            if (self.Managers.Node.getNodeData(core.uuid)?.isFriendly)
                this.download(core);
            this.capturedStores.forEach(n => this.steal(n));
        },
    };

    const changePhaseCallback = () => { // also switches phase to build
        if (self.phase == "attack") {
            const { cash, crypto } = bankController.stolen;
            const transfer = [];
            const record = []; // this one isn't offset by any ratios, and will be sent to the database.
            if (cash) {
                transfer.push({
                    cash: Math.floor(CONFIG.CURRENCY_THEFT_RATIO * cash),
                });
                record.push({ cash: cash });
            }
            if (crypto) {
                transfer.push({
                    crypto: Math.floor(CONFIG.CURRENCY_THEFT_RATIO * crypto),
                });
                record.push({ crypto: crypto });
            }
            if (cash || crypto) {
                attackResultCallback(record);
                self.Managers.Overlay._menuManager._dispatch("swapphase", {
                    phase: "build",
                    metadata: { transfer: transfer },
                    
                });
            } else
                self.Managers.Overlay._menuManager._dispatch("swapphase", {
                    phase: "build",
                    metadata: { },
                });
        } else {
            Logger.debug(
                `[PhaseManager] | Cannot transfer funds: Phase is no longer set to attack. (${self.phase})`
            );
        }
    };
    const nodeVictoryCallback = () => {
        Logger.debug("[PhaseManager] | Victory callback triggered, waiting for theft.");
        bankController.theftPromise
            .then(_ => {
                Logger.debug("[PhaseManager] | Finished waiting for theft.");
                changePhaseCallback();
            });
    };

    const nodeController = new AttackNodeManager(
        nodeVictoryCallback,
        attackerTypeData,
        ...this._constructorArgs.Node
    );
    const overlayController = new AttackOverlayManager(
        overlayData,
        attackerData,
        ...this._constructorArgs.Overlay
    );
    const listenerController = new ListenerManager();
    overlayController.init(this._controls, {
        Mouse: self.Managers.Mouse,
        Node: nodeController,
    });
    this._openLoadingAnimation();
    return UTIL.layoutFromJsonObj(layout, this._scene, this._controls.drag, nodeController)
        .then(layoutLoaded => {
            Object.entries(attackerData.attacks)
                .forEach(([type, amount]) => {
                    overlayController.updateAttackBarTile(type, amount);
                });


            listenerController
                .listener(self._rendererDom)
                .add("clicked", function (event) {
                    const clickedNodeId = nodeController.getNodeFromFlatCoordinate(
                        self.Managers.Mouse.position
                    );
                    if (
                        clickedNodeId &&
                        overlayController.focusedNodeId != clickedNodeId
                    )
                        try {
                            overlayController.focusNode(clickedNodeId);
                        } catch (err) {
                            Logger.error(err);
                        }
                    else overlayController.unfocusNode();
                });
            listenerController
                .listener(overlayController.element.menuButton)
                .add("click", function (event) {
                    changePhaseCallback();
                });
            overlayController.startTimer(
                CONFIG.ATTACK_BASE_SECONDS_LIMIT, changePhaseCallback,
                5, () => {
                    self.Managers.Effects.vignette.flash(1000)
                        .then(() => self.Managers.Effects.vignette.flash(1000))
                        .then(() => self.Managers.Effects.vignette.flash(1000));
                }
            );
            self.Managers.Menu.when("addattack", (detail) => {
                const {type, nodeid} = detail;
                const barracks = Storage.get("localBarracks");
                if (
                    nodeController.addAttackToNode(type, nodeid)
                ) {
                    overlayController._updateFocusMenu();
                    if (!(--barracks[type]))
                        overlayController.removeAttackBarTile(type);
                    else {
                        overlayController.updateAttackBarTile(type, barracks[type]);
                        Storage.set("localBarracks", barracks);
                    }
                } else overlayController.messagePopup("Cannot add Attack to Node.");
            });

            this.Managers.Overlay = overlayController;
            this.Managers.Node = nodeController;
            this.Managers.Listener = listenerController;
            this._updateManagers.perTick.push(
                bankController,
                this.Managers.Node,
            );
            this._updateManagers.always.push(
                this.Managers.Node,
                this.Managers.Attacks,
                this.Managers.Overlay
            );
            this._unloadPhase = () => {
                this._resetUpdateManagers();
                this.Managers.Audio.stop();
                this.Managers.Listener.clear();
                this.Managers.Overlay.clear();
                this.Managers.Node.clear();
                this.Managers.Attacks.clear();
            };
            this.phase = "attack";
            this._closeLoadingAnimation();
            Logger.log("[PhaseManager] | Loaded Attack phase");
        });
};

PhaseManager.prototype.buildPhase = function (
    layout,
    metadata = {}
) {
    const self = this;
    Logger.info("[PhaseManager] | Loading Build phase");
    this._unloadPhase();
    this.Managers.Physics.activate();
    this._controls.drag.enabled = true;

    const nodeController = new BuildNodeManager(
        (attackType) => { // node compiled callback
            const barracks = Storage.get("localBarracks");
            if (!barracks[attackType])
                barracks[attackType] = 1;
            else
                barracks[attackType]++;
            Storage.set("localBarracks", barracks);
        },
        ...this._constructorArgs.Node
    );
    const overlayController = new BuildOverlayManager(
        {
            // callbacks
            nodeInfo: (nodeid) => {
                if (DEBUG_MODE) {
                    const node = nodeController.getNode(nodeid);
                    Logger.info("[PhaseManager] | Node Info pressed:\n", node);
                }
                const nodeType = nodeController.getNodeType(nodeid);
                // handle the nodes with their own menus
                if (nodeType == "botnet") {
                    self.Managers.Menu.when(
                        "loadmenu", function (detail) {
                            const updateMenu = detail?.update;
                            const _handler = () => {
                                const _nodeData = nodeController.getBotnetData(nodeid);
                                updateMenu(_nodeData.active, _nodeData.queue);
                            };
                            const _interval = setInterval(_handler, 200);
                            _handler();
                            self.Managers.Menu.when("clear", function () {
                                clearInterval(_interval);
                            }, false, true);
                        }, false, true
                    );
                    self.Managers.Menu.loadMenu.nodeMenus.botnet(nodeid, {
                        icons: DataStore.AttackerData.icons,
                        attackDetails: DataStore.AttackerData.attacks,
                        nodeData: nodeController.getBotnetData(nodeid),
                        removeAttackCallback: (nid, idx, isActive) => {
                            if (isActive)
                                nodeController.removeCompilingAttack(nid, idx);
                            else
                                nodeController.removeQueuedAttack(nid, idx);
                        },
                    });
                } else if (nodeType == "barracks") {
                    self.Managers.Menu.when(
                        "loadmenu", function (detail) {
                            const {updateCarousel, updateMenu} = detail;
                            const _handler = () => updateMenu(Storage.get("localBarracks"));
                            const _menuInterval = setInterval(_handler, 1000);
                            _handler();
                            const _carouselInterval = setInterval(updateCarousel, 200);
                            updateCarousel();
                            self.Managers.Menu.when("clear", function () {
                                clearInterval(_menuInterval);
                                clearInterval(_carouselInterval);
                            }, false, true);
                        }, false, true
                    );
                    self.Managers.Menu.loadMenu.nodeMenus.barracks({
                        icons: DataStore.AttackerData.icons,
                        attackDetails: DataStore.AttackerData.attacks,
                        removeAttackCallback: (type) => {
                            const barracks = Storage.get("localBarracks");
                            if (!barracks[type]) return
                            barracks[type]--;
                            Storage.set("localBarracks", barracks);
                        },
                    });

                } else {
                    // generic node pressed, just display node bio
                    self.Managers.Menu.when(
                        "loadmenu",
                        (detail) => {
                            const node =
                                overlayController._nodeManager.getNode(nodeid);
                            const nodeTypeData = CONFIG.NODES[node.userData.type];
                            const el = detail.infoElement;
                            el.text = [
                                nodeTypeData.name,
                                "\n",
                                nodeTypeData.build.description,
                                "\n",
                                node.userData.isCurrencyNode
                                    ? `Collection rate: ${node.userData.exportData.data.rate}/hour`
                                    : "",
                                node.userData.isStorageNode || node.userData.isCurrencyNode
                                    ? `Stored: ${node.userData.exportData.data.amount}/${node.userData.exportData.data.max} ${node.userData.exportData.data.type}`
                                    : "",
                            ].join("\n\n");
                            el.align("left");
                        },
                        false,
                        true
                    );
                    self.Managers.Menu.open(["nodeInfo"]);
                }
            },
        },
        ...this._constructorArgs.Overlay
    );
    const listenerController = new ListenerManager();
    const bankController = {
        // pseudo-manager for bank data
        get bank() {
            return {
                cash: nodeController.getStoredCurrency("cash"),
                crypto: nodeController.getStoredCurrency("crypto"),
            };
        },
        update: function () {
            const bankData = this.bank;
            const displayedBankData = overlayController.getWallet();
            if (UTIL.banksEqual(bankData, displayedBankData)) return;
            overlayController.updateWallet(bankData);
        },
        collect: function (nodeid) {
            const currencyType = nodeController.isCurrencyNode(nodeid);
            if (!currencyType) return false;
            const collected = nodeController.collectCurrencyNode(nodeid);
            overlayController.updateWallet(this.bank);
            return collected;
        },
    };
    this._openLoadingAnimation();
    return UTIL.layoutFromJsonObj(layout, this._scene, this._controls.drag, nodeController)
        .then(layoutLoaded => {
            overlayController.init(this._controls, {
                Mouse: self.Managers.Mouse,
                Node: nodeController,
            });

            if (metadata.transfer) {
                // add currency
                let text = [];
                metadata.transfer.forEach((currencyData) => {
                    const [[currencyType, amount]] = Object.entries(currencyData);
                    nodeController.addCurrency(currencyType, amount);
                    text.push(`${amount} ${currencyType}`);
                });
                const message =
                    "Transferred " +
                    (text.length > 1
                        ? text.slice(0, text.length - 1).join(", ") +
                        " and " +
                        text.at(-1)
                        : text[0]);
                overlayController.messagePopup(message);
            }
            if (metadata.barracks) {
                Storage.set("localBarracks", metadata.barracks);
            }
            self.Managers.Menu.when("addnode", (detail) => {
                const cost = CONFIG.NODES[detail.nodeType]?.build.buy;
                const bankData = bankController.bank;
                if (!detail?.free && cost) {
                    if (bankData[cost.type].amount - cost.amount < 0) {
                        overlayController.messagePopup(
                            `Cannot create new Node: Insufficient currency.`
                        );
                        self.Managers.Menu.close();
                        return;
                    } else {
                        nodeController.removeCurrency(cost.type, cost.amount);
                        overlayController.updateWallet(bankData);
                    }
                }
                nodeController.createNode(
                    detail.nodeType,
                    Array.from({ length: 3 }, (_) => UTIL.random(0.001, 0.002))
                ); // generate random offset so repulsion forces can take effect
                self.Managers.Menu.close();
            });
            self.Managers.Menu.when("backgroundchange", (detail) => {
                const bg = detail?.background;
                if (bg)
                    UTIL.loadBackgroundTexture(bg, self._scene)
                        .then(() => {
                            self.Managers.Menu.close();
                        });
            });

            // shop menu
            self.Managers.Menu.when("shopdisplay", (detail) => {
                const shopType = detail?.shop;
                if (shopType == "addnode") {
                    const nodeType = detail?.nodeType;
                    const nodeTypeData = CONFIG.NODES[nodeType];
                    const nodeIcon = DataStore.BuilderData.icons[nodeType];
                    const nodeCount = nodeController.getTypeNodes(nodeType).length;
                    const nodeDetailMenuInfo = { // expects {_type, description, cost(str), name, thumb}
                        _type: nodeType,
                        description: nodeTypeData.build.description,
                        name: nodeTypeData.name,
                        thumb: nodeIcon,
                    };
                    if (
                        nodeCount >= Math.floor(
                            nodeTypeData.build.limit.base + (
                                nodeTypeData.build.limit.increase * (
                                    self.playerLevel - nodeTypeData.unlock
                                )
                            )
                        ) ||
                        self.playerLevel < nodeTypeData.unlock
                    ) {
                        nodeDetailMenuInfo.cost = undefined;
                    } else if (
                        (nodeTypeData.build.freeCount && nodeCount < nodeTypeData.build.freeCount) ||
                        !nodeTypeData.build.buy
                    ) {
                        nodeDetailMenuInfo.free = true;
                    } else {
                        nodeDetailMenuInfo.cost = `${nodeTypeData.build.buy.amount} ${nodeTypeData.build.buy.type}`;
                    }
                    self.Managers.Menu.loadMenu.addNode.nodeDetail(
                        nodeDetailMenuInfo,
                        detail?.typeMenu
                    );
                }

            });
            self.Managers.Menu.when("compileattack", (detail) => {
                const {attackType, nodeid} = detail;
                const cost = DataStore.AttackerData.attacks[attackType]?.cost;
                const bankData = bankController.bank;
                if (cost) {
                    if (bankData[cost.type].amount - cost.amount < 0) {
                        overlayController.messagePopup(
                            `Cannot compile Attack: Insufficient currency.`,
                            1500
                        );
                        return;
                    } else {
                        nodeController.removeCurrency(cost.type, cost.amount);
                        overlayController.updateWallet(bankData);
                    }
                }
                nodeController.queueCompile(nodeid, attackType, 10);
            });
            // Add event listeners
            let rotateTimeout;
            let linesHighlighted;
            listenerController
                .listener(self._controls.camera)
                .add("end", function (event) {
                    rotateTimeout = setTimeout(() => {
                            self._controls.camera.autoRotate = true;
                    }, 8500);
                })
                .add("start", function (event) {
                    if (rotateTimeout) clearTimeout(rotateTimeout);
                    self._controls.camera.autoRotate = false;
                });
            listenerController
                .listener(self._controls.drag)
                .add("drag", function (event) {})
                .add("dragstart", function (event) {
                    self._controls.camera.enabled = false;
                    event.object.userData.dragged = true;
                    try {
                        nodeController.setNodeEmissive(
                            event.object.uuid,
                            nodeDraggedEmissive
                        );

                    } catch (err) {
                        Logger.error(
                            "DragControls selected a bad node (dragstart): ",
                            event.object,
                            self._controls.drag.objects,
                            self.Managers.Node.nodelist,
                            err
                        );
                    }
                })
                .add("dragend", function (event) {
                    self._controls.camera.enabled = true;
                    event.object.userData.dragged = false;
                    try {
                        nodeController.resetNodeEmissive(event.object.uuid);
                    } catch (err) {
                        Logger.error(
                            "DragControls selected a bad node (dragend): ",
                            event.object,
                            self._controls.drag.objects,
                            self.Managers.Node.nodelist,
                            err
                        );
                    }
                });
            listenerController
                .listener(self._rendererDom)
                .add("clicked", function (event) {
                    const clickedNodeId = nodeController.getNodeFromFlatCoordinate(
                        self.Managers.Mouse.position
                    );
                    if (linesHighlighted) {
                        nodeController.tetherlist
                            .filter((t) => t.material.uuid != t.userData.sourceMaterial.uuid)
                            .forEach((t) => {
                                t.material = t.userData.sourceMaterial.clone()
                                delete t.userData._depthTouched;
                            });
                        linesHighlighted = false;
                    }
                    if (clickedNodeId) {
                        const node = nodeController.getNode(clickedNodeId);

                        // play animation, if supported
                        if (node.userData.actionAnimations.includes("clicked"))
                            node.userData.fadeAnimation("clicked", "idle", .75);

                        if (bankController.collect(clickedNodeId)) {
                            self.Managers.Audio.play("coin", node);
                        } else if (overlayController.focusedNodeId != clickedNodeId) {
                            overlayController.focusNode(clickedNodeId);
                            self.Managers.Audio.play("click-focus", node);
                            {
                                const maxSteps = CONFIG.NODES[node.userData.type]?.build.highlightSteps;
                                if (maxSteps) {
                                    nodeController.tetherlist
                                        .forEach((t) => t.material.color.set(tetherStepEndColor));
                                    nodeController.traverseTethers(clickedNodeId, function (tether, depth, sourceid) {
                                        if (!tether.userData._depthTouched || tether.userData._depthTouched < depth) {
                                            tether.material.color.lerpColors(tetherStepEndColor, tetherStepStartColor, (depth / maxSteps)**2);
                                            tether.userData._depthTouched = depth;
                                        }
                                    }, maxSteps);
                                    linesHighlighted = true;
                                }
                            }
                            return;
                        }
                    }
                    nodeController.nodelist.forEach(node => {
                        if (node.userData.activeAnimations.includes("clicked"))
                            node.userData.fadeAnimation("idle", "clicked", .75);
                    });
                    overlayController.unfocusNode();
                });
            listenerController
                .listener(overlayController.element.menuButton)
                .add("click", function (event) {
                    self.Managers.Menu.open();
                });

            this.Managers.Node = nodeController;
            this.Managers.Overlay = overlayController;
            this.Managers.Listener = listenerController;
            this._updateManagers.always.push(
                this.Managers.Node,
                this.Managers.Physics,
                this.Managers.Overlay
            );
            this._updateManagers.perTick.push(bankController);
            this._unloadPhase = () => {
                clearTimeout(rotateTimeout);
                this._resetUpdateManagers();
                this.Managers.Audio.stop();
                this._controls.camera.autoRotate = false;
                this._controls.drag.enabled = false;
                this.Managers.Listener.clear();
                this.Managers.Overlay.clear();
                this.Managers.Physics.deactivate();
                this.Managers.Node.clear();
            };
            this.phase = "build";
            this._closeLoadingAnimation();
            Logger.log("[PhaseManager] | Loaded Build phase");
        });
};

PhaseManager.prototype._updateTick = function (timedelta) {
    this.tick.delta += timedelta;
    if (this.tick.delta < this.tick.interval) return;
    for (
        let t = 0;
        t <= Math.floor(this.tick.delta / this.tick.interval);
        t++
    ) {
        this._updateManagers.perTick.forEach((m) => {
            if (m.updateTick) // [!] expensive, change this first if optimizing
                m.updateTick();
            else
                m.update();
        });
    }
    this.tick.delta = this.tick.delta % this.tick.interval;
};

PhaseManager.prototype.update = function (timedelta) {
    this._updateTick(timedelta);
    this._updateManagers.always.forEach((m) => m.update(timedelta));
    // required if controls.enableDamping or controls.autoRotate are set to true
    this._controls.camera.update(); // must be called after any manual changes to the camera"s transform
};
PhaseManager.prototype._openLoadingAnimation = function () {
    const el = document.createElement("img");
    el.id = "loading-animation";
    el.src = "./source/loading-phase-single-loop.gif";
    el.alt = "Loading Phase...";
    this.Managers.Overlay.element._overlay.appendChild(el);
};
PhaseManager.prototype._closeLoadingAnimation = function () {
    const el = document.getElementById("loading-animation");
    if (el)
        el.remove();
};
function AttackManagerWrapper() {
    this._attackManagers = [];
    this.push = function (...managers) {
        managers.forEach((m) => this._attackManagers.push(m));
    };
    this.clear = function () {
        while (this._attackManagers.length) this._attackManagers.pop().clear();
    };
    this.update = function (delta) {
        this._attackManagers.forEach((m) => m.update(delta));
    };
    return this;
}
