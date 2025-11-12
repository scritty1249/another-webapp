import {
    Vector3,
    Color
} from "three";
import * as UTIL from "./utils.js";

const emissiveValue = new Color(0xdedede);

export function NodeManager(
    scene,
    renderer,
    camera,
    raycaster,
    nodeMeshData = {}
) {
    const self = this;
    this._lowPerformance = false;
    this._scene = scene;
    this._camera = camera;
    this._renderer = renderer;
    this._raycaster = raycaster;
    this._meshData = nodeMeshData;
    Object.defineProperty(self, "lowPerformanceMode", {
        get: function() {
            return self._lowPerformance;
        },
        set: function(value) {
            self._lowPerformance = value;
            self._setLowPerformanceMode(value);
        }
    });
    this.centerNodes = function () {
        // get mean node location
        const mean = new Vector3();
        self.nodelist.forEach(node => mean.add(node.position));
        mean.divideScalar(self.nodelist.length);
        self.nodelist.forEach(node => node.position.sub(mean));
        self._updateTethers();
    }
    this._popNode = function (node) {
        // remove tethers
        if (node.userData.tetherlist.length)
            node.userData.tetherlist.forEach(tether => this._popTether(tether));
        this._scene.remove(node);
        delete this.nodes[node.uuid];
        this.nodelist = [...Object.values(this.nodes)];
    }
    this._pushNode = function (node) {
        this.nodes[node.uuid] = node;
        this.nodelist.push(this.nodes[node.uuid]);
    }
    this._popTether = function (tether) { // does not pop tether reference from attached nodes
        this._scene.remove(tether);
        // tether.userData.origin = undefined;
        // tether.userData.target = undefined;
        delete this.tethers[tether.uuid];
        this.tetherlist = [...Object.values(this.tethers)]; // [!] may be optimizied, see if performance is impacted by this
    }
    this._pushTether = function (tether) {
        this.tethers[tether.uuid] = tether;
        this.tetherlist.push(this.tethers[tether.uuid]);
    }
    this.isNeighbor = function (originid, targetid) { // order does not matter, returns the tether uuid if true
        // there should only be one tether between each node
        const tether = this.tetherlist.filter(t => 
            (
                t.userData.origin.uuid === originid &&
                t.userData.target.uuid === targetid
            ) || (
                t.userData.origin.uuid === targetid &&
                t.userData.target.uuid === originid
            )
        );
        if (tether.length > 0)
            return tether[0].uuid;
        return false;
    }
    this.getNodes = function (...nodeids) {
        return nodeids.map(nodeid => this.getNode(nodeid));
    }
    this._removeTether = function (tether) {
        const [origin, target] = this._getNodesFromTether(tether);
        // [!] hoping this just removes the reference and not the actual object
        delete origin.userData.tethers.origin[tether.uuid];
        delete target.userData.tethers.target[tether.uuid];
        this._popTether(tether);
    }
    this._getNodesFromTether = function (tether) {
        return [
            tether.userData.origin,
            tether.userData.target
        ];
    }
    this._updateAnimations = function (timedelta) {
        this.nodelist.forEach(node => {
            if (node.userData.updateAnimations)
                node.userData.updateAnimations(timedelta);
        });
    }
    this.getNode = function (nodeid) {
        const node = this.nodes[nodeid];
        if (!node)
            Logger.throw(new Error(`[NodeManager] | Node with UUID "${nodeid}" does not exist.`));
        return node;
    }
    this.createNode = function (nodeType, position = [0, 0, 0]) {
        const newNode = this._getMesh(nodeType);
        if (position.x)
            newNode.position.set(position.x, position.y, position.z);
        else
            newNode.position.set(...position);
        this._pushNode(newNode);
        this._scene.add(newNode);
        Logger.debug(`[NodeManager] | Created new Node (${nodeType}): ${newNode.uuid}`);
        return newNode.uuid;
    }
    this._getMesh = function (meshName, ...args) {
        if (!Object.keys(self._meshData).includes(meshName))
            Logger.throw(new Error(`[NodeManager] | Could load mesh of type "${nodeType}": No mesh data found.`));
        return self._meshData[meshName](...args);
    }
    this.addMeshData = function (meshData) {
        Object.keys(meshData).forEach(nodeType => this._meshData[nodeType] = meshData[nodeType]);
    }
    this.update = function (timedelta) {
        this._updateAnimations(timedelta);
    }
    this.getFlatCoordinateFromNode = function (nodeid) {
        const worldPosition = new Vector3();
        self.getNode(nodeid).getWorldPosition(worldPosition); // Get world position (not local!)
        worldPosition.project(self._camera); // Project to NDC
    
        const rect = self._renderer.domElement.getBoundingClientRect();
    
        const screenX = (worldPosition.x * 0.5 + 0.5) * rect.width + rect.left;
        const screenY = (-worldPosition.y * 0.5 + 0.5) * rect.height + rect.top;
    
        return { x: screenX, y: screenY, distance: camera.position.distanceTo(worldPosition) };
    }
    this.getNodeFromFlatCoordinate = function (coordinate) { // [!] this modifies the raycaster
        self._raycaster.setFromCamera(coordinate, self._camera);
        const intersects = self._raycaster.intersectObjects(self.nodelist, true);
        return intersects.length > 0
            ? intersects[0].object.userData.nodeid ?
                intersects[0].object.userData.nodeid
                : intersects[0].object.userData.uuid
            : undefined;
    }
    this._setLowPerformanceMode = function (low) {
        if (low)
            self.nodelist.forEach(node => node.userData.state.setLowPerformance());
        else
            self.nodelist.forEach(node => node.userData.state.setHighPerformance());
    }
    this.clear = function () {
        const nodeCount = self.nodelist.length;
        const tetherCount = self.tetherlist.length;
        self.nodelist.forEach(n => self._popNode(n));
        Logger.log(`[NodeManager] | Cleared ${nodeCount} nodes and ${tetherCount} tethers`);
    }
    this._tetherNodes = function (origin, target) {
        if (this.isNeighbor(origin.uuid, target.uuid))
            throw new Error(
                `[NodeManager] | Tether already exists between Nodes ${originid} and ${targetid}`
            );
        else if (origin.uuid == target.uuid)
            throw new Error(
                `[NodeManager] | Cannot tether a Node to itself`
            );
        const tether = this._getMesh("tether", origin, target);
        this._pushTether(tether);
        this._scene.add(tether);
        return tether;
    }
    this.tetherNodes = function (originid, targetid) {
        const [origin, target] = this.getNodes(originid, targetid);
        const tether = this._tetherNodes(origin, target);
        return tether.uuid;
    }
    this.removeTether = function (tetherid) {
        const tether = this.getTether(tetherid);
        this._removeTether(tether);
    }
    this.getDistance = function (originid, targetid) {
        const [origin, target] = this.getNodes(originid, targetid);
        return origin.position.distanceTo(target.position);
    }
    this.getDirection = function (originid, targetid) {
        const [origin, target] = this.getNodes(originid, targetid);
        return new THREE.Vector3().subVectors(
            origin.position,
            target.position
        );
    }
    this.getAngle = function (originid, targetid) { // returns in RADIANS
        const [origin, target] = this.getNodes(originid, targetid);
        return origin.position.angleTo(target.position);
    }
    this._updateTethers = function () {
        this.tetherlist.forEach(tether => {
            if (
                tether.userData.origin.position != tether.userData.vectors.origin ||
                tether.userData.target.position != tether.userData.vectors.target
            ) {
                tether.userData.update();
            }
        });
    }
    return this;
}

NodeManager.prototype = {
    nodes: {},
    nodelist: [], // read only
    tethers: {},
    tetherlist: [], // read only
}

export function AttackNodeManager (
    nodeManager,
    nodeTypeData = {}
) {
    const self = {...nodeManager};
    self._nodeTypeData = nodeTypeData;
    self.nodedata = {};
    UTIL.bindProperty(nodeManager, self, "nodelist");
    UTIL.bindProperty(nodeManager, self, "tethers");
    UTIL.bindProperty(nodeManager, self, "tetherlist");
    self.nodes = new Proxy(nodeManager.nodes, {
        set(target, key, value, receiver) {
            nodeManager.nodelist.push(value);
            if (!self._nodeTypeData[value.userData.type])
                Logger.throw(`[AttackNodeManager] | Error while adding node ${key}: No data found for Node type "${value.userData.type}"`);
            self.nodedata[key] = { health: self._nodeTypeData[value.userData.type] };
            return Reflect.set(target, key, value, receiver); // default behavior, equal to "self._nodes[key] = value"
        },
        deleteProperty(target, key) {
            const res = Reflect.deleteProperty(target, key); // default behavior, equal to "delete self._nodes[key]"
            self.nodelist = [...Object.values(self._nodes)];
            return res;
        }
    });
    self.addHealthData = function (healthData) {
        Object.keys(healthData).forEach(nodeType => self._healthData[nodeType] = healthData[nodeType]);
    }
    self._addNodeData = function (node) {
        const healthData = self._nodeTypeData[node.userData.type]?.health;
        if (healthData === undefined || healthData === NaN)
            Logger.throw(`[AttackNodeManager] | Error while creating node data for type (${node.userData.type}): No health data found`);
        else
            self.nodedata[node.uuid] = {
                get isDead () {
                    return this.hp.total <= 0;
                },
                hp: NodeHealthDataFactory(healthData)
            };
    }
    self.getNodeData = function (nodeid) {
        const nodeData = self.nodedata[nodeid];
        if (!nodeData)
            Logger.throw(new Error(`[AttackNodeManager] | Error getting data: Node with UUID "${nodeid}" does not exist.`));
        return nodeData;
    }

    // init data for existing nodes
    Object.values(self.nodes).forEach(node => self._addNodeData(node));

    return self;
}

export function BuildNodeManager (
    nodeManager
) {
    const self = {...nodeManager};
    UTIL.bindProperty(nodeManager, self, "nodes");
    UTIL.bindProperty(nodeManager, self, "nodelist");
    UTIL.bindProperty(nodeManager, self, "tethers");
    UTIL.bindProperty(nodeManager, self, "tetherlist");
    self.untetherNodes = function (originid, targetid) {
        const tether = this._getTetherFromNodes(originid, targetid);
        this.removeTether(tether.uuid); // a bit inefficient
    }
    self.untetherNode = function (nodeid) {
        const node = this.getNode(nodeid);
        node.userData.tetherlist.forEach(tether => this._removeTether(tether));
    }
    self.removeNode = function (nodeid) {
        const node = this.getNode(nodeid);
        this._popNode(node);
    }
    self._setNodeEmissive = function (node, emissive) {
        node.userData.traverseMesh(function (mesh) {
            if (mesh.material.emissive)
                mesh.material.emissive.set(emissive);
        });
    }
    self.highlightNode = function (nodeid) {
        const node = this.getNode(nodeid);
        node.userData.traverseMesh(function (mesh) {
            if (mesh.material.emissive && !mesh.material.emissive.equals(emissiveValue)) {
                mesh.userData.oldEmissive = mesh.material.emissive.clone();
                mesh.material.emissive.set(emissiveValue);
            }
        });
    }
    self.unhighlightNode = function (nodeid) {
        const node = this.getNode(nodeid);
        node.userData.traverseMesh(function (mesh) {
            if (mesh.material.emissive && mesh.userData.oldEmissive)
                mesh.material.emissive.set(mesh.userData.oldEmissive);
        });
    }
    self.update = function (timedelta) {
        this._updateAnimations(timedelta);
        this._updateTethers();
    }
    return self;
}

const NodeHealthPrototype = {
    
};
function NodeHealthDataFactory (maxHealth) {
    return {
        _health: {
            max: maxHealth,
            current: maxHealth,
        },
        _shield: {
            current: 0
        },
        get total () {
            return this.health + this.shield;
        },
        get shield () {
            return this._shield.current;
        },
        set shield (value) {
            const difference = Math.max(0, value - this._shield.current);
            this._shield.current = Math.max(0, value);
            return difference;
        },
        get health () {
            return this._health.current;
        },
        set health (value) {
            this._health.current = UTIL.clamp(value, 0, this.maxHealth);
            if (value > this.maxHealth)
                return value - this.maxHealth;
            else if (value < 0)
                return value;
        },
        get maxHealth () {
            return this._health.max;
        },
        set applyDamage (value) { // should be a positive value!
            let damage = Math.abs(value);
            damage = (this.shield -= damage);
            damage = (this.health -= damage);
            return damage; // returns the extra damage, for easier callbacks later
        },
        set applyHeal (value) { // should be a positive value!
            let heal = Math.abs(value);
            heal = (this.health += heal)
            return heal; // returns overhealing, for easier callbacks later
        },
        set applyShield (value) { // should be a positive value!
            let shield = Math.abs(value);
            this.shield += shield;
        }
    };
}