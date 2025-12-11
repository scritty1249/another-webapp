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

function nestedSetEquals (set1, set2) { // [!] only compares to a depth of 2
    for (const item1 of set1) {
        let found = false;
        for (const item2 of set2) {
            if (item1.symmetricDifference(item2).size === 0) {
                found = true;
                break;
            }
        }
        if (!found)
            return false;
    }
    for (const item2 of set2) {
        let found = false;
        for (const item1 of set1) {
            if (item2.symmetricDifference(item1).size === 0) {
                found = true;
                break;
            }
        }
        if (!found)
            return false;
    }
    return true;
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

export function getNowUTCSeconds() {
    return Math.floor(Date.now() / 1000);
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

export function layoutsEqual(thisLayout, thatLayout) { // [!] currently, does not evaluate position changes. not sure if I want to implement that since the nodes float around passively...
    try {
        const thisNodes = thisLayout.layout.nodes;
        const thatNodes = thatLayout.layout.nodes;
        const thisNeighbors = new Set(thisLayout.layout.neighbors.map(edge => new Set(edge)));
        const thatNeighbors = new Set(thatLayout.layout.neighbors.map(edge => new Set(edge)));
        const thisNodeTypes = {};
        const thatNodeTypes = {};

        thisNodes.forEach(({type, position}) => {
            if (!thisNodeTypes[type])
                thisNodeTypes[type] = 1;
            else
                thisNodeTypes[type] += 1;
        });
        thatNodes.forEach(({type, position}) => {
            if (!thatNodeTypes[type])
                thatNodeTypes[type] = 1;
            else
                thatNodeTypes[type] += 1;
        });
        return (
            thisLayout.background == thatLayout.background &&
            thisNodes.length == thatNodes.length &&
            nestedSetEquals(thisNeighbors, thatNeighbors) &&
            Object.entries(thisNodeTypes).every(([type, count]) => thatNodeTypes[type] == count) &&
            Object.entries(thatNodeTypes).every(([type, count]) => thisNodeTypes[type] == count)
        );
    } catch { // if a layout is missing an expected property, it means it's not a Layout. which likely means its NOT equal to whatever we're trying to compare anyways.
        Logger.info("failed to compare layouts");
        return false;
    }
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
                ],
                node.userData?.exportData
                ? node.userData.exportData
                : {}
            )
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

export function getRandomItems(array, count) {
    const selected = new Set();
    while (selected.size < count)
        selected.add(Math.floor(Math.random() * array.length));
    return Array.from(selected, idx => array[idx]);
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
