import { loadTextureCube } from "./three-utils.js";
import { AttackNodeManager, BuildNodeManager } from "./nodes.js";
import {
    AttackOverlayManager,
    BuildOverlayManager,
    SelectOverlayManager,
} from "./overlay.js";
import { ListenerManager } from "./listeners.js";
import * as THREE from "three";

const b64RegPattern =
    /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;

export const BLANK_LAYOUT_OBJ = {
    background: "./source/bg/",
    layout: {
        neighbors: [],
        nodes: [{ uuid: "0", type: "globe", position: [0, 0, 0], _data: {} }],
    },
};

export const DEFAULT_GEO = {
    // lol
    lat: 63.5888,
    long: 154.4931,
};

export function createVideoElement(videopath, speed = 1) {
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
    videoEl.setAttribute("playsinline", true); // for safari on ios
    videoEl.load();
    return videoEl;
}

function videoReadyPromise(element) {
    return new Promise((resolve, reject) => {
        if (!element || !(element instanceof HTMLVideoElement)) {
            reject(Logger.error("Invalid video element given"));
            return;
        }
        if (element.readyState > 1) {
            resolve(element);
            return;
        }
        element.addEventListener(
            "canplaythrough",
            (event) => {
                resolve(element);
            },
            { once: true }
        );
        element.addEventListener(
            "error",
            (event) => {
                reject(
                    Logger.error(
                        `Video loading error: ${event.message || event.type}`
                    )
                );
            },
            { once: true }
        );
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

export function unfocusDom() {
    const tmp = document.createElement("input");
    document.body.appendChild(tmp);
    tmp.focus();
    document.body.removeChild(tmp);
}

export function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}

export function random(min, max) {
    return Math.random() * (max - min) + min;
}

export function average(...values) {
    return values.reduce((a, b) => a + b) / values.length;
}

export function deepCopy(obj) {
    // ONLY FOR NORMAL JS OBJECTS. threejs objects have a dedicated stringify method!
    return JSON.parse(JSON.stringify(obj));
}

export function redrawElement(element) {
    void element.offsetWidth;
}

export function createEvent(eventName, details = {}) {
    return new CustomEvent(eventName, {
        bubbles: true,
        cancelable: true,
        detail: details,
    });
}

export function getLocation() {
    // [!] does not check for geolocation api support. Caller should do that first.
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
    })
        .then((pos) => {
            return {
                lat: pos.coords.latitude,
                long: -pos.coords.longitude,
            };
        })
        .catch((err) => {
            return DEFAULT_GEO;
        });
}

export function bindProperty(object, target, property) {
    Object.defineProperty(target, property, {
        get: function () {
            return object[property];
        },
        set: function (value) {
            object[property] = value;
        },
    });
}

export function bindProperties(object, target, ...properties) {
    properties.forEach((prop) => bindProperty(object, target, prop));
}

export function bindProtoProperties(object, target) {
    bindProperties(
        object,
        target,
        ...Object.getOwnPropertyNames(Object.getPrototypeOf(object)).filter(
            (prop) => prop !== "constructor"
        )
    );
}

export function loadVideoTextureSource(videopath, maskpath, speed = 1) {
    const video = createVideoElement(videopath, speed);
    const mask = createVideoElement(maskpath, speed);
    return {
        video: video,
        mask: mask,
        promise: Promise.all([
            videoReadyPromise(video),
            videoReadyPromise(mask),
        ]).then(([v, m]) => {
            v.playbackRate = speed;
            m.playbackRate = speed;
            return [v, m];
        }),
    };
}

export function layoutToJsonObj(scene, nodeManager) {
    const data = {
        background: "./source/bg/", // [!] disabled for now
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
    return data;
}

export function loadFile(url) {
    return fetch(url).then((data) => data?.json());
}

export function layoutToJson(scene, nodeManager, obfuscate = true) {
    const data = layoutToJsonObj(scene, nodeManager);
    let dataStr = JSON.stringify(data);
    Logger.debug("Exported layout: ", data);
    return obfuscate ? btoa(dataStr) : dataStr;
}

export function layoutFromJsonObj(jsonObj, scene, dragControls, nodeManager) {
    try {
        const newIds = {};
        if (jsonObj.background)
            try {
                scene.background = loadTextureCube(jsonObj.background);
            } catch (error) {
                Logger.error(
                    `Failed to load background from source: ${jsonObj.background}`
                );
                Logger.error(error);
            }
        jsonObj.layout.nodes.forEach((node) => {
            const newId = nodeManager.createNode(node.type, node.position);
            newIds[node.uuid] = newId;
        });
        jsonObj.layout.neighbors.forEach((tether) =>
            nodeManager.tetherNodes(newIds[tether[0]], newIds[tether[1]])
        );
        // update references
        dragControls.objects = nodeManager.nodelist;
        nodeManager.centerNodes();
        Logger.debug("Loaded layout: ", jsonObj);
        return true;
    } catch (error) {
        Logger.error(`Error loading layout: `, jsonObj);
        Logger.error(error);
        return false;
    }
}

export function layoutFromJson(jsonStr, scene, dragControls, nodeManager) {
    const isEncoded = b64RegPattern.test(jsonStr);
    let data;
    try {
        data = JSON.parse(isEncoded ? atob(jsonStr) : jsonStr);
    } catch (error) {
        Logger.error(
            `Error loading ${isEncoded ? "encoded " : ""}layout: `,
            jsonStr
        );
        Logger.error(error);
        return false;
    }
    return layoutFromJsonObj(data, scene, dragControls, nodeManager);
}

export function initSelectPhase(
    callbacks, // expects Attack, Build
    scene,
    rendererDom,
    controls,
    targets,
    managers // expects Node, Physics, Overlay, Mouse, World- optional: Listener
) {
    Logger.info("Loading select phase");
    {
        const expectedNames = ["Node", "Physics", "Overlay", "Mouse", "World"];
        const names = Object.keys(managers);
        expectedNames.forEach((expectedName) => {
            if (!names.includes(expectedName))
                Logger.throw(
                    new Error(
                        `Cannot load select phase! Missing ${expectedName}Manager`
                    )
                );
        });
    }
    {
        const expectedNames = ["Attack", "Build"];
        const names = Object.keys(callbacks);
        expectedNames.forEach((expectedName) => {
            if (!names.includes(expectedName))
                Logger.throw(
                    new Error(
                        `Cannot load select phase! Missing ${expectedName} phase callback`
                    )
                );
        });
    }
    controls.camera.autoRotate = true;
    controls.camera.autoRotateSpeed = 0.6;
    controls.drag.enabled = false;
    managers.Physics.deactivate(); // there won't be any physics updates to calculate, as long as the loaded layout doesn't have any illegal positions...
    managers.Node.clear();
    managers.Overlay.clear();
    managers.Listener?.clear();
    scene.background = new THREE.Color(0x000000);
    const controllers = {
        Node: undefined,
        Overlay: new SelectOverlayManager(...managers.Overlay._constructorArgs),
        Listener: new ListenerManager(),
    };

    managers.World.init();
    controllers.Overlay.init(controls, {
        Mouse: managers.Mouse,
        ...controllers,
    });

    {
        // add targets

        for (const { geo, id, username } of targets) {
            const country = managers.World.markOnWorld(geo.lat, geo.long);
        }
    }

    // listeners
    let rotateTimeout;
    controllers.Listener.listener(controls.camera)
        .add("end", function (event) {
            rotateTimeout = setTimeout(() => {
                if (
                    managers.World.enabled &&
                    !managers.World.state.focusedCountry &&
                    !managers.World.state.tweeningCamera
                )
                    controls.camera.autoRotate = true;
            }, 3500);
        })
        .add("start", function (event) {
            if (rotateTimeout) clearTimeout(rotateTimeout);
            controls.camera.autoRotate = false;
            managers.World.state.tweeningCamera = false;
        });
    managers.World.when("click", function (detail) {
        const last = detail.previous;
        const curr = detail.current;
        const target = detail.target;
        if (target) {
            if (rotateTimeout) clearTimeout(rotateTimeout);
            Logger.log(`Selected target user: `, target);
            callbacks.Attack(target.id, target.name);
        }
    });
    Logger.log("Finished loading select phase");
    return controllers;
}

export function initAttackPhase(
    attackData, // Expects layout, attackTypes, nodeTypes and attacks
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
    controls.camera.autoRotate = false;
    controls.drag.enabled = false;
    managers.Physics.deactivate(); // there won't be any physics updates to calculate, as long as the loaded layout doesn't have any illegal positions...
    managers.Node.clear();
    managers.Overlay.clear();
    managers.Listener?.clear();
    layoutFromJsonObj(attackData.layout, scene, controls.drag, managers.Node);
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
    controllers.Overlay.init(controls, {
        Mouse: managers.Mouse,
        ...controllers,
    });
    controllers.Listener.listener(rendererDom).add("clicked", function (event) {
        const clickedNodeId = controllers.Node.getNodeFromFlatCoordinate(
            managers.Mouse.position
        );
        if (clickedNodeId && controllers.Overlay.focusedNodeId != clickedNodeId)
            controllers.Overlay.focusNode(clickedNodeId);
        else controllers.Overlay.unfocusNode();
    });
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
    controls.camera.autoRotate = false;
    controls.drag.enabled = true;
    managers.Physics.activate();
    managers.Node.clear();
    managers.Overlay.clear();
    managers.Listener?.clear();
    layoutFromJsonObj(layoutData, scene, controls.drag, managers.Node);
    const controllers = {
        Node: new BuildNodeManager(...managers.Node._constructorArgs),
        Overlay: new BuildOverlayManager(...managers.Overlay._constructorArgs),
        Listener: new ListenerManager(),
    };
    controllers.Overlay.init(controls, {
        Mouse: managers.Mouse,
        Node: controllers.Node,
    });
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
    controllers.Listener.listener(rendererDom).add("clicked", function (event) {
        const clickedNodeId = controllers.Node.getNodeFromFlatCoordinate(
            managers.Mouse.position
        );
        if (clickedNodeId && controllers.Overlay.focusedNodeId != clickedNodeId)
            controllers.Overlay.focusNode(clickedNodeId);
        else controllers.Overlay.unfocusNode();
    });
    Logger.log("Finished loading build phase");
    return controllers;
}

export async function getClipboardText() {
    try {
        return await navigator.clipboard.readText();
    } catch (err) {
        // cases where permission is denied or clipboard is empty/non-text
        Logger.error("Failed to read clipboard contents");
        Logger.error(err);
    }
}

export const _DebugTool = {
    // [!] for testing
    trace: function (reason = false) {
        try {
            throw new Error("Trace point");
        } catch (e) {
            Logger.log(
                `${reason ? `"${reason}"\n` : ""}Trace point:\n${e.stack}`
            ); // Stack trace as a string
        }
    },
    exportLogger: function (scene, nodeManager, logger) {
        const layoutData = layoutToJson(scene, nodeManager, false);
        const domData = document.documentElement.outerHTML;
        Logger.log("Generating debug file for download");
        download(
            `CUBE_GAME-${new Date().toISOString()}.log`,
            `===[LAYOUT]===\n${layoutData}\n===[DOM]===\n${domData}\n===[CONSOLE]===\n${logger.history}\n`
        );
    },
    marker: function (
        scene = undefined,
        position = undefined,
        markerColor = 0x00ff00,
        markerRadius = 0.05,
        direction = undefined,
        lineLength = 1
    ) {
        const geometry = new THREE.SphereGeometry(markerRadius, 32, 32);
        const material = new THREE.MeshBasicMaterial({
            color: markerColor,
        });
        const marker = new THREE.Mesh(geometry, material);
        if (position && scene) {
            marker.position.copy(position);
            if (direction) {
                const linegeo = new THREE.BufferGeometry().setFromPoints([
                    position,
                    position
                        .clone()
                        .sub(direction.clone().multiplyScalar(lineLength)),
                ]);
                const linemat = new THREE.LineBasicMaterial({ color: markerColor });
                const line = new THREE.Line(linegeo, linemat);
                marker.attach(line);
            }

            scene.add(marker);
            Logger.info("Added marker: ", marker);
        }
        return marker;
    },
    markRaycaster: function (
        scene,
        raycaster,
        lineLength = 1,
        markerColor = 0x00ff00,
        markerRadius = 0.05,
    ) {
        return _DebugTool.marker(
            scene,
            raycaster.ray.origin,
            markerColor,
            markerRadius,
            raycaster.ray.direction,
            lineLength
        );
    },
};

function NodeObject(type, uuid, position, data = {}) {
    this.uuid = uuid;
    this.type = type;
    this.position = position;
    this._data = data;
}
