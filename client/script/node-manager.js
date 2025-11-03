import * as DOMUTILS from "./dom-utils.js";
import * as THREEUTILS from "./three-utils.js";

export function NodeManager(
    scene,
    renderer,
    camera,
    nodeMeshData = {}
) {
    const self = this;
    this.nodes = {};
    this.nodelist = []; // read-only, updated by this.nodes
    this.tethers = {};
    this.tetherlist = []; // read-only, updated by this.tethers
    this.nodeOverlayElement = undefined; // better to destroy node overlay when unused vs hide it, since rendering everything is gonna take a bunch of memory anyways...
    this._focusedNode = undefined; // actively being overlayed, NOT just whatever is hovered
    this._scene = scene;
    this._camera = camera;
    this._renderer = renderer;
    this._meshData = nodeMeshData;
    this._popNode = function (node) {
        // remove tethers
        const tethers = Object.values(node.userData.tethers.origin).concat(Object.values(node.userData.tethers.target));
        tethers.forEach(tether => this.untetherNodes(tether));

        delete this.nodes[node.uuid];
        this.nodelist = Object.values(this.nodes); // [!] may be optimizied, see if performance is impacted by this
    }
    this._pushNode = function (node) {
        this.nodes[node.uuid] = node;
        this.nodelist.push(this.nodes[node.uuid]);
    }
    this._popTether = function (tether) {
        delete this.tethers[tether.uuid];
        this.tetherlist = Object.values(this.tethers); // [!] may be optimizied, see if performance is impacted by this
    }
    this._pushTether = function (tether) {
        this.tethers[tethers.uuid] = tether;
        this.tetherlist.push(this.tethers[tethers.uuid]);
    }
    this.untetherNodes = function (origin, target) {
        // there should only be one of these
        const tether = this.tetherlist.filter(t => 
            t.userData.origin === origin &&
            t.userData.target === target
        )[0];
        // [!] hopiing this just removes the reference and not the actual object
        delete origin.userData.tethers[tether.uuid];
        delete origin.userData.tethers[tether.uuid];
        this._popTether(tether);
    }
    this.tetherNodes = function (origin, target) {
        const tether = MESH.Tether(origin, target);
        this._pushTether(tether);
        this.scene.add(tether);
        return tether;
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
    this._updateOverlay = function () {
        const positionData = THREEUTILS.getObjectScreenPosition(this._focusedObject, this._camera, this._renderer);
        DOMUTILS.updateOverlayElementOnScene(positionData, nodeOverlayElement);
    }
    this._overlayNode = function (node) {
        const screenPos = THREEUTILS.getObjectScreenPosition(node, this._camera, this._renderer);
        this.nodeOverlayElement = DOMUTILS.OverlayElement.createNodeMenu();
        this._focusedNode = node;
        // make buttons work
        this.nodeOverlayElement.querySelector(`:scope > .button[data-button-type="link"]`)
            .addEventListener("click", function (event) {
                nodeMenuActions.linkNode(el.dataset.focusedObjectUuid);
            });
        this.nodeOverlayElement.querySelector(`:scope > .button[data-button-type="add"]`)
            .addEventListener("click", function (event) {
                nodeMenuActions.addNode(el.dataset.focusedObjectUuid, {geometry: notCubeGeometry, animation: notCubeIdleAnimation});
            });
        this.nodeOverlayElement.querySelector(`:scope > .button[data-button-type="info"]`)
            .addEventListener("click", function (event) {
                // does nothing for now
            });
        DOMUTILS.overlayElementOnScene(screenPos, document.getElementById("overlay"), this.nodeOverlayElement);
    }
    this.getNode = function (uuid) {
        const node = Object.values(this.nodes).filter(n => n.uuid == uuid);
        return node ? node : undefined;
    }
    this.removeOverlay = function () {
        this.nodeOverlayElement.remove();
        this.nodeOverlayElement = undefined; // release- idk how js garbage collection works? or if it even exists for this bum language?
    }
    this.removeNode = function (uuid) {
        const node = this.getNode(uuid);
        this._popNode(node);
        this._scene.remove(node);
    }
    this.createNode = function (nodeType, originUuids = [], position = [0, 0, 0]) {
        if (Object.keys(this._meshData).includes(nodeType)) {
            const newNode = this._meshData[nodeType]();
            const origins = Array.from(originUuids, uuid => this.getNode(uuid))
                .forEach((origin, i) => {
                    if (!origin)
                        console.error(`[NodeManager] | Node with uuid ${originUuids[i]} does not exist.`);
                    else
                        this._tetherNodes(origin, newNode)
                });
            newNode.position.set(...position);
            this._scene.add(newNode);
            return newNode;
        } else {
            throw new Error(`[NodeManager] | Could not create node of type "${nodeType}": No mesh data found.`);
        }
    }
    this.addMeshData = function (meshData) {
        Object.keys(meshData).forEach(nodeType => this._meshData[nodeType] = meshData[nodeType]);
    }
    this.update = function (timedelta) {
        this._updateAnimations(timedelta);
        this._updateTethers();
    }
    return this;
}

/*
function overlayOnObject(object, camera, renderer) {
    const objPos = THREEUTILS.getObjectScreenPosition(object, camera, renderer);
    const el = DOMUTILS.OverlayElement.createNodeMenu();
    el.dataset.focusedObjectUuid = object.uuid;
    overlayElements.push(el);
    // make buttons work
    el.querySelector(`:scope > .button[data-button-type="link"]`)
        .addEventListener("click", function (event) {
            nodeMenuActions.linkNode(el.dataset.focusedObjectUuid);
        });
    el.querySelector(`:scope > .button[data-button-type="add"]`)
        .addEventListener("click", function (event) {
            nodeMenuActions.addNode(el.dataset.focusedObjectUuid, {geometry: notCubeGeometry, animation: notCubeIdleAnimation});
        });
    el.querySelector(`:scope > .button[data-button-type="info"]`)
        .addEventListener("click", function (event) {
            // does nothing for now
        });
    DOMUTILS.overlayElementOnScene(objPos, document.getElementById("overlay"), el);
}

*/