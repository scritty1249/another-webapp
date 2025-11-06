import {
    Vector3
} from "three";

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
    Object.defineProperty(self, "lowPerformanceMode", {
        get: function() {
            return self._lowPerformance;
        },
        set: function(value) {
            self._lowPerformance = value;
            self._setLowPerformanceMode(value);
        }
    });
    this._scene = scene;
    this._camera = camera;
    this._renderer = renderer;
    this._raycaster = raycaster;
    this._meshData = nodeMeshData;
    this._popNode = function (node) {
        // remove tethers
        const tethers = Object.values(node.userData.tethers.origin).concat(Object.values(node.userData.tethers.target));
        tethers.forEach(tether => this._popTether(tether));
        this._scene.remove(node);
        delete this.nodes[node.uuid];
        this.nodelist = Object.values(this.nodes); // [!] may be optimizied, see if performance is impacted by this
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
    this.isNeighbor = function (originid, targetid) { // order does not matter

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
        return tether.length != 0;
    }
    this.getNodes = function (...nodeids) {
        return nodeids.map(nodeid => this.getNode(nodeid));
    }
    this.untetherNodes = function (originid, targetid) {
        const tether = this.getTetherFromNodes(originid, targetid);
        // [!] hoping this just removes the reference and not the actual object
        delete origin.userData.tethers[tether.uuid];
        delete target.userData.tethers[tether.uuid];
        this._popTether(tether);
    }
    this.tetherNodes = function (originid, targetid) {
        const [origin, target] = self.getNodes(originid, targetid);
        if (self.isNeighbor(originid, targetid))
            throw new Error(
                `[NodeManager] | Tether already exists between Nodes ${originid} and ${targetid}`
            );
        else if (originid == targetid)
            throw new Error(
                `[NodeManager] | Cannot tether a Node to itself`
            );
        const tether = self._getMesh("tether", origin, target);
        self._pushTether(tether);
        self._scene.add(tether);
        return tether.uuid;
    }
    this._updateAnimations = function (timedelta) {
        this.nodelist.forEach(node => {
            if (node.userData.updateAnimations)
                node.userData.updateAnimations(timedelta);
        });
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
    this.getTether = function (tetherid) {
        const tether = this.tethers[tetherid];
        if (!tether)
            throw new Error(`[NodeManager] | Tether with UUID "${tetherid}" does not exist.`);
        return tether;
    }
    this.getNode = function (nodeid) {
        const node = this.nodes[nodeid];
        if (!node)
            throw new Error(`[NodeManager] | Node with UUID "${nodeid}" does not exist.`);
        return node;
    }
    this.getTetherFromNodes = function (originid, targetid) {
        // there should only be one tether between each node
        const tether = this.tetherlist.filter(t => 
            t.userData.origin.uuid === originid &&
            t.userData.target.uuid === targetid
        );
        if (!tether)
            throw new Error(`[NodeManager] | A tether from Node UUID "${originid}" to "${targetid}" does not exist.`);
        return tether[0]; // there should only be one
    }
    this.removeNode = function (nodeid) {
        const node = this.getNode(nodeid);
        this._popNode(node);
        this._scene.remove(node);
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
        return newNode.uuid;
    }
    this._getMesh = function (meshName, ...args) {
        if (!Object.keys(self._meshData).includes(meshName))
            throw new Error(`[NodeManager] | Could load mesh of type "${nodeType}": No mesh data found.`);
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
    this._setNodeEmissive = function (node, emissive) {
        node.userData.traverseMesh(function (mesh) {
            if (mesh.material.emissive)
                mesh.material.emissive.set(emissive);
        });
    }
    this.highlightNode = function (nodeid) {
        const node = self.getNode(nodeid);
        node.userData.traverseMesh(function (mesh) {
            if (mesh.material.emissive) {
                mesh.userData.oldEmissive = mesh.material.emissive.clone();
                mesh.material.emissive.set(0xdedede);
            }
        });
    }
    this.unhighlightNode = function (nodeid) {
        const node = self.getNode(nodeid);
        node.userData.traverseMesh(function (mesh) {
            if (mesh.material.emissive && mesh.userData.oldEmissive)
                mesh.material.emissive.set(mesh.userData.oldEmissive);
        });
    }
    this.getNodeFromFlatCoordinate = function (coordinate) { // [!] this modifies the raycaster
        self._raycaster.setFromCamera(coordinate, self._camera);
        const intersects = self._raycaster.intersectObjects(self.nodelist, true);
        return intersects.length > 0
            ? intersects[0].object.parent
                ? intersects[0].object.parent.uuid
                : intersects[0].object.uuid
            : undefined;
    }
    this.getDistance = function (originid, targetid) {
        const [origin, target] = self.getNodes(originid, targetid);
        return origin.position.distanceTo(target.position);
    }
    this.getDirection = function (originid, targetid) {
        const [origin, target] = self.getNodes(originid, targetid);
        return new THREE.Vector3().subVectors(
            origin.position,
            target.position
        );
    }
    this.getAngle = function (originid, targetid) { // returns in RADIANS
        const [origin, target] = self.getNodes(originid, targetid);
        return origin.position.angleTo(target.position);
    }
    this._setLowPerformanceMode = function (low) {
        if (low)
            self.nodelist.forEach(node => node.userData.state.setLowPerformance());
        else
            self.nodelist.forEach(node => node.userData.state.setHighPerformance());
    }

    return this;
}
