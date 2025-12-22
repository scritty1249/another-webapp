import { Vector3, Color } from "three";
import * as UTIL from "./utils.js";
import {
    NodeSSOverlay,
    SSFramesMesh,
    SSProgressMesh,
    SSMaskMesh,
    SSNodeSlotsMesh,
} from "./spritesheet.js";
import { DataStore } from "./data.js";

export function NodeManager(
    scene,
    renderer,
    camera,
    raycaster,
    nodeMeshData = {}
) {
    this._scene = scene;
    this._camera = camera;
    this._renderer = renderer;
    this._raycaster = raycaster;
    this._meshData = nodeMeshData;
    if (
        Object.getPrototypeOf(this) === NodeManager.prototype && // don't reinitalize these when subclassing
        this._constructorArgs.some((arg) => arg === undefined)
    ) {
    }
    Object.getOwnPropertyNames(Object.getPrototypeOf(this))
        .filter(
            (prop) => prop !== "constructor" && typeof this[prop] === "function"
        )
        .forEach((prop) => {
            this[prop] = this[prop].bind(this);
        });
    Object.values(this._proxyHandlers).forEach(
        (handler) => (handler._instance = this)
    );
    this.nodes = new Proxy(this._nodes, this._proxyHandlers.nodes);
    this.tethers = new Proxy(this._tethers, this._proxyHandlers.tethers);
    this.nodelist = new Proxy(this._nodelist, this._proxyHandlers.nodelist);
    this.tetherlist = new Proxy(
        this._tetherlist,
        this._proxyHandlers.tetherlist
    );
    this._overlay = {};
    this._overlaylist = [];
    this.overlay = new Proxy(this._overlay, this._proxyHandlers.overlay);
    this.overlaylist = new Proxy(
        this._overlaylist,
        this._proxyHandlers.overlaylist
    );
}

NodeManager.prototype = {
    _proxyHandlers: {
        nodes: {
            set(target, prop, val, receiver) {
                if (Reflect.has(target, prop)) {
                    Logger.throw(
                        new Error(
                            `[NodeManager] | Cannot add new node (${val.userData?.type}): A node (${target[prop].userData?.type}) with UUID ${target[prop].uuid} already exists.`
                        )
                    );
                    return false;
                }
                this._instance._nodelist.push(val);
                this._instance._scene.add(val);
                return Reflect.set(target, prop, val, receiver);
            },
            deleteProperty(target, prop) {
                const node = target[prop];
                // remove connected tethers
                if (node.userData?.tetherlist?.length)
                    node.userData.tetherlist.forEach(
                        (tether) => this._instance.removeTether(tether.uuid)
                    );
                this._instance._scene.remove(node);
                // [!] may be optimizied, see if performance is impacted by this
                this._instance._nodelist.splice(
                    this._instance._nodelist
                        .map((n) => n.uuid)
                        .indexOf(node.uuid),
                    1
                );
                return Reflect.deleteProperty(target, prop);
            },
        },
        tethers: {
            set(target, prop, val, receiver) {
                if (Reflect.has(target, prop)) {
                    Logger.throw(
                        new Error(
                            `[NodeManager] | Cannot add new tether: A tether with UUID ${target[prop].uuid} already exists.`
                        )
                    );
                    return false;
                }
                this._instance._tetherlist.push(val);
                this._instance._scene.add(val);
                return Reflect.set(target, prop, val, receiver);
            },
            deleteProperty(target, prop) {
                const tether = target[prop];
                {
                    const [origin, target] =
                        this._instance._getNodesFromTether(tether);
                    // [!] hoping this just removes the reference and not the actual object
                    delete origin.userData.tethers.origin[prop];
                    delete target.userData.tethers.target[prop];
                }
                this._instance._scene.remove(tether);
                // [!] may be optimizied, see if performance is impacted by this
                this._instance._tetherlist.splice(
                    this._instance._tetherlist
                        .map((t) => t.uuid)
                        .indexOf(tether.uuid),
                    1
                );
                return Reflect.deleteProperty(target, prop);
            },
        },
        nodelist: {
            set(target, prop, val, receiver) {
                if (typeof property === "number") {
                    Logger.throw(
                        new Error(
                            `[NodeManager] | Setting specific index of read-only nodelist is forbidden.`
                        )
                    );
                    return false;
                }
                return Reflect.set(target, prop, val, receiver);
            },
        },
        tetherlist: {
            set(target, prop, val, receiver) {
                if (typeof property === "number") {
                    Logger.throw(
                        new Error(
                            `[NodeManager] | Setting specific index of read-only tetherlist is forbidden.`
                        )
                    );
                    return false;
                }
                return Reflect.set(target, prop, val, receiver);
            },
        },
        overlay: {
            set(target, prop, val, receiver) {
                this._instance._overlaylist.push(val);
                this._instance._scene.add(val);
                return Reflect.set(target, prop, val, receiver);
            },
            deleteProperty(target, prop) {
                const overlay = target[prop];
                if (overlay !== undefined) {
                    this._instance._scene.remove(overlay);
                    // [!] may be optimizied, see if performance is impacted by this
                    this._instance._overlaylist.splice(
                        this._instance._overlaylist
                            .map((o) => o.uuid)
                            .indexOf(overlay.uuid),
                        1
                    );
                }
                return Reflect.deleteProperty(target, prop);
            },
        },
        overlaylist: {
            set(target, prop, val, receiver) {
                if (typeof property === "number") {
                    Logger.throw(
                        new Error(
                            `[BuildNodeManager] | Setting specific index of read-only overlaylist is forbidden.`
                        )
                    );
                    return false;
                }
                return Reflect.set(target, prop, val, receiver);
            },
        },
    },
    _nodes: {},
    _nodelist: [],
    _tethers: {},
    _tetherlist: [],
    overlay: undefined,
    overlaylist: undefined,
    _overlay: undefined,
    _overlaylist: undefined,
    nodes: undefined,
    tethers: undefined,
    nodelist: undefined,
    tetherlist: undefined,
    _lowPerformance: false,
    get lowPerformanceMode() {
        return this._lowPerformance;
    },
    set lowPerformanceMode(bool) {
        if (this._lowPerformance != bool) this._setLowPerformanceMode(bool);
        this._lowPerformance = bool;
    },
    get _constructorArgs() {
        return [
            this._scene,
            this._renderer,
            this._camera,
            this._raycaster,
            this._meshData,
        ];
    },
};
NodeManager.prototype.setNodeEmissive = function (nodeid, emissive) {
    const node = this.getNode(nodeid);
    node.traverse(function (mesh) {
        if (mesh.material?.emissive && mesh.userData.sourceMaterial)
            mesh.material.emissive.set(emissive);
    });
};
NodeManager.prototype.resetNodeEmissive = function (nodeid) {
    const node = this.getNode(nodeid);
    node.traverse(function (mesh) {
        if (mesh.material?.emissive && mesh.userData.sourceMaterial)
            mesh.material.emissive.set(mesh.userData.sourceMaterial.emissive);
    });
};
NodeManager.prototype.setNodeColorTint = function (
    nodeid,
    color,
    strength = 0.65
) {
    const node = this.getNode(nodeid);
    node.traverse(function (mesh) {
        if (mesh.material?.color && mesh.userData.sourceMaterial)
            mesh.material.color.lerpColors(
                mesh.userData.sourceMaterial.color,
                new Color(color),
                strength
            );
    });
};
NodeManager.prototype.resetNodeColorTint = function (nodeid) {
    const node = this.getNode(nodeid);
    node.traverse(function (mesh) {
        if (mesh.material?.color && mesh.userData.sourceMaterial)
            mesh.material.color.set(mesh.userData.sourceMaterial.color);
    });
};
NodeManager.prototype.getCore = function () {
    return this.getTypeNodes("core")?.[0];
};
NodeManager.prototype.getCoreData = function () {
    return this.getCore()?.userData.exportData?.data;
};
NodeManager.prototype.getTypeNodes = function (type) {
    return this.nodelist.filter(n => n.userData.type == type);
};
NodeManager.prototype.centerNodes = function () {
    // get mean node location
    const mean = new Vector3();
    this.nodelist.forEach((node) => mean.add(node.position));
    mean.divideScalar(this.nodelist.length);
    this.nodelist.forEach((node) => node.position.sub(mean));
    this._updateTethers();
};
NodeManager.prototype._getTetherFromNodes = function (originid, targetid) { // doesn't care which is origin or target
    // there should only be one tether between each node
    const tether = this.tetherlist.filter(
        (t) =>
            (
                t.userData.origin.uuid === originid &&
                t.userData.target.uuid === targetid
            ) || (
                t.userData.origin.uuid === targetid &&
                t.userData.target.uuid === originid
            )
    );
    if (!tether.length)
        throw new Error(
            `[NodeManager] | A tether between Nodes "${originid}" and "${targetid}" does not exist.`
        );
    return tether[0]; // there should only be one
};
NodeManager.prototype.isNeighbor = function (originid, targetid) {
    // order does not matter, returns the tether uuid if true
    // there should only be one tether between each node
    const tether = this.tetherlist.filter(
        (t) =>
            (t.userData.origin.uuid === originid &&
                t.userData.target.uuid === targetid) ||
            (t.userData.origin.uuid === targetid &&
                t.userData.target.uuid === originid)
    );
    if (tether.length > 0) return tether[0].uuid;
    return false;
};
NodeManager.prototype.getOtherNode = function (tetherid, nodeid) {
    const tether = this.getTether(tetherid);
    const originid = tether.userData.origin.uuid;
    const targetid = tether.userData.target.uuid;
    return originid == nodeid ? targetid : originid;
};
NodeManager.prototype.getNeighbors = function (nodeid) {
    const node = this.getNode(nodeid);
    return [
        ...Object.values(node.userData.tethers.origin).map(
            (t) => t.userData.target
        ),
        ...Object.values(node.userData.tethers.target).map(
            (t) => t.userData.origin
        ),
    ].filter((n) => n);
};
NodeManager.prototype.traverseTethers = function (nodeid, callback, depth, ignorenodes = []) {
    if (!depth) return;
    this.getNeighbors(nodeid)
        .filter((n) => !ignorenodes.includes(n.uuid))
        .forEach((n) => {
            callback(this._getTetherFromNodes(nodeid, n.uuid), depth, nodeid);
            this.traverseTethers(n.uuid, callback, depth - 1, [...ignorenodes, nodeid])
        });
};
NodeManager.prototype.traverseNodes = function (nodeid, callback, depth, ignorenodes = []) { // similar to traverseTethers, but will actually callback on edges.
    if (!depth) return;
    callback(nodeid, depth);
    this.getNeighbors(nodeid)
        .filter((n) => !ignorenodes.includes(n.uuid))
        .forEach((n) => this.traverseNodes(n.uuid, callback, depth - 1, [...ignorenodes, nodeid]));
};
NodeManager.prototype.getNodes = function (...nodeids) {
    return nodeids.map((nodeid) => this.getNode(nodeid));
};
NodeManager.prototype._getNodesFromTether = function (tether) {
    return [tether.userData.origin, tether.userData.target];
};
NodeManager.prototype._updateAnimations = function (timedelta) {
    this.nodelist.forEach((node) => {
        if (node.userData.updateAnimations)
            node.userData.updateAnimations(timedelta);
    });
};
NodeManager.prototype.getNode = function (nodeid) {
    const node = this.nodes[nodeid];
    if (!node)
        Logger.throw(
            new Error(
                `[NodeManager] | Node with UUID "${nodeid}" does not exist.`
            )
        );
    return node;
};
NodeManager.prototype.createNode = function (
    nodeType,
    position = [0, 0, 0],
    exportData = {}
) {
    const newNode = this._getMesh(nodeType);
    if (newNode.userData.exportData)
        Object.assign(newNode.userData.exportData, exportData);
    else newNode.userData.exportData = exportData;
    newNode.userData._neighborCount = 0;
    if (position.x) newNode.position.set(position.x, position.y, position.z);
    else newNode.position.set(...position);
    this.nodes[newNode.uuid] = newNode;
    Logger.debug(
        `[NodeManager] | Created new Node (${nodeType}): ${newNode.uuid}`
    );
    return newNode.uuid;
};
NodeManager.prototype._getMesh = function (meshName, ...args) {
    if (!Object.keys(this._meshData).includes(meshName))
        Logger.throw(
            new Error(
                `[NodeManager] | Could load mesh of type "${meshName}": No mesh data found.`
            )
        );
    return this._meshData[meshName](...args);
};
NodeManager.prototype.addMeshData = function (meshData) {
    Object.keys(meshData).forEach(
        (nodeType) => (this._meshData[nodeType] = meshData[nodeType])
    );
};
NodeManager.prototype.update = function (timedelta) {
    this._updateOverlays();
    this._updateAnimations(timedelta);
};
NodeManager.prototype.getFlatCoordinateFromNode = function (nodeid) {
    const worldPosition = new Vector3();
    this.getNode(nodeid).getWorldPosition(worldPosition); // Get world position (not local!)
    worldPosition.project(this._camera); // Project to NDC

    const rect = this._renderer.domElement.getBoundingClientRect();

    const screenX = (worldPosition.x * 0.5 + 0.5) * rect.width + rect.left;
    const screenY = (-worldPosition.y * 0.5 + 0.5) * rect.height + rect.top;

    return {
        x: screenX,
        y: screenY,
        distance: this._camera.position.distanceTo(worldPosition),
    };
};
NodeManager.prototype.getNodeFromFlatCoordinate = function (coordinate) {
    // [!] this modifies the raycaster
    this._raycaster.setFromCamera(coordinate, this._camera);
    const intersects = this._raycaster.intersectObjects(this.nodelist, true);
    return intersects.length > 0
        ? intersects[0].object.userData.nodeid
            ? intersects[0].object.userData.nodeid
            : intersects[0].object.userData.uuid
        : undefined;
};
NodeManager.prototype._setLowPerformanceMode = function (low) {
    if (low)
        this.nodelist.forEach((node) =>
            node.userData.state.setLowPerformance()
        );
    else
        this.nodelist.forEach((node) =>
            node.userData.state.setHighPerformance()
        );
};
NodeManager.prototype.clear = function () {
    const nodes = [...this.nodelist];
    const tethers = [...this.tetherlist];
    tethers.forEach((t) => delete this.tethers[t.uuid]);
    nodes.forEach((n) => delete this.nodes[n.uuid]);
    const overlays = [...this.overlaylist];
    overlays.forEach((o) => delete this.overlay[o.uuid]);
    Logger.debug(
        `[NodeManager] | Cleared ${nodes.length} nodes and ${tethers.length} tethers`
    );
};
NodeManager.prototype._tetherNodes = function (origin, target) {
    if (this.isNeighbor(origin.uuid, target.uuid))
        Logger.throw(
            new Error(
                `[NodeManager] | Error: Tether already exists between Nodes ${originid} and ${targetid}`
            )
        );
    else if (origin.uuid == target.uuid)
        Logger.throw(
            new Error(`[NodeManager] | Error: Cannot tether a Node to itself`)
        );
    const tether = this._getMesh("tether", origin, target);
    this.tethers[tether.uuid] = tether;
    return tether;
};
NodeManager.prototype.tetherNodes = function (originid, targetid) {
    const [origin, target] = this.getNodes(originid, targetid);
    if (
        (origin.userData.exportData?.dataConnections === undefined ||
            this.getNeighbors(originid).length <
                origin.userData.exportData?.dataConnections) &&
        (target.userData.exportData?.dataConnections === undefined ||
            this.getNeighbors(targetid).length <
                target.userData.exportData?.dataConnections)
    ) {
        const tether = this._tetherNodes(origin, target);
        if (origin?.userData?._neighborCount !== undefined)
            origin.userData._neighborCount++;
        if (target?.userData?._neighborCount !== undefined)
            target.userData._neighborCount++;
        return tether.uuid;
    } else {
        Logger.warn(
            `[NodeManager] | Cannot tether nodes ${originid} (${origin.userData.type}) and ${targetid} (${target.userData.type}): Connection limit reached for node.`
        );
        return undefined;
    }
};
NodeManager.prototype.getNodeType = function (nodeid) {
    return this.getNode(nodeid)?.userData.type;
};
NodeManager.prototype.removeTether = function (tetherid) {
    const [origin, target] = this._getNodesFromTether(this.tethers[tetherid]);
    if (origin?.userData?._neighborCount !== undefined)
        origin.userData._neighborCount--;
    if (target?.userData?._neighborCount !== undefined)
        target.userData._neighborCount--;
    delete this.tethers[tetherid];
};
NodeManager.prototype.getTether = function (tetherid) {
    const tether = this.tethers[tetherid];
    if (!tether)
        Logger.throw(
            new Error(
                `[NodeManager] | Tether with UUID "${tetherid}" does not exist.`
            )
        );
    return tether;
};
NodeManager.prototype.getTethers = function (nodeid) {
    const node = this.getNode(nodeid);
    return [
        ...Object.values(node.userData.tethers.origin),
        ...Object.values(node.userData.tethers.target)
    ].filter((t) => t);
}
NodeManager.prototype.getDistance = function (originid, targetid) {
    const [origin, target] = this.getNodes(originid, targetid);
    return origin.position.distanceTo(target.position);
};
NodeManager.prototype.getDirection = function (originid, targetid) {
    const [origin, target] = this.getNodes(originid, targetid);
    return new THREE.Vector3().subVectors(origin.position, target.position);
};
NodeManager.prototype.getCameraDirection = function (nodeid) {
    // [!] needs a concise, but DESCRIPTIVE name. come back to this later and do better
    const node = this.getNode(nodeid);
    const nodeWorldPos = new Vector3();
    const cameraWorldPos = new Vector3();
    const direction = new Vector3();
    node.getWorldPosition(nodeWorldPos);
    this._camera.getWorldPosition(cameraWorldPos);
    direction.subVectors(cameraWorldPos, nodeWorldPos);
    direction.normalize();
    return direction;
};
NodeManager.prototype.getCameraDistance = function (nodeid) {
    const node = this.getNode(nodeid);
    const distance = this._camera.position.distanceTo(node.position);
    return distance;
};
NodeManager.prototype.getAngle = function (originid, targetid) {
    // returns in RADIANS
    const [origin, target] = this.getNodes(originid, targetid);
    return origin.position.angleTo(target.position);
};
NodeManager.prototype._updateTethers = function () {
    this.tetherlist.forEach((tether) => {
        if (
            tether.userData.origin.position != tether.userData.vectors.origin ||
            tether.userData.target.position != tether.userData.vectors.target
        ) {
            tether.userData.update();
        }
    });
};
NodeManager.prototype.getStoredCurrency = function (currencyType) {
    const nodes = this.getStorageNodes(currencyType);
    const amount = UTIL.sum(nodes
        .map((n) => n.userData.exportData?.data.amount));
    const total = UTIL.sum(nodes
        .map((n) => n.userData.exportData?.data.max));
    return {
        amount: amount ? amount : 0,
        max: total ? total : 0,
    };
};
NodeManager.prototype.isCurrencyNode = function (nodeid) {
    const node = this.getNode(nodeid);
    if (node?.userData.isCurrencyNode)
        return node.userData.exportData?.data.type;
    return undefined;
};
NodeManager.prototype.isStorageNode = function (nodeid) {
    const node = this.getNode(nodeid);
    if (node?.userData.isStorageNode)
        return node.userData.exportData?.data.type;
    return undefined;
};
NodeManager.prototype.getStorageNodes = function (currencyType) { // returns sorted from most to least empty
    if (!currencyType) return [];
    return this.nodelist.filter(
        (n) => n.userData.isStorageNode &&
            n.userData.exportData?.data?.type == currencyType
    ).toSorted(
        (a, b) =>
            (b.userData.exportData?.data.max -
                b.userData.exportData?.data.amount) -
            (a.userData.exportData?.data.max -
                a.userData.exportData?.data.amount)
    );
};
NodeManager.prototype.getCurrencyNodes = function (currencyType) { // returns sorted from most to least empty
    if (!currencyType) return [];
    return this.nodelist.filter(
        (n) => n.userData.isCurrencyNode &&
            n.userData.exportData?.data?.type == currencyType
    ).toSorted(
        (a, b) =>
            (b.userData.exportData?.data.max -
                b.userData.exportData?.data.amount) -
            (a.userData.exportData?.data.max -
                a.userData.exportData?.data.amount)
    );
};
NodeManager.prototype.getCurrencyData = function (nodeid) {
    if (!this.isCurrencyNode(nodeid))
        Logger.throw(
            new Error(
                `[NodeManager] | Failed to get currency data from node ${nodeid}: Not a currency node.`
            )
        );
    const node = this.getNode(nodeid);
    return node.userData.exportData?.data;
};
NodeManager.prototype.getStorageData = function (nodeid) {
    if (!this.isStorageNode(nodeid))
        Logger.throw(
            new Error(
                `[NodeManager] | Failed to get currency storage data from node ${nodeid}: Not a storage node.`
            )
        );
    const node = this.getNode(nodeid);
    return node.userData.exportData?.data;
};
NodeManager.prototype._updateOverlays = function () {
    this.overlaylist.forEach((overlay) => {
        overlay.userData.update(this._camera);
    });
};
NodeManager.prototype.getOverlay = function (overlayid) {
    const overlay = this.overlay[overlayid];
    if (!overlay)
        Logger.throw(
            new Error(
                `[NodeManager] | Overlay of UUID ${overlayid} does not exist.`
            )
        );
    return overlay;
};
NodeManager.prototype.getOverlayByTarget = function (targetid) {
    const overlay = this.overlaylist.filter(
        (o) => o.userData.target.uuid == targetid
    )?.[0];
    if (!overlay)
        Logger.throw(
            new Error(
                `[NodeManager] | Overlay with Node target of UUID ${targetid} does not exist.`
            )
        );
    return overlay;
};
NodeManager.prototype.validateLayout = function (maxGlobeDistance) {
    if (
        this.nodelist.length == 1 &&
        this.getCore()
    ) return true;
    const foundNodes = new Set();
    const _collectNodes = (id) => {
        foundNodes.add(id);
    };
    const _nodes = new Set(this.nodelist.map(n => n.uuid));
    this.getTypeNodes("globe")
        .forEach((n) => this.traverseNodes(n.uuid, _collectNodes, maxGlobeDistance + 1));
    const isValid = foundNodes.size == _nodes.size && this.getCore();
    if (!isValid) {
        Logger.info("[NodeManager] | Layout invalid!",
            "\n\tFound Core: ", this.getCore(),
            "\n\tFound extra nodes:", foundNodes.difference(_nodes),
            "\n\tDidn't find nodes:", _nodes.difference(foundNodes)
        );
    }
    return isValid;
};

export function AttackNodeManager(
    phaseCallback,
    attackTypeData = {},
    ...parentArgs
) {
    NodeManager.call(this, ...parentArgs);
    this._phaseCallback = phaseCallback;
    this._attackTypeData = attackTypeData;
    this._nodedata = {};
    this._attacks = {};
    this._attacklist = [];
    this.nodedata = new Proxy(this._nodedata, this._proxyHandlers.nodedata);
    this.attacks = new Proxy(this._attacks, this._proxyHandlers.attacks);
    this.attacklist = new Proxy(
        this._attacklist,
        this._proxyHandlers.attacklist
    );
    // init data for existing nodes
    Object.values(this.nodes).forEach((node) => this._addNodeData(node));
}
AttackNodeManager.prototype = Object.create(NodeManager.prototype);
AttackNodeManager.prototype.constructor = AttackNodeManager;
AttackNodeManager.prototype._proxyHandlers = {
    ...AttackNodeManager.prototype._proxyHandlers,
    nodes: {
        set(target, prop, val, receiver) {
            if (Reflect.has(target, prop)) {
                Logger.throw(
                    new Error(
                        `[NodeManager] | Cannot add new node (${val.userData?.type}): A node (${target[prop].userData?.type}) with UUID ${target[prop].uuid} already exists.`
                    )
                );
                return false;
            } else {
                const result = Reflect.set(target, prop, val, receiver);
                this._instance._nodelist.push(val);
                this._instance._scene.add(val);
                this._instance._addNodeData(val);
                return result;
            }
        },
        deleteProperty(target, prop) {
            const node = target[prop];
            // remove connected tethers
            if (node.userData?.tetherlist?.length)
                node.userData.tetherlist.forEach(
                    (tether) => delete this._instance.tethers[tether.uuid]
                );
            this._instance._scene.remove(node);
            // [!] may be optimizied, see if performance is impacted by this
            this._instance._nodelist.splice(
                this._instance._nodelist.map((n) => n.uuid).indexOf(node.uuid),
                1
            );
            delete this._instance._nodedata[prop];
            return Reflect.deleteProperty(target, prop);
        },
    },
    nodedata: {
        set(target, prop, val, receiver) {
            Logger.throw(
                new Error(
                    `[AttackNodeManager] | Overwriting node entries in read-only nodedata is forbidden.`
                )
            );
            return false;
        },
        deleteProperty(target, prop) {
            Logger.throw(
                new Error(
                    `[AttackNodeManager] | Deleting node entries in read-only nodedata is forbidden.`
                )
            );
            return false;
        },
    },
    attacks: {
        set(target, prop, val, receiver) {
            if (Reflect.has(target, prop)) {
                Logger.throw(
                    new Error(
                        `[AttackNodeManager] | Cannot add new attack (${val.type}): An attack (${target[prop].type}) with UUID ${target[prop].uuid} already exists.`
                    )
                );
                return false;
            }
            this._instance._attacklist.push(val);
            val.update();
            return Reflect.set(target, prop, val, receiver);
        },
        deleteProperty(target, prop) {
            const attack = target[prop];
            if (attack?.type !== undefined) {
                attack.halt();
                // [!] may be optimizied, see if performance is impacted by this
                this._instance._attacklist.splice(
                    this._instance._attacklist
                        .map((a) => a.uuid)
                        .indexOf(attack.uuid),
                    1
                );
            }
            return Reflect.deleteProperty(target, prop);
        },
    },
    attacklist: {
        set(target, prop, val, receiver) {
            if (typeof property === "number") {
                Logger.throw(
                    new Error(
                        `[AttackNodeManager] | Setting specific index of read-only attacklist is forbidden.`
                    )
                );
                return false;
            }
            return Reflect.set(target, prop, val, receiver);
        },
    },
};
AttackNodeManager.prototype._attackTypeData = undefined;

AttackNodeManager.prototype._nodedata = undefined;
AttackNodeManager.prototype._attacks = undefined;
AttackNodeManager.prototype._attacklist = undefined;
AttackNodeManager.prototype.nodedata = undefined;
AttackNodeManager.prototype.attacks = undefined;
AttackNodeManager.prototype.attacklist = undefined;

AttackNodeManager.prototype._addNodeData = function (node) {
    // [!] never call this outside of proxy handler and constructor
    try {
        this._nodedata[node.uuid] = NodeDataFactory(node.uuid, this);
        if (!this.nodedata[node.uuid].isFriendly) {
            if (node.userData.type == "cube")
                this.addAttackToNode("cubedefense", node.uuid);
        }
    } catch (err) {
        Logger.error(
            `[AttackNodeManager] | Error while creating node data for type: ${node.userData.type}.`
        );
        Logger.throw(err);
    }
};
AttackNodeManager.prototype.addAttackData = function (attackData) {
    Object.keys(attackData).forEach(
        (attackType) =>
            (this._attackTypeData[attackType] = attackData[attackType])
    );
};
AttackNodeManager.prototype.getAttack = function (attackid) {
    const attack = this.attacks[attackid];
    if (!attack)
        Logger.throw(
            new Error(
                `[AttackNodeManager] | Attack with UUID "${attackid}" does not exist.`
            )
        );
    return attack;
};
AttackNodeManager.prototype.createAttack = function (originid, typeData) {
    const attack = AttackFactory(typeData, originid, this);
    this.attacks[attack.uuid] = attack;
    return attack.uuid;
};
AttackNodeManager.prototype.getNodeData = function (nodeid) {
    const nodeData = this.nodedata[nodeid];
    if (!nodeData) {
        if (this.nodes[nodeid])
            Logger.warn(
                `[AttackNodeManager] | Node with UUID ${nodeid} exists, but has no node data!`
            );
        Logger.throw(
            new Error(
                `[AttackNodeManager] | Data for node with UUID ${nodeid} does not exist.`
            )
        );
    }
    return nodeData;
};
AttackNodeManager.prototype._getAttackTypeData = function (attackType) {
    if (!this._attackTypeData.hasOwnProperty(attackType))
        Logger.throw(
            new Error(
                `[AttackNodeManager] | Could not retrieve attack data for type "${attackType}"`
            )
        );
    return this._attackTypeData[attackType];
};
AttackNodeManager.prototype.isAllNodesFriendly = function () {
    return Object.values(this.nodedata).every(n => n.friendly);
};
AttackNodeManager.prototype.setNodeFriendly = function (nodeid) {
    const node = this.getNode(nodeid);
    const nodeData = this.getNodeData(nodeid);
    const nodeTypeData = CONFIG.NODES[node.userData.type].attack;
    nodeData.slots.clear();
    if (node.userData.type != "globe") {
        nodeData.friendly = true;
        nodeData.hp.set(
            nodeTypeData.health.base + Math.floor(
                nodeTypeData.health.increase * node.userData.exportData.level
            )
        / 2);
        nodeData.state.reset();
        nodeData.lastHit.reset();
        node.userData._altMaterials.apply(node);
    }
    if (this.isAllNodesFriendly()) // check for win condition
        this._phaseCallback();
};
AttackNodeManager.prototype.setNodeEnemy = function (nodeid) {
    const node = this.getNode(nodeid);
    const nodeData = this.getNodeData(nodeid);
    const nodeTypeData = CONFIG.NODES[node.userData.type];
    nodeData.slots.clear();
    if (node.userData.type == "cube")
        this.addAttackToNode("cubedefense", node.uuid);
    if (node.userData.type != "globe") {
        nodeData.friendly = false;
        nodeData.hp.set(
            nodeTypeData.health.base + Math.floor(
                nodeTypeData.health.increase * node.userData.exportData.level
            )
        );
        nodeData.state.reset();
        nodeData.lastHit.reset();
        node.userData.materials.apply(node);
    }
};
AttackNodeManager.prototype._initAlternateMaterials = function (node) {
    const table = node.userData.materials;
    const altTable = table.clone();
    const altTint = new Color(CONFIG.FRIENDLY_NODE_TINT);
    Object.values(altTable.index).forEach(({material}) => {
        material.emissive.set(CONFIG.FRIENDLY_NODE_COLOR);
        material.color.lerpColors(
            material.color,
            altTint,
            0.8
        );
    });
    node.userData._altMaterials = altTable;
};
AttackNodeManager.prototype.createNode = function (...args) {
    const nodeid = NodeManager.prototype.createNode.call(this, ...args);
    const OverlayData = DataStore.NodeOverlay.Attack;
    try {
        const node = this.getNode(nodeid);
        { // save original colors, for swapping with alternate color (friendly / enemy)
            this._initAlternateMaterials(node);

        }
        const overlay = NodeSSOverlay(node);
        { // node specific overlays
            const storageType = this.isStorageNode(nodeid);
            const nodeType = this.getNodeType(nodeid);
            if (storageType) {
                const oMoneyStorageMesh = SSMaskMesh(
                    OverlayData[storageType].geometry,
                    OverlayData[storageType].material.clone()
                );
                overlay.userData.addChild(
                    "bar",
                    oMoneyStorageMesh,
                    OverlayData[storageType].offset
                );
                node.userData.exportData.data.max = node.userData.exportData?.data.amount;
            } else if (nodeType == "core") {
                const oCoreDownload = SSMaskMesh(
                    OverlayData[nodeType].geometry,
                    OverlayData[nodeType].material.clone()
                );
                overlay.userData.addChild(
                    "bar",
                    oCoreDownload,
                    OverlayData[nodeType].offset
                );
                node.userData.exportData.data.download.amount = node.userData.exportData?.data.download.max;
            }
        }
        const oHealthMesh = SSProgressMesh(
            OverlayData.health.geometry,
            OverlayData.health.material.clone()
        );
        overlay.userData.addChild(
            "health",
            oHealthMesh,
            OverlayData.health.offset
        );
        this.overlay[overlay.uuid] = overlay;
    } catch (err) {
        Logger.error(
            `[AttackNodeManager] | Failed to create overlay for node ${nodeid}: Missing node overlay data from `,
            OverlayData
        );
        Logger.debug(err);
    } finally {
        return nodeid;
    }
};
AttackNodeManager.prototype.getAllAttacksFrom = function (nodeid) {
    return this.attacklist.filter((attack) => attack.origin == nodeid);
};
AttackNodeManager.prototype.getAllAttacksTo = function (nodeid) {
    return this.attacklist.filter((attack) => attack.target == nodeid);
};
AttackNodeManager.prototype.addAttackToNode = function (attackType, nodeid) {
    const nodeData = this.getNodeData(nodeid);
    const typeData = this._getAttackTypeData(attackType);
    if (nodeData.slots.empty >= 1) {
        if (typeData.canAdd(nodeData)) {
            nodeData.slots.push({
                uuid: this.createAttack(nodeid, typeData),
                type: attackType,
            });
            Logger.debug(
                `[AttackNodeManager] | Added new Attack (${
                    nodeData.slots.at(-1).uuid
                }) to Node (${nodeid})`
            );
            return true;
        } else
            Logger.warn(
                `[AttackNodeManager] | Cannot add attacker: Node (${nodeid}) state does not meet attacker prerequisites.`
            );
    } else
        Logger.warn(
            `[AttackNodeManager] | Cannot add attacker: Node (${nodeid}) is limited to ${nodeData.slots.length} slots.`
        );
    return false;
};
AttackNodeManager.prototype._updateOverlays = function () {
    NodeManager.prototype._updateOverlays.call(this);
    this.overlaylist.forEach((overlay) => {
        const node = overlay.userData.target;
        const nodeData = this.getNodeData(node.uuid);
        const healthPercent = nodeData.hp.health / nodeData.hp.maxHealth;
        overlay.userData.children.health.userData.progress = healthPercent;
        overlay.userData.children.health.visible = healthPercent != 1;
        if (this.isStorageNode(node.uuid)) {
            const heldPercent = node.userData.exportData?.data.amount /
                    node.userData.exportData?.data.max;
            overlay.userData.children.bar.userData.maskOffset.x = 1 - heldPercent;
            overlay.userData.children.bar.visible = heldPercent != 0 && nodeData.isFriendly;
        } else if (this.getNodeType(node.uuid) == "core") {
            const heldPercent = node.userData.exportData?.data.download.amount /
                    node.userData.exportData?.data.download.max;
            overlay.userData.children.bar.userData.maskOffset.x = 1 - heldPercent;
            overlay.userData.children.bar.visible = heldPercent != 0 && nodeData.isFriendly;
        }
    });
};
AttackNodeManager.prototype._updateAnimations = function (timedelta) {
    this.nodelist.forEach((node) => {
        if (node.userData.updateAnimations) {
            const data = this.getNodeData(node.uuid);
            if (!data.state.disabled.active)
                node.userData.updateAnimations(
                    (data.isFriendly && node.userData.type != "globe"
                        ? 0.4
                        : 1) * timedelta
                );
        }
    });
};
AttackNodeManager.prototype._updateNodeData = function () { // should be handled seperately, per tick.
    this.nodelist.forEach((node) => {
        const nodeData = this.getNodeData(node.uuid);
        const typeData = CONFIG.NODES[node.userData.type].attack;
        // apply regen
        if (
            nodeData.hp.health < nodeData.hp.maxHealth &&
            nodeData.timeSinceLastHit > CONFIG.ATTACK_NODE_REGEN_DELAY
        )
            nodeData.hp.applyHeal(nodeData.hp.maxHealth * typeData.regen);
    });
};
AttackNodeManager.prototype._updateAttacks = function () {
    this.attacklist.forEach((attack) => attack.update());
};
AttackNodeManager.prototype.updateTick = function () { // not called by update method
    this._updateNodeData();
};
AttackNodeManager.prototype.update = function (timedelta) {
    NodeManager.prototype.update.call(this, timedelta);
    this._updateAttacks(timedelta);
};
AttackNodeManager.prototype.clear = function () {
    NodeManager.prototype.clear.call(this);
    this.attacklist.forEach((a) => delete this.attacks[a.uuid]);
    delete this._attackTypeData;
    delete this._nodedata;
    delete this.attacks;
    delete this.attacklist;
    delete this._attacks;
    delete this._attacklist;
};

export function BuildNodeManager(onAttackCompileCallback, ...parentArgs) {
    NodeManager.call(this, ...parentArgs);
    this._attackCompiledCallback = onAttackCompileCallback;
}
BuildNodeManager.prototype = Object.create(NodeManager.prototype);
BuildNodeManager.prototype.constructor = BuildNodeManager;
BuildNodeManager.prototype._proxyHandlers = {
    ...BuildNodeManager.prototype._proxyHandlers,
};
BuildNodeManager.prototype.createNode = function (...args) {
    const nodeid = NodeManager.prototype.createNode.call(this, ...args);
    const OverlayData = DataStore.NodeOverlay.Build;
    try {
        const node = this.getNode(nodeid);
        const overlay = NodeSSOverlay(node);
        { // node specific overlays
            const currencyType = this.isCurrencyNode(nodeid); // may be undefined (intentional), this function returns a string of currency type instead of just true.
            const storageType = this.isStorageNode(nodeid);
            if (currencyType) {
                const oMoneyBarMesh = SSMaskMesh(
                    OverlayData[currencyType].geometry,
                    OverlayData[currencyType].material.clone()
                );
                overlay.userData.addChild(
                    "bar",
                    oMoneyBarMesh,
                    OverlayData[currencyType].offset
                );
            } else if (storageType) {
                const oMoneyStorageMesh = SSMaskMesh(
                    OverlayData[storageType].geometry,
                    OverlayData[storageType].material.clone()
                );
                overlay.userData.addChild(
                    "bar",
                    oMoneyStorageMesh,
                    OverlayData[storageType].offset
                );
            }
        }
        const oSlotsMesh = SSNodeSlotsMesh(
            OverlayData.slots.geometry,
            OverlayData.slots.material.clone(),
            OverlayData.slots.tiles
        );
        if (node.userData.exportData?.maxConnections)
            oSlotsMesh.userData.slots = node.userData.exportData?.maxConnections;
        overlay.userData.addChild(
            "slots",
            oSlotsMesh,
            OverlayData.slots.offset
        );
        this.overlay[overlay.uuid] = overlay;
    } catch (err) {
        Logger.error(
            `[BuildNodeManager] | Failed to create overlay for currency node ${nodeid}: Missing node overlay data from `,
            OverlayData
        );
        Logger.warn(err);
    } finally {
        return nodeid;
    }
};
BuildNodeManager.prototype.getBarracksNodes = function () { // might not be needed
    return this.getTypeNodes("barracks")
        .toSorted((a, b) =>
            this.getBarracksSpace(b.uuid) - this.getBarracksSpace(a.uuid));
};
BuildNodeManager.prototype.getBarracksData = function (nodeid) {
    const node = this.getNode(nodeid);
    if (node?.userData?.type != "barracks")
        Logger.throw(
            new Error(
                `[BuildNodeManager] | Failed to get barracks data from node ${nodeid}: Not a barracks node.`
            )
        );
    return node.userData.exportData?.data;
};
BuildNodeManager.prototype.removeCompilingAttack = function (nodeid, slotKey) {
    const botnetData = this.getBotnetData(nodeid);
    botnetData.active[slotKey].type = undefined; // lazy, dont "need" to reset all of it...
};
BuildNodeManager.prototype.removeQueuedAttack = function (nodeid, queueIdx) {
    const botnetData = this.getBotnetData(nodeid);
    botnetData.queue.splice(queueIdx, 1);
};
BuildNodeManager.prototype.getBotnetData = function (nodeid) {
    const node = this.getNode(nodeid);
    if (node?.userData?.type != "botnet")
        Logger.throw(
            new Error(
                `[BuildNodeManager] | Failed to get botnet data from node ${nodeid}: Not a botnet node.`
            )
        );
    return node.userData.exportData?.data;
};
BuildNodeManager.prototype.getBarracksCapacity = function () { // gets total capacity
    return UTIL.sum(this.getBarracksNodes().map((n) => n.userData.exportData?.data ? n.userData.exportData?.data.max : 0));
};
BuildNodeManager.prototype.queueCompile = function (nodeid, attackType, compileDuration) { // train attack
    const botnetData = this.getBotnetData(nodeid);
    botnetData.queue.push({
        type: attackType,
        duration: compileDuration
    });
};
BuildNodeManager.prototype._updateCurrencyNodes = function () {
    // doesn't go off of timedelta- more accurate / convienient just use current time
    const now = UTIL.getNowUTCSeconds();
    this.nodelist
        .filter(n => n.userData.exportData?.data)
        .forEach((node) => {
            const currencyData = node.userData.exportData?.data;
            if (currencyData.amount != currencyData.max && currencyData.rate) {
                const elapsedSeconds = Math.max(0, now - currencyData.lastUpdated);
                const ratePerSecond = currencyData.rate / 60 / 60; // stored rate is per hour
                const amountGenerated = Math.floor(elapsedSeconds * ratePerSecond); // avoid floating points for sanity
                const newAmount = Math.min(
                    currencyData.max,
                    currencyData.amount + amountGenerated
                );
                if (newAmount != currencyData.amount) {
                    currencyData.amount = newAmount;
                    currencyData.lastUpdated = now;
                }
            }
        });
};
BuildNodeManager.prototype._updateBotnetNodes = function () {
    const now = UTIL.getNowUTCSeconds();
    this.getTypeNodes("botnet")
        .forEach((node) => this._updateBotetNode(node, now));
};
BuildNodeManager.prototype._updateBotetNode = function (node, now) {
    const trainingData = node.userData.exportData?.data;
    Object.entries(trainingData.active).forEach(([idx, {type, started, duration}]) => {
        if (type && started + duration > now) return;
        if (type) {
            Logger.info("[BuildNodeManager] | Finished compiling attack: ", type);
            this._attackCompiledCallback(type);
        }
        const next = trainingData.queue.pop();
        if (next) {
            trainingData.active[idx].type = next.type;
            trainingData.active[idx].duration = next.duration;
            trainingData.active[idx].started = now;
            Logger.info("[BuildNodeManager] | Started compiling: ", next);
        } else {
            trainingData.active[idx].type = undefined;
            trainingData.active[idx].duration = 0;
            trainingData.active[idx].started = 0;
        }
    });
};
BuildNodeManager.prototype.collectCurrencyNode = function (nodeid) {
    const node = this.getNode(nodeid);
    if (!this.isCurrencyNode(nodeid))
        Logger.throw(
            new Error(
                `[BuildNodeManager] | Cannot collect from node ${nodeid} (${node.userData.type}): Not a currency Node.`
            )
        );
    const currencyData = node.userData.exportData?.data;
    const storageData = this.getStoredCurrency(currencyData.type);
    if (storageData.max <= storageData.amount) return false;
    const amount = currencyData.amount;
    if (amount > 0) {
        currencyData.amount = 0;
        currencyData.lastUpdated = UTIL.getNowUTCSeconds();
        this.addCurrency(currencyData.type, Math.min(amount, storageData.max));
        return true;
    }
    return false;
};
BuildNodeManager.prototype.addCurrency = function (currencyType, amount) {
    const nodes = this.getStorageNodes(currencyType);
    let nodeIdx = 0;
    let remaining = amount;
    while (remaining && nodeIdx < nodes.length) {
        if (nodes[nodeIdx].userData.exportData?.data.amount >= nodes[nodeIdx].userData.exportData?.data.max) {
            nodeIdx++;
            continue;
        }
        nodes[nodeIdx].userData.exportData.data.amount++;
        remaining--;
    }
    return remaining;
};
BuildNodeManager.prototype.removeCurrency = function (currencyType, amount) {
    const nodes = this.getStorageNodes(currencyType);
    const currencyData = this.getStoredCurrency(currencyType);
    if (currencyData.amount - amount < 0)
        Logger.throw(
            new Error(
                `[BuildNodeManager] | Cannot remove ${amount} ${currencyType}: Insufficient balance.`
            )
        );
    let nodeIdx = 0;
    let remaining = amount;
    while (remaining && nodeIdx < nodes.length) {
        if (nodes[nodeIdx].userData.exportData?.data.amount <= 0) nodeIdx++;
        nodes[nodeIdx].userData.exportData.data.amount--;
        remaining--;
    }
    if (remaining) Logger.info(`[BuildNodeManager] | Lost ${remaining} execess ${currencyType} after attempting to add ${amount} ${currencyType}.`);
    return remaining;
};
BuildNodeManager.prototype._updateOverlays = function () {
    NodeManager.prototype._updateOverlays.call(this);
    this.overlaylist.forEach((overlay) => {
        const node = overlay.userData.target;
        overlay.userData.children.slots.userData.filled =
            overlay.userData.target.userData._neighborCount;
        if (this.isCurrencyNode(node.uuid))
            overlay.userData.children.bar.userData.maskOffset.x =
                1 -
                node.userData.exportData?.data.amount /
                    node.userData.exportData?.data.max;
        else if (this.isStorageNode(node.uuid))
            overlay.userData.children.bar.userData.maskOffset.x =
                1 -
                node.userData.exportData?.data.amount /
                    node.userData.exportData?.data.max;
    });
};
BuildNodeManager.prototype.untetherNodes = function (originid, targetid) {
    const tether = this._getTetherFromNodes(originid, targetid);
    this.removeTether(tether.uuid);
};
BuildNodeManager.prototype.untetherNode = function (nodeid) {
    const node = this.getNode(nodeid);
    node.userData.tetherlist.forEach((t) => this.removeTether(t.uuid));
};
BuildNodeManager.prototype.removeNode = function (nodeid) {
    // redistribute money, if this is a storage node
    const isStorage = this.isStorageNode(nodeid);
    let typeStored;
    let amountStored;
    if (isStorage) {
        const storageData = this.getStorageData(nodeid);
        typeStored = storageData.type;
        amountStored = storageData.amount;
        this.removeCurrency(typeStored, amountStored);
    }
    const overlay = this.getOverlayByTarget(nodeid);
    if (overlay) delete this.overlay[overlay.uuid];
    delete this.nodes[nodeid];
    if (isStorage) this.addCurrency(typeStored, amountStored);
};
BuildNodeManager.prototype.update = function (timedelta) {
    NodeManager.prototype.update.call(this, timedelta);
    this._updateCurrencyNodes();
    this._updateBotnetNodes();
    this._updateTethers();
};
BuildNodeManager.prototype.clear = function () {
    NodeManager.prototype.clear.call(this);
    
};

function AttackFactory(typeData, originid, nodeManager) {
    const nodeData = nodeManager.getNodeData(originid);
    const attackManager = typeData.manager;
    const attackid = attackManager.userData.createAttack();
    const attackUserData = attackManager.getUserData(attackid);
    const attackOptionData = attackManager.getOptions(attackid);

    attackUserData.setOrigin(nodeManager.getNode(originid)?.position);
    const attack = Object.create({
        data: {
            options: attackOptionData,
            userData: attackUserData,
        },
        _target: undefined,
        type: attackManager.attackType,
        origin: originid,
        friendly: nodeData.isFriendly,
        uuid: attackid,
        damage: typeData.damage,
        cooldown: typeData.cooldown, // ms
        logic: typeData.logic(),
        active: false,
        waitCooldown: false,
        get visible() {
            return attackOptionData.visible;
        },
        set visible(value) {
            if (value) attackManager.show(attackid);
            else attackManager.hide(attackid);
        },
        get target() {
            return this._target;
        },
        set target(nodeid) {
            this._target = nodeid;
            if (nodeid) {
                this.active = true;
                this.data.userData.setTarget(
                    nodeManager.getNode(nodeid)?.position
                );
                this.data.options.callback = function (_) {
                    if (attack.active) {
                        try {
                            const targetData = nodeManager.getNodeData(
                                attack.target
                            );
                            if (!targetData.damage(attack.damage))
                                typeData.effect(nodeManager, attackid);
                            attack.update();
                            if (attack.active) {
                                attack.visible = false;
                                const wait = attack.waitCooldown
                                    ? attack.cooldown
                                    : 0;
                                setTimeout(() => {
                                    if (attack.active)
                                        attackManager.restartPlayback(attackid);
                                }, wait);
                            }
                        } catch (err) {
                            Logger.warn(err.message);
                        }
                    }
                };
                attackManager.restartPlayback(attackid);
                attack.waitCooldown = true;
            } else {
                this.active = false;
                this.visible = false;
                this.waitCooldown = false;
            }
        },
        update: function () {
            // assumes enabled
            if (
                !this.active ||
                !this.target ||
                !nodeManager.getNodeData(this.origin)?.canAttack(this.target)
            )
                this.target = this.logic.target(
                    nodeManager.getNodeData(this.origin)?.attackableNeighbors
                );
        },
        halt: function () {
            this.active = false;
            attackManager.userData.removeAttack(attackid);
        },
    });
    return attack;
}

function NodeDataFactory(nodeid, manager) {
    const node = manager.getNode(nodeid);
    const nodeLevel = node?.userData.exportData?.level;
    const typeData = CONFIG.NODES[node.userData.type].attack;
    const obj = Object.create({
        state: {
            disabled: StatusEffectFactory(),
            reset: function () {
                this.disabled.reset();
            },
        },
        get neighbors() {
            // gets nodedata only
            try {
                const neighbors = manager
                    .getNeighbors(obj.uuid)
                    ?.map((n) => manager.getNodeData(n.uuid));
                return neighbors ? neighbors : [];
            } catch (err) {
                Logger.warn(err.message);
                return [];
            }
        },
        get isDead() {
            return obj.hp.total <= 0;
        },
        get isFriendly() {
            return obj.friendly;
        },
        get isAttackable() {
            return (
                this.neighbors.some((nd) => nd.isFriendly) && !this.isFriendly
            );
        },
        get attackableNeighbors() {
            return this.state.disabled.active
                ? []
                : this.neighbors.filter(
                      (nd) => nd.isFriendly != this.isFriendly && !nd.isDead
                  );
        },
        get timeSinceLastHit () {
            return UTIL.getNowUTCSeconds() - this.lastHit.timestamp;
        },
        canAttack: function (targetid) {
            return (
                this.attackableNeighbors.filter((nd) => nd.uuid == targetid)
                    .length > 0
            );
        },
        damage: function (value, source = undefined) {
            this.lastHit.timestamp = UTIL.getNowUTCSeconds();
            this.lastHit.source = source;
            this.hp.applyDamage(value);
            Logger.debug(`Dealt ${value} damage to node ${this.uuid}`);
            if (this.isDead) {
                [
                    ...manager.getAllAttacksFrom(this.uuid),
                    ...manager.getAllAttacksTo(this.uuid),
                ].forEach((attack) => (attack.active = false));
                if (this.isFriendly) manager.setNodeEnemy(this.uuid);
                else manager.setNodeFriendly(this.uuid);
                return true;
            }
            return false;
        },
        lastHit: {
            source: undefined,
            timestamp: 0,
            reset: function () {
                this.source = undefined;
                this.timestamp = 0;
            },
        },
        uuid: nodeid,
        friendly: node.userData.type == "globe",
        hp: NodeHealthFactory(
            Math.floor(typeData.health.base + (typeData.health.increase * nodeLevel))
        ),
        _numSlots: Math.floor(typeData.slots.base + (typeData.slots.increase * nodeLevel)),
        get numSlots() {
            return this._numSlots;
        },
        set numSlots(length) {
            const oldlength = this._numSlots;
            this._numSlots = length;
            if (oldlength > this._numSlots)
                this.slots.splice(this._numSlots, oldlength - this._numSlots);
            else if (oldlength < this._numSlots) this.slots.fillempty();
        },
        get attackers() {
            return this.slots.filter((a) => a.uuid != undefined);
        },
        slots: Array.from({ length: Math.floor(typeData.slots.base + (typeData.slots.increase * nodeLevel)) }, () => {
            return { uuid: undefined, type: undefined };
        }),
    });
    Object.defineProperty(obj.slots, "empty", {
        get: function () {
            return obj.slots.filter((a) => a.uuid == undefined).length;
        },
    });
    Object.defineProperty(obj.slots, "filled", {
        get: function () {
            return obj.slots.filter((a) => a.uuid != undefined).length;
        },
    });
    obj.slots.pop = function (index) {
        const idx = Number(index);
        if (isNaN(idx) || idx < 0 || idx >= obj.slots.length) {
            Logger.warn(`Invalid index for deletion: ${idx}`);
            return false;
        }
        // stop that attack
        delete manager.attacks[obj.slots[idx].uuid];
        // shift everything down
        obj.slots.splice(idx, 1);
        obj.slots[obj.slots.length] = { uuid: undefined, type: undefined };
        return true;
    };
    obj.slots.push = function (...args) {
        if (args.length + obj.slots.filled <= obj.numSlots)
            args.forEach((arg, i) => (obj.slots[obj.slots.filled + i] = arg));
        else {
            args.forEach((arg) => delete manager.attacks[arg.uuid]);
            Logger.error(
                `Cannot add attacker(s): Node is limited to ${obj.numSlots} slots.`
            );
            return false;
        }
        return true;
    };
    obj.slots.fillempty = function () {
        for (let i = Math.max(0, obj.slots.filled - 1); i < obj._slots; i++)
            obj.slots[i] = { uuid: undefined, type: undefined };
    };
    obj.slots.clear = function () {
        while (obj.slots.filled > 0) {
            obj.slots.pop(0);
        }
    };

    return obj;
}

function NodeHealthFactory(maxHealth) {
    return Object.create({
        _health: {
            max: maxHealth,
            current: maxHealth,
        },
        _shield: {
            current: 0,
        },
        set: function (health) {
            this._health.max = health;
            this._health.current = health;
            this._shield.current = 0;
        },
        get total() {
            return this.health + this.shield;
        },
        get shield() {
            return this._shield.current;
        },
        set shield(value) {
            this._shield.current = Math.max(0, value);
        },
        get health() {
            return this._health.current;
        },
        set health(value) {
            this._health.current = UTIL.clamp(value, 0, this.maxHealth);
        },
        get maxHealth() {
            return this._health.max;
        },
        // [!] ugly as hell, fix this soon!
        applyDamage: function (value) {
            // should be a positive value
            let damage = Math.abs(value);
            let shieldExcess = this.shield - damage;
            this.shield = shieldExcess;
            if (shieldExcess < 0) {
                let healthExcess = this.health + shieldExcess;
                this.health = healthExcess;
                if (healthExcess < 0) return Math.abs(healthExcess); // returns the extra damage, for easier callbacks later
            }
            return 0;
        },
        applyHeal: function (value) {
            // should be a positive value
            let heal = Math.abs(value);
            let excess = Math.abs(
                Math.min(0, this.maxHealth - (this.health + heal))
            );
            this.health += heal;
            return excess; // returns overhealing, for easier callbacks later
        },
        applyShield: function (value) {
            // should be a positive value
            let shield = Math.abs(value);
            this.shield += shield;
        },
    });
}

function StatusEffectFactory(defaultActive = false) {
    const obj = Object.create({
        _timer: undefined,
        active: defaultActive,
        _callback: {
            func: undefined,
            callOnReset: false,
            run: function () {
                this.func();
                this.func = undefined;
                this.callOnReset = false;
            },
        },
        _wipeTimer: function () {
            if (this._timer) {
                clearTimeout(this._timer);
                this._timer = undefined;
            }
        },
        _overrided: function () {
            // call when state was set already, and is going to be set again
            this._wipeTimer();
            if (this._callback.func !== undefined && this._callback.callOnReset)
                this._callback.run();
        },
        reset: function () {
            // ignores callback, clears everything
            this._wipeTimer();
            this.active = defaultActive;
            this._callback.callOnReset = false;
            this._callback.func = undefined;
        },
        set: function (
            state,
            durationMs,
            callback = undefined,
            callbackWhenReset = false
        ) {
            if (this._timer !== undefined) this._overrided();
            if (callback !== undefined) {
                this._callback.func = callback;
                this._callback.callOnReset = callbackWhenReset;
            }
            if (durationMs < 0) this._timer = undefined;
            else
                this._timer = setTimeout(() => {
                    this.active = !state;
                    if (this._callback.func !== undefined) this._callback.run();
                }, durationMs);
            this.active = state;
        },
    });

    return obj;
}
