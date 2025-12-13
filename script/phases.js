// Handles phase changes
import { ListenerManager } from "./listeners.js";
import {
    BuildOverlayManager,
    SelectOverlayManager,
    AttackOverlayManager,
} from "./overlay.js";
import { BuildNodeManager, AttackNodeManager } from "./nodes.js";
import { layoutFromJsonObj } from "./utils.js";
import { Color } from "three";
import * as UTIL from "./utils.js";

const selectPhaseBackground = new Color(0x000000);
const nodeDraggedEmissive = new Color(0xFF8888);

export function PhaseManager(
    scene,
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
    } = Managers);
    this._scene = scene;
    this._controls = controls;
    this._rendererDom = rendererDom;
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
    _scene: undefined,
    _rendererDom: undefined,
    _controls: undefined,
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
    },
    _constructorArgs: {
        Node: undefined,
        Overlay: undefined,
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

PhaseManager.prototype.selectPhase = function (targets, currencyRatio, callbacks) {
    const self = this;
    Logger.info("[PhaseManager] | Loading Select phase");
    this._unloadPhase();

    if (!this._validateKeys(callbacks, ["Attack", "Build"]))
        Logger.throw(
            new Error(
                "[PhaseManager] | Error initalizing Select Phase. Missing a callback in given arguments."
            )
        );

    // setup new phase
    this._controls.camera.autoRotate = true;
    this._controls.camera.autoRotateSpeed = 0.6;
    this._scene.background = selectPhaseBackground;

    const overlayController = new SelectOverlayManager(
        ...this._constructorArgs.Overlay
    );
    const listenerController = new ListenerManager();
    this.Managers.World.init();
    overlayController.init(self._controls, {
        Mouse: self.Managers.Mouse,
    });

    // add targets
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
            callbacks.Refresh();
        });
    this.Managers.World.when("click", function (detail) {
        const last = detail.previous;
        const curr = detail.current;
        const target = detail.target;
        if (target) {
            if (rotateTimeout) clearTimeout(rotateTimeout);
            Logger.log(`Selected target: `, target);
            self.Managers.Overlay._menuManager.when("loadmenu", detail => {
                const targetData = Storage.get(
                    "targets",
                    true
                ).filter(
                    (t) => t.id == target.id
                )?.[0];
                detail.infoElement.text = targetData
                    ? [
                        targetData.username,
                        "\n",
                        "Currency Stored:",
                        Array.from(Object.entries(UTIL.getStoredCurrencyFromLayout(targetData.game)),
                            ([currencyType, currencyAmount]) =>
                                `${currencyType}: ${Math.floor(currencyRatio * currencyAmount)}`
                            ).join("\n")
                        ].join("\n\n")
                    : "-- No Data Found --";
                detail.infoElement.align("left");
                detail.buttonElement.addEventListener("click", () => {
                    callbacks.Attack(target.id);
                });
            }, false, true);
            self.Managers.Overlay._menuManager.open(["targetInfo"]);
        }
    });
    this.Managers.Node = undefined;
    this.Managers.Overlay = overlayController;
    this.Managers.Listener = listenerController;
    this._updateManagers.always.push(this.Managers.World, this.Managers.Overlay);
    this._unloadPhase = () => {
        this._resetUpdateManagers();
        this._controls.camera.autoRotate = false;
        this.Managers.Listener.clear();
        this.Managers.World.clear();
        this.Managers.Overlay.clear();
    };
    this.phase = "select";
    Logger.log("[PhaseManager] | Loaded Select phase");
};

PhaseManager.prototype.attackPhase = function (
    phaseData,
    layout,
    attackData,
    attackTypes,
    nodeTypes
) {
    const self = this;
    Logger.info("[PhaseManager] | Loading Attack phase");
    this._unloadPhase();

    const attackerData = {};
    const attackerTypeData = {};
    // remove unknown attacks
    attackerData.attacks = attackData.attacks.filter((a) =>
        attackTypes.hasOwnProperty(a.type)
    ); 
    // Attacker attacks
    attackerData.attacks.forEach((attack) => {
        attackerTypeData[attack.type] = {
            manager: attackTypes[attack.type].mesh(attack.amount),
            damage: attackTypes[attack.type].damage,
            logic: attackTypes[attack.type].logic,
            cooldown: attackTypes[attack.type].cooldown,
            canAdd: attackTypes[attack.type].canAdd,
            effect: attackTypes[attack.type].effect
        };
    });
    // Defender attacks
    {
        const _attackType = "cubedefense"
        const cubeCount = layout.layout.nodes.map((n) => n.type).filter((t) => t == "cube").length; // need to parse the layout object
        attackerTypeData[_attackType] = {
            manager: attackTypes[_attackType].mesh(cubeCount),
            damage: attackTypes[_attackType].damage,
            logic: attackTypes[_attackType].logic,
            cooldown: attackTypes[_attackType].cooldown,
            canAdd: attackTypes[_attackType].canAdd,
            effect: attackTypes[_attackType].effect
        };
    }
    // init attack managers
    Object.values(attackerTypeData).forEach(typeData => {
        if (typeData.manager) {
            typeData.manager.init(this._scene);
            this.Managers.Attacks.push(typeData.manager);
        }
    });

    const nodeVictoryCallback = () => {
        Logger.debug("Victory callback triggered");
        if (self.phase == "attack") {
            const cash = Math.floor(self.Managers.Node.getStoredCurrency("cash").amount / 2);
            const crypto = Math.floor(self.Managers.Node.getStoredCurrency("crypto").amount / 2);
            const transfer = [];
            const record = []; // this one isn't offset by any ratios, and will be sent to the database.
            if (cash) {
                transfer.push({cash: Math.floor(phaseData.currencyRatio * cash)});
                record.push({cash: cash});
            }
            if (crypto) {
                transfer.push({crypto: Math.floor(phaseData.currencyRatio * crypto)});
                record.push({crypto: crypto});
            }
            if (cash || crypto) {
                phaseData.resultHandler(record)
                self.Managers.Overlay._menuManager._dispatch("swapphase", { phase: "build", metadata: { transfer: transfer } });
            } else
                self.Managers.Overlay._menuManager._dispatch("swapphase", { phase: "build" });
        } else {
            Logger.debug(`But phase is no longer set to attack. (${self.phase})`);
        }
    }

    const nodeController = new AttackNodeManager(
        nodeVictoryCallback,
        nodeTypes,
        attackerTypeData,
        ...this._constructorArgs.Node
    );
    const overlayController = new AttackOverlayManager(
        phaseData.overlayData,
        attackerData,
        ...this._constructorArgs.Overlay
    );
    const listenerController = new ListenerManager();

    overlayController.init(this._controls, {
        Mouse: self.Managers.Mouse,
        Node: nodeController,
    });

    layoutFromJsonObj(layout, this._scene, this._controls.drag, nodeController);
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

    this.Managers.Overlay = overlayController;
    this.Managers.Node = nodeController;
    this.Managers.Listener = listenerController;
    this._updateManagers.always.push(this.Managers.Node, this.Managers.Attacks, this.Managers.Overlay);
    this._unloadPhase = () => {
        this._resetUpdateManagers();
        this.Managers.Listener.clear();
        this.Managers.Overlay.clear();
        this.Managers.Node.clear();
        this.Managers.Attacks.clear();
    };
    this.phase = "attack";
    Logger.log("[PhaseManager] | Loaded Attack phase");
};

PhaseManager.prototype.buildPhase = function (layout, nodeOverlayData, nodeDetails, metadata = {}) {
    const self = this;
    Logger.info("[PhaseManager] | Loading Build phase");
    this._unloadPhase();
    this.Managers.Physics.activate();
    this._controls.drag.enabled = true;

    const nodeController = new BuildNodeManager(nodeOverlayData, ...this._constructorArgs.Node);
    const overlayController = new BuildOverlayManager(
        { // callbacks
            nodeInfo: (nodeid) => {
                overlayController._menuManager.when("loadmenu", detail => {
                    const node = overlayController._nodeManager.getNode(nodeid);
                    const nodeDetail = nodeDetails[node.userData.type];
                    const el = detail.infoElement;
                    el.text = [
                        nodeDetail.name,
                        "\n",
                        nodeDetail.description,
                        "Costs: " + (nodeDetail.cost ? `${nodeDetail.cost.amount} ${nodeDetail.cost.type}` : "Free"),
                        "Sell Value: " + (nodeDetail.sell ? `${nodeDetail.sell.amount} ${nodeDetail.sell.type}` : "None")
                    ].join("\n\n");
                    el.align("left");
                }, false, true);
                overlayController._menuManager.open(["nodeInfo"]);
            },
        },
        ...this._constructorArgs.Overlay
    );
    const listenerController = new ListenerManager();
    const bankController = {
        // pseudo-manager for bank data
        get bank () {
            return {
                cash: nodeController.getStoredCurrency("cash"),
                crypto: nodeController.getStoredCurrency("crypto")
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
            if (!currencyType) return;
            nodeController.collectCurrencyNode(nodeid);
            overlayController.updateWallet(this.bank);
        }
    };

    layoutFromJsonObj(layout, this._scene, this._controls.drag, nodeController);
    overlayController.init(this._controls, {
        Mouse: self.Managers.Mouse,
        Node: nodeController,
    });

    if (metadata.transfer) {
        // add currency
        let text = [];
        metadata.transfer.forEach((currencyData) => {
            const [[ currencyType, amount ]] = Object.entries(currencyData);
            nodeController.addCurrency(currencyType, amount);
            text.push(`${amount} ${currencyType}`);
        });
        const message = "Transferred " + (text.length > 1
            ? text.slice(0, text.length - 1)
                .join(", ") +
                " and " + text.at(-1)
            : text[0]);
        overlayController.messagePopup(message);
    }

    overlayController._menuManager.when("addnode", (detail) => {
        const cost = nodeDetails[detail.nodeType]?.cost;
        const bankData = bankController.bank;
        if (cost) {
            if (bankData[cost.type].amount - cost.amount < 0) {
                overlayController.messagePopup(`Cannot create new Node: Insufficient currency.`);
                overlayController._menuManager.close();
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
        overlayController._menuManager.close();
    });
    // Add event listeners
    listenerController
        .listener(self._controls.drag)
        .add("drag", function (event) {})
        .add("dragstart", function (event) {
            self._controls.camera.enabled = false;
            event.object.userData.dragged = true;
            try {
                nodeController.setNodeEmissive(event.object.uuid, nodeDraggedEmissive);
                bankController.collect(event.object.uuid);
            } catch {
                Logger.error(
                    "DragControls selected a bad node (dragstart): ",
                    event.object,
                    self._controls.drag.objects,
                    self.Managers.Node.nodelist
                );
            }
        })
        .add("dragend", function (event) {
            self._controls.camera.enabled = true;
            event.object.userData.dragged = false;
            try {
                nodeController.resetNodeEmissive(event.object.uuid);
            } catch {
                Logger.error(
                    "DragControls selected a bad node (dragend): ",
                    event.object,
                    self._controls.drag.objects,
                    self.Managers.Node.nodelist
                );
            }
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
            ) {
                overlayController.focusNode(clickedNodeId);
                // attempt to collect currency
                bankController.collect(clickedNodeId);
            } else overlayController.unfocusNode();
        });

    this.Managers.Node = nodeController;
    this.Managers.Overlay = overlayController;
    this.Managers.Listener = listenerController;
    this._updateManagers.always.push(this.Managers.Node, this.Managers.Physics, this.Managers.Overlay);
    this._updateManagers.perTick.push(bankController);
    this._unloadPhase = () => {
        this._resetUpdateManagers();
        this._controls.drag.enabled = false;
        this.Managers.Listener.clear();
        this.Managers.Overlay.clear();
        this.Managers.Physics.deactivate();
        this.Managers.Node.clear();
    };
    this.phase = "build";
    Logger.log("[PhaseManager] | Loaded Build phase");
};

PhaseManager.prototype._updateTick = function (timedelta) {
    this.tick.delta += timedelta;
    if (this.tick.delta < this.tick.interval) return;
    for (
        let t = 0;
        t <= Math.floor(this.tick.delta / this.tick.interval);
        t++
    ) {
        this._updateManagers.perTick.forEach((m) => m.update());
    }
    this.tick.delta = this.tick.delta % this.tick.interval;
};

PhaseManager.prototype.update = function (timedelta) {
    this._updateManagers.always.forEach(m => m.update(timedelta));
    this._updateTick(timedelta);
    // required if controls.enableDamping or controls.autoRotate are set to true
    this._controls.camera.update(); // must be called after any manual changes to the camera"s transform
};

function AttackManagerWrapper() {
    this._attackManagers = [];
    this.push = function (...managers) {
        managers.forEach(m => this._attackManagers.push(m));
    }
    this.clear = function () {
        while (this._attackManagers.length)
            this._attackManagers.pop().clear();
    }
    this.update = function (delta) {
        this._attackManagers.forEach(m => m.update(delta));
    }
    return this;
}