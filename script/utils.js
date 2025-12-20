import { loadTextureCube } from "./three-utils.js";
import * as THREE from "three";

const b64RegPattern =
    /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
const backgroundPath = (backgroundName) => `./source/bg/${backgroundName}/`;
const darkBg = new THREE.Color(0x010101);
const lightBg = new THREE.Color(0xdddddd);

function nestedSetEquals(set1, set2) {
    // [!] only compares to a depth of 2
    for (const item1 of set1) {
        let found = false;
        for (const item2 of set2) {
            if (item1.symmetricDifference(item2).size === 0) {
                found = true;
                break;
            }
        }
        if (!found) return false;
    }
    for (const item2 of set2) {
        let found = false;
        for (const item1 of set1) {
            if (item2.symmetricDifference(item1).size === 0) {
                found = true;
                break;
            }
        }
        if (!found) return false;
    }
    return true;
}

export function loadBackgroundTexture(
    background,
    scene,
    loadingBg = undefined
) {
    scene.background = loadingBg
        ? loadingBg
        : background.endsWith("dark")
        ? darkBg
        : lightBg;
    return loadTextureCube(backgroundPath(background), ".png").then((tex) => {
        scene.background = tex;
        scene.userData.background = background;
        return true;
    });
}

export function loadAudio(src, ctx) {
    return fetch(src)
        .then((resp) => resp.arrayBuffer())
        .then((buffer) => ctx.decodeAudioData(buffer));
}

export function banksEqual(me, them) {
    const myKeys = Object.keys(me);
    const theirKeys = Object.keys(them);
    return (
        new Set(myKeys).symmetricDifference(new Set(theirKeys)).size === 0 &&
        myKeys.every((key) => me[key] == them[key])
    );
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

export function sum(...values) {
    return values.length == 1 && Array.isArray(values)
        ? values[0].reduce((acc, curr) => acc + curr, 0)
        : values.reduce((acc, curr) => acc + curr, 0);
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
            return DEFAULT.GEO;
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

export function layoutsEqual(thisLayout, thatLayout) {
    // [!] currently, does not evaluate position changes. not sure if I want to implement that since the nodes float around passively...
    try {
        const thisNodes = thisLayout.layout.nodes;
        const thatNodes = thatLayout.layout.nodes;
        const thisNeighbors = new Set(
            thisLayout.layout.neighbors.map((edge) => new Set(edge))
        );
        const thatNeighbors = new Set(
            thatLayout.layout.neighbors.map((edge) => new Set(edge))
        );
        const thisNodeTypes = {};
        const thatNodeTypes = {};

        thisNodes.forEach(({ type, position }) => {
            if (!thisNodeTypes[type]) thisNodeTypes[type] = 1;
            else thisNodeTypes[type] += 1;
        });
        thatNodes.forEach(({ type, position }) => {
            if (!thatNodeTypes[type]) thatNodeTypes[type] = 1;
            else thatNodeTypes[type] += 1;
        });
        return (
            thisLayout.background == thatLayout.background &&
            thisNodes.length == thatNodes.length &&
            nestedSetEquals(thisNeighbors, thatNeighbors) &&
            Object.entries(thisNodeTypes).every(
                ([type, count]) => thatNodeTypes[type] == count
            ) &&
            Object.entries(thatNodeTypes).every(
                ([type, count]) => thisNodeTypes[type] == count
            )
        );
    } catch {
        // if a layout is missing an expected property, it means it's not a Layout. which likely means its NOT equal to whatever we're trying to compare anyways.
        Logger.info("Failed to compare Layouts");
        return false;
    }
}
export function shallowObjectsEqual(thisObj, thatObj) {
    if (Boolean(thisObj) != Boolean(thatObj)) return false; // one of the objects is falsey, likely undefined
    try {
        const thisKeys = new Set(Object.keys(thisObj));
        const thatKeys = new Set(Object.keys(thatObj));
        return (
            thisKeys.size == thatKeys.size &&
            thisKeys.symmetricDifference(thatKeys).size == 0 &&
            [...thisKeys].every(type => thisKeys[type] == thatKeys[type])
        );
    } catch {
        Logger.info("Failed to compare Objects:", thisObj, thatObj);
        return false;
    }
}
function getAllPropertyDescriptors(obj) {
    const descriptors = {};
    const keysThatBreakThisFunction = new Set([
        // dont overwrite these properties
        "hasOwnProperty"
    ]);
    let curr = obj;
    while (curr !== null) {
        const ownKeys = Reflect.ownKeys(curr);
        for (const key of ownKeys)
            try {
                if (
                    !keysThatBreakThisFunction.has(key) &&
                    (
                        (Object.hasOwn && !Object.hasOwn(descriptors, key)) || // use hasOwn where supported (MS Edge is gay)
                        !descriptors.hasOwnProperty(key)
                    )
                )
                    descriptors[key] = Object.getOwnPropertyDescriptor(curr, key);
            } catch (err) {
                Logger.warn(`Error while parsing property descriptors: `, err, descriptors);
            }

        curr = Object.getPrototypeOf(curr);
    }
    return descriptors;
}

export function CollectionWrapper(array) {
    const wrapper = {};
    const descriptors = Object.entries(getAllPropertyDescriptors(array[0]));
    descriptors.forEach(([prop, descriptor]) => {
        if (typeof descriptor.value === "function")
            wrapper[prop] = function (...args) {
                return Array.from(array, (element) => element[prop](...args));
            }
        else
            Object.defineProperty(wrapper, prop, {
                get: function () {
                    return Array.from(array, (element) => element[prop]);
                },
                set: function(value) {
                    return Array.from(array, (element) => element[prop] = value);
                },
                enumerable: descriptor.enumerable,
                configurable: descriptor.configurable,
            });
    });
    return wrapper;
}
export function layoutToJsonObj(scene, nodeManager) {
    const data = {
        background: scene.userData?.background
            ? scene.userData.background
            : DEFAULT.BG,
        layout: {
            nodes: [],
            neighbors: [],
        },
    };
    const newIds = {};
    nodeManager.nodelist.forEach((node, i) => {
        const posData = node.position.clone().round();
        data.layout.nodes.push(
            new NodeObject(
                node.userData.type,
                `${i}`,
                [posData.x, posData.y, posData.z],
                node.userData?.exportData ? node.userData.exportData : {}
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

export function getStoredCurrencyFromLayout(layoutObj) {
    // [!] may be redundant, but it seems wasteful to init a brand new NodeManager just for this...
    const bank = {
        cash: 0,
        crypto: 0,
    };
    layoutObj.layout.nodes.forEach((node) => {
        if (node._data?.store)
            bank[node._data.store.type] += node._data.store.amount;
    });
    return bank;
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
        let res;
        if (jsonObj.background)
            try {
                res = loadBackgroundTexture(jsonObj.background, scene);
            } catch (error) {
                Logger.error(
                    `Failed to load background from source: ${jsonObj.background}`
                );
                Logger.error(error);
                res = loadBackgroundTexture(DEFAULT.BG, scene);
            }
        return res.then((_) => {
            jsonObj.layout.nodes.forEach((node) => {
                const newId = nodeManager.createNode(
                    node.type,
                    node.position,
                    node._data
                );
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
        });
    } catch (error) {
        Logger.error(`Error loading layout: `, jsonObj);
        Logger.error(error);
        return Promise.resolve(false);
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
    return Array.from(selected, (idx) => array[idx]);
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
        download(`CUBE_GAME-${new Date().toISOString()}.log`, `=== [LOG] ===\n${logger.history}\n\n=== [LAYOUT] ===\n${layoutData}\n\n=== [DOM] ===\n${domData}`);
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
                const linemat = new THREE.LineBasicMaterial({
                    color: markerColor,
                });
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
        markerRadius = 0.05
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
