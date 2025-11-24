import { loadTextureCube } from "./three-utils.js";
import { AttackNodeManager, BuildNodeManager } from "./nodes.js";
import { AttackOverlayManager, BuildOverlayManager } from "./overlay.js";
import { ListenerManager } from "./listeners.js";

const b64RegPattern =
    /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;

export function createVideoElement (videopath, speed = 1) {
    const videoEl = document.createElement("video");
    videoEl.src = videopath;
    videoEl.playbackRate = speed;
    videoEl.crossOrigin = "anonymous";
    // we will manually loop so callbacks can be set at the end of every loop
    videoEl.autoplay = false;
    videoEl.loop = false;
    videoEl.muted = true; // [!] muted autoplay required by most browsers
    videoEl.style.display = "none";
    videoEl.preload = "auto";
    videoEl.setAttribute("playsinline", true);// for safari on ios
    videoEl.load();
    return videoEl;
}

function videoReadyPromise (element) {
  return new Promise((resolve, reject) => {
    if (!element || !(element instanceof HTMLVideoElement)) {
      reject(Logger.error("Invalid video element given"));
      return;
    }
    if (element.readyState > 1) {
      resolve(element);
      return;
    }
    element.addEventListener("canplaythrough", (event) => {
      resolve(element);
    }, { once: true });
    element.addEventListener("error", (event) => {
      reject(Logger.error(`Video loading error: ${event.message || event.type}`));
    }, { once: true });
  });
}

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
    // ONLY FOR NORMAL JS OBJECTS. threejs objects have a dedicated stringify method!
    return JSON.parse(JSON.stringify(obj));
}

export function redrawElement(element) {
    void(element.offsetWidth);
}

export function createEvent(eventName, details = {}) { 
    return new CustomEvent(eventName, {
        bubbles: true,
        cancelable: true,
        detail: details
    });
}

export function bindProperty(object, target, property) {
    Object.defineProperty(target, property, {
        get: function() {
            return object[property];
        },
        set: function(value) {
            object[property] = value;
        }
    });
}

export function bindProperties(object, target, ...properties) {
    properties.forEach(prop => bindProperty(object, target, prop));
}

export function bindProtoProperties(object, target) {
    bindProperties(object, target, ...Object.getOwnPropertyNames(Object.getPrototypeOf(object)).filter(prop => prop !== "constructor"));
}

export function loadVideoTextureSource (videopath, maskpath, speed = 1) {
    const video = createVideoElement(videopath, speed);
    const mask = createVideoElement(maskpath, speed);
    return {
        video: video,
        mask: mask,
        promise: Promise.all([videoReadyPromise(video), videoReadyPromise(mask)])
            .then(([v, m]) => {
                v.playbackRate = speed;
                m.playbackRate = speed;
                return [v, m];
            })
    };
}

export function layoutToJson(scene, nodeManager, obfuscate = true) {
    const data = {
        background: "", // [!] disabled for now
        layout: {
            nodes: [],
            neighbors: [],
        },
    };
    const newIds = {};
    nodeManager.nodelist.forEach((node, i) => {
        const posData = node.position.clone().round();
        data.layout.nodes.push(
            new NodeObject(node.userData.type, `${i}`, [
                posData.x,
                posData.y,
                posData.z,
            ])
        );
        newIds[node.uuid] = i;
    });
    nodeManager.tetherlist.forEach((tether) =>
        data.layout.neighbors.push([
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
        data.layout.nodes.forEach((node) => {
            const newId = nodeManager.createNode(node.type, node.position);
            newIds[node.uuid] = newId;
        });
        data.layout.neighbors.forEach((tether) =>
            nodeManager.tetherNodes(newIds[tether[0]], newIds[tether[1]])
        );
        // update references
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
    attackData, // Expects layout, attackTypes, nodeTypes and attacks
    scene,
    rendererDom,
    controls,
    managers, // expects Node, Physics, Overlay, Mouse- optional: Listener
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
    {
        const expectedNames = ["layout", "attackTypes", "nodeTypes", "attacks"];
        const names = Object.keys(attackData);
        expectedNames.forEach((expectedName) => {
            if (!names.includes(expectedName))
                Logger.throw(
                    new Error(
                        `Cannot load attack phase! Missing ${expectedName} data`
                    )
                );
        });
    }
    controls.drag.enabled = false;
    managers.Physics.deactivate(); // there won't be any physics updates to calculate, as long as the loaded layout doesn't have any illegal positions...
    managers.Node.clear();
    managers.Overlay.clear();
    managers.Listener?.clear();
    layoutFromJson(attackData.layout, scene, controls.drag, managers.Node);
    const controllers = {
        Node: new AttackNodeManager(
            attackData.nodeTypes,
            attackData.attackTypes,
            ...managers.Node._constructorArgs
        ),
        Overlay: new AttackOverlayManager(
            attackData.attacks,
            ...managers.Overlay._constructorArgs
        ),
        Listener: new ListenerManager(),
    };
    controllers.Overlay.init(controls, {Mouse: managers.Mouse, ...controllers});
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
    managers.Listener?.clear();
    layoutFromJson(layoutData, scene, controls.drag, managers.Node);
    const controllers = {
        Node: new BuildNodeManager(...managers.Node._constructorArgs),
        Overlay: new BuildOverlayManager(...managers.Overlay._constructorArgs),
        Listener: new ListenerManager(),
    };
    controllers.Overlay.init(controls, {Mouse: managers.Mouse, Node: controllers.Node});
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

export async function getClipboardText() {
    try {
        return await navigator.clipboard.readText();;
    } catch (err) {
        // cases where permission is denied or clipboard is empty/non-text
        Logger.error("Failed to read clipboard contents");
        Logger.error(err);
    }
}

export const _DebugTool = { // [!] for testing
    trace: function (reason = false) {
        try {
            throw new Error("Trace point");
        } catch (e) {
            Logger.log(`${reason ? `"${reason}"\n` : ""}Trace point:\n${e.stack}`); // Stack trace as a string
        }
    },
    exportLogger: function (scene, nodeManager, logger) {
        const layoutData = layoutToJson(scene, nodeManager, false);
        const domData = document.documentElement.outerHTML;
        Logger.log("Generating debug file for download");
        download(
            `CUBE_GAME-${(new Date()).toISOString()}.log`,
            `===[LAYOUT]===\n${layoutData}\n===[DOM]===\n${domData}\n===[CONSOLE]===\n${logger.history}\n`
        );
    },
}

function NodeObject(type, uuid, position, data = {}) {
    this.uuid = uuid;
    this.type = type;
    this.position = position;
    this._data = data;
}
