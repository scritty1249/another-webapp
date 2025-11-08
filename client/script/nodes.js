import {
    Vector3,
    Color
} from "three";

const emissiveValue = new Color(0xdedede);

export function NodeManager(
    scene,
    renderer,
    camera,
    raycaster,
    nodeMeshData = {}
) {
    const self = this;
    this.nodes = {};
    this.nodelist = []; // read-only, updated by this.nodes
    this.tethers = {};
    this.tetherlist = []; // read-only, updated by this.tethers
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
    this._popNode = function (node) {
        // remove tethers
        if (node.userData.tetherlist.length)
            node.userData.tetherslist.forEach(tether => this._popTether(tether));
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
        delete this.tethers[tether.uuid];
        this.tetherlist = Object.values(this.tethers); // [!] may be optimizied, see if performance is impacted by this
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
        if (tether.length)
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
    this.createNode = function (nodeType, originids = [], position = [0, 0, 0]) {
        const newNode = this._getMesh(nodeType);
        if (position.hasOwnProperty("x"))
            newNode.position.set(position.x, position.y, position.z);
        else
            newNode.position.set(...position);
        this._pushNode(newNode);
        this._scene.add(newNode);
        originids.forEach(originid => this.tetherNodes(originid, newNode.uuid));
        Logger.debug(`Created new Node (${nodeType}): ${newNode.uuid}`);
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
        this._updateTethers();
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

    return this;
}

export function AttackNodeManager (
    nodeManager,
    healthData
) {
    const self = this;
    this._healthData = healthData;
    this._nodes = {};
    this.nodedata = {}; // read-only, modified by object this.nodes
    this.nodes = new Proxy(self._nodes, {
        set(target, key, value, receiever) {
            self._nodes[key] = value;
            if (!self._healthData[value.userData.type])
                Logger.throw(`[AttackNodeManager] | Error while adding node ${key}: No health data found for Node type "${value.userData.type}"`);
            self.nodedata[key] = {
                health: self._healthData[value.userData.type]
            };
        },
        deleteProperty(target, key) {
            delete self._nodes[key];
            delete self.nodedata[key]; // [!] may need to use Reflect.deleteProperty() instead?
        }
    });
    // this.nodelist = {
    //     value: {},
    //     get function(key) {
    //         return this.value[key];
    //     },
    //     set function(key, value) {
    //         if (!this._healthData[value.userData.type])
    //             Logger.throw(`[AttackNodeManager] | Error while adding node ${key}: No health data found for "${value.userData.type}" type Nodes`);
    //         self.nodedata[key] = {
    //             health: this._healthData[value.userData.type]
    //         };
    //         this.value[key] = value;
    //     }
    // }

    return {...nodeManager, ...this};
}

export function BuildNodeManager (
    nodeManager
) {
    this.tetherNodes = function (originid, targetid) {
        const [origin, target] = this.getNodes(originid, targetid);
        if (this.isNeighbor(originid, targetid))
            throw new Error(
                `[BuildNodeManager] | Tether already exists between Nodes ${originid} and ${targetid}`
            );
        else if (originid == targetid)
            throw new Error(
                `[BuildNodeManager] | Cannot tether a Node to itself`
            );
        const tether = this._getMesh("tether", origin, target);
        this._pushTether(tether);
        this._scene.add(tether);
        return tether.uuid;
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
    this.untetherNodes = function (originid, targetid) {
        const tether = this._getTetherFromNodes(originid, targetid);
        this.removeTether(tether.uuid); // a bit inefficient
    }
    this.untetherNode = function (nodeid) {
        const node = this.getNode(nodeid);
        node.userData.tetherlist.forEach(tether => this._removeTether(tether));
    }
    this.removeTether = function (tetherid) {
        const tether = this.getTether(tetherid);
        this._removeTether(tether);
    }
    this.getTether = function (tetherid) {
        const tether = this.tethers[tetherid];
        if (!tether)
            Logger.throw(new Error(`[BuildNodeManager] | Tether with UUID "${tetherid}" does not exist.`));
        return tether;
    }
    this.removeNode = function (nodeid) {
        const node = this.getNode(nodeid);
        this._popNode(node);
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
    this._setNodeEmissive = function (node, emissive) {
        node.userData.traverseMesh(function (mesh) {
            if (mesh.material.emissive)
                mesh.material.emissive.set(emissive);
        });
    }
    this.highlightNode = function (nodeid) {
        const node = this.getNode(nodeid);
        node.userData.traverseMesh(function (mesh) {
            if (mesh.material.emissive && !mesh.material.emissive.equals(emissiveValue)) {
                mesh.userData.oldEmissive = mesh.material.emissive.clone();
                mesh.material.emissive.set(emissiveValue);
            }
        });
    }
    this.unhighlightNode = function (nodeid) {
        const node = this.getNode(nodeid);
        node.userData.traverseMesh(function (mesh) {
            if (mesh.material.emissive && mesh.userData.oldEmissive)
                mesh.material.emissive.set(mesh.userData.oldEmissive);
        });
    }
    return {...nodeManager, ...this};
}
