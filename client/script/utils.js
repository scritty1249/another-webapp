import { loadTextureCube } from "./three-utils.js";

export function download(filename, text) {
    const el = document.createElement('a');
    el.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    el.setAttribute('download', filename);

    el.style.display = 'none';
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

export function deepCopy(obj) { // ONYL FOR NORMAL JS OBJECTS. threejs objects have a dedicated stringify method!
    return JSON.parse(JSON.stringify(obj));
}

export function layoutToJson(scene, nodeManager, obfuscate = true) {
    const data = {
        nodes: [],
        neighbors: [],
        background: "" // [!] disabled for now
    };
    const newIds = {};
    nodeManager.nodelist.forEach((node, i) => {
        const posData = node.position.clone().round();
        data.nodes.push(
            new NodeObject(node.userData.type, `${i}`, [posData.x, posData.y, posData.z])
        );
        newIds[node.uuid] = i
    });
    nodeManager.tetherlist.forEach(tether => data.neighbors.push([newIds[tether.userData.target.uuid], newIds[tether.userData.origin.uuid]]));
    let dataStr = JSON.stringify(data);
    console.debug("Exported layout: ", data);
    return (obfuscate) ? btoa(dataStr) : dataStr;
}
export function layoutFromJson(jsonStr, scene, nodeManager) {
    const isEncoded = b64RegPattern.test(jsonStr);
    try {
        const data = JSON.parse(isEncoded ? atob(jsonStr) : jsonStr);
        const newIds = {};
        if (data.background)
            try {
                scene.background = loadTextureCube(data.background);
            } catch (error) {
                console.error(`Failed to load background from source: ${data.background}`);
                console.error(error);
            }
        data.nodes.forEach(node => {
            const newId = nodeManager.createNode(node.type, [], node.position);
            newIds[node.uuid] = newId;
        });
        data.neighbors.forEach(tether => nodeManager.tetherNodes(newIds[tether[0]], newIds[tether[1]]));
        console.debug("Loaded layout: ", data);
        return true;
    } catch (error) {
        console.error(`Error loading ${isEncoded ? "encoded " : ""}layout: `, jsonStr);
        console.error(error);
        return false;
    }
}

const b64RegPattern = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;

function NodeObject(type, uuid, position, data = {}) {
    this.uuid = uuid;
    this.type = type;
    this.position = position;
    this._data = data;
}
