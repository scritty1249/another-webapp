import { loadTextureCube } from "./three-utils.js";
import { AttackNodeManager, BuildNodeManager } from "./nodes.js";
import { AttackOverlayManager, BuildOverlayManager } from "./overlay.js";
import { ListenerManager } from "./listeners.js";

const b64RegPattern =
    /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;

export function download(filename, text) {
    const el = document.createElement("a");
    el.setAttribute(
        "href",
        "data:text/plain;charset=utf-8," + encodeURIComponent(text)
    );
    el.setAttribute("download", filename);

    el.style.display = "none";
    document.body.appendChild(el);

    el.click();

    document.body.removeChild(el);
}

export function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}

export function random(min, max) {
    return Math.random() * (max - min) + min;
}

export function deepCopy(obj) {
    // ONYL FOR NORMAL JS OBJECTS. threejs objects have a dedicated stringify method!
    return JSON.parse(JSON.stringify(obj));
}

export function createEvent(eventName, details = {}) { 
    return new CustomEvent(eventName, {
        bubbles: true,
        cancelable: true,
        detail: details
    });
}

export function layoutToJson(scene, nodeManager, obfuscate = true) {
    const data = {
        nodes: [],
        neighbors: [],
        background: "", // [!] disabled for now
    };
    const newIds = {};
    nodeManager.nodelist.forEach((node, i) => {
        const posData = node.position.clone().round();
        data.nodes.push(
            new NodeObject(node.userData.type, `${i}`, [
                posData.x,
                posData.y,
                posData.z,
            ])
        );
        newIds[node.uuid] = i;
    });
    nodeManager.tetherlist.forEach((tether) =>
        data.neighbors.push([
            newIds[tether.userData.target.uuid],
            newIds[tether.userData.origin.uuid],
        ])
    );
    let dataStr = JSON.stringify(data);
    Logger.debug("Exported layout: ", data);
    return obfuscate ? btoa(dataStr) : dataStr;
}
export function layoutFromJson(jsonStr, scene, dragControls, nodeManager) {
    const isEncoded = b64RegPattern.test(jsonStr);
    try {
        const data = JSON.parse(isEncoded ? atob(jsonStr) : jsonStr);
        const newIds = {};
        if (data.background)
            try {
                scene.background = loadTextureCube(data.background);
            } catch (error) {
                Logger.error(
                    `Failed to load background from source: ${data.background}`
                );
                Logger.error(error);
            }
        data.nodes.forEach((node) => {
            const newId = nodeManager.createNode(node.type, node.position);
            newIds[node.uuid] = newId;
        });
        data.neighbors.forEach((tether) =>
            nodeManager.tetherNodes(newIds[tether[0]], newIds[tether[1]])
        );
        dragControls.objects = nodeManager.nodelist;
        nodeManager.centerNodes();
        Logger.debug("Loaded layout: ", data);
        return true;
    } catch (error) {
        Logger.error(
            `Error loading ${isEncoded ? "encoded " : ""}layout: `,
            jsonStr
        );
        Logger.error(error);
        return false;
    }
}

export function initAttackPhase(
    layoutData,
    scene,
    rendererDom,
    controls,
    managers // expects Node, Physics, Overlay, Mouse- optional: Listener
) {
    Logger.info("Loading Attack phase");
    {
        const expectedNames = ["Node", "Physics", "Overlay", "Mouse"];
        const names = Object.keys(managers);
        expectedNames.forEach((expectedName) => {
            if (!names.includes(expectedName))
                Logger.throw(
                    new Error(
                        `Cannot load attack phase! Missing ${expectedName}Manager`
                    )
                );
        });
    }
    controls.drag.enabled = false;
    managers.Physics.deactivate(); // there won't be any physics updates to calculate, as long as the loaded layout doesn't have any illegal positions...
    managers.Node.clear();
    managers.Overlay.clear();
    if (managers.hasOwnProperty("Listener") && managers.Listener != undefined) managers.Listener.clear();
    layoutFromJson(layoutData, scene, controls.drag, managers.Node);
    const controllers = {
        Node: new AttackNodeManager(managers.Node),
        Overlay: new AttackOverlayManager(managers.Overlay),
        Listener: new ListenerManager(),
    };
    controllers.Overlay.init(controls, controllers);
    Logger.log("Finished loading attack phase");
    return controllers;
}

export function initBuildPhase(
    layoutData,
    scene,
    rendererDom,
    controls,
    managers // expects Node, Physics, Overlay, Mouse- optional: Listener
) {
    Logger.info("Loading build phase");
    {
        const expectedNames = ["Node", "Physics", "Overlay", "Mouse"];
        const names = Object.keys(managers);
        expectedNames.forEach((expectedName) => {
            if (!names.includes(expectedName))
                Logger.throw(
                    new Error(
                        `Cannot load build phase! Missing ${expectedName}Manager`
                    )
                );
        });
    }
    controls.drag.enabled = true;
    managers.Physics.activate();
    managers.Node.clear();
    managers.Overlay.clear();
    if (managers.hasOwnProperty("Listener") && managers.Listener != undefined) managers.Listener.clear();
    layoutFromJson(layoutData, scene, controls.drag, managers.Node);
    const controllers = {
        Node: new BuildNodeManager(managers.Node),
        Overlay: new BuildOverlayManager(managers.Overlay),
        Listener: new ListenerManager(),
    };
    controllers.Overlay.init(controls, controllers);
    // Add event listeners
    controllers.Listener.listener(controls.camera).add(
        "change",
        function (event) {
            // const zoom = THREEUTILS.getZoom(camera);
        }
    );
    controllers.Listener.listener(controls.drag)
        .add("drag", function (event) {})
        .add("dragstart", function (event) {
            controls.camera.enabled = false;
            event.object.userData.dragged = true;
            try {
                controllers.Node.highlightNode(event.object.uuid);
            } catch {
                Logger.error(
                    "DragControls selected a bad node: ",
                    event.object,
                    controls.drag.objects,
                    managers.Node.nodelist
                );
            }
        })
        .add("dragend", function (event) {
            controls.camera.enabled = true;
            event.object.userData.dragged = false;
            try {
                controllers.Node.unhighlightNode(event.object.uuid);
            } catch {
                Logger.error(
                    "DragControls selected a bad node: ",
                    event.object,
                    controls.drag.objects,
                    managers.Node.nodelist
                );
            }
        });
    controllers.Listener.listener(rendererDom).add(
        "clicked",
        function (event) {
            const clickedNodeId =
                controllers.Node.getNodeFromFlatCoordinate(
                    managers.Mouse.position
                );
            if (
                clickedNodeId &&
                controllers.Overlay.focusedNodeId != clickedNodeId
            )
                controllers.Overlay.focusNode(clickedNodeId);
            else controllers.Overlay.unfocusNode();
        }
    );
    Logger.log("Finished loading build phase");
    return controllers;
}

export function _trace(reason = false) { // [!] for testing
    try {
        throw new Error("Trace point");
    } catch (e) {
        Logger.log(`${reason ? `"${reason}"\n` : ""}Trace point:\n${e.stack}`); // Stack trace as a string
    }
}

function NodeObject(type, uuid, position, data = {}) {
    this.uuid = uuid;
    this.type = type;
    this.position = position;
    this._data = data;
}
