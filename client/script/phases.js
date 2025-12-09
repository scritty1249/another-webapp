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

const selectPhaseBackground = new Color(0x000000);

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

PhaseManager.prototype.selectPhase = function (targets, callbacks) {
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
    this.Managers.World.when("click", function (detail) {
        const last = detail.previous;
        const curr = detail.current;
        const target = detail.target;
        if (target) {
            if (rotateTimeout) clearTimeout(rotateTimeout);
            Logger.log(`Selected target user: `, target);
            callbacks.Attack(target.id);
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
    target,
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
            logic: attackTypes[attack.type].logic
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
            cooldown: attackTypes[_attackType].cooldown
        };
    }
    // init attack managers
    Object.values(attackerTypeData).forEach(typeData => {
        if (typeData.manager) {
            typeData.manager.init(this._scene);
            this.Managers.Attacks.push(typeData.manager);
        }
    });

    Logger.log(attackerTypeData);

    const nodeController = new AttackNodeManager(
        nodeTypes,
        attackerTypeData,
        ...this._constructorArgs.Node
    );
    const overlayController = new AttackOverlayManager(
        target,
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
                overlayController.focusNode(clickedNodeId);
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

PhaseManager.prototype.buildPhase = function (layout) {
    const self = this;
    Logger.info("[PhaseManager] | Loading Build phase");
    this._unloadPhase();
    this.Managers.Physics.activate();
    this._controls.drag.enabled = true;

    const nodeController = new BuildNodeManager(...this._constructorArgs.Node);
    const overlayController = new BuildOverlayManager(
        ...this._constructorArgs.Overlay
    );
    const listenerController = new ListenerManager();

    layoutFromJsonObj(layout, this._scene, this._controls.drag, nodeController);

    overlayController.init(this._controls, {
        Mouse: self.Managers.Mouse,
        Node: nodeController,
    });

    // Add event listeners
    listenerController
        .listener(self._controls.drag)
        .add("drag", function (event) {})
        .add("dragstart", function (event) {
            self._controls.camera.enabled = false;
            event.object.userData.dragged = true;
            try {
                nodeController.highlightNode(event.object.uuid);
            } catch {
                Logger.error(
                    "DragControls selected a bad node: ",
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
                nodeController.unhighlightNode(event.object.uuid);
            } catch {
                Logger.error(
                    "DragControls selected a bad node: ",
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
            )
                overlayController.focusNode(clickedNodeId);
            else overlayController.unfocusNode();
        });

    this.Managers.Node = nodeController;
    this.Managers.Overlay = overlayController;
    this.Managers.Listener = listenerController;
    this._updateManagers.always.push(this.Managers.Node, this.Managers.Physics, this.Managers.Overlay);
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