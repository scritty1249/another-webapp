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
        background: scene.background.toJSON() // returns as a hex value
    };
    nodeManager.nodelist.forEach(node => data.nodes.push(new NodeObject(node.userData.type, node.uuid, node.position.clone().round())));
    nodeManager.tetherlist.forEach(tether => data.neighbors.push([tether.userData.target.uuid, tether.userData.origin.uuid]));
    let dataStr = JSON.stringify(data);
    return (obfuscate) ? btoa(dataStr) : dataStr;
}
export function layoutFromJson(jsonStr, scene, nodeManager) {
    const data = JSON.parse(b64RegPattern.test(jsonStr) ? atob(jsonStr) : jsonStr);
    const newIds = {};
    scene.background.set(data.background);
    data.nodes.forEach(node => {
        const newId = nodeManager.createNode(node.type, [], node.position);
        newIds[node.uuid] = newId;
    });
    data.neighbors.forEach(tether => nodeManager.tetherNodes(newIds[tether[0]], newIds[tether[1]]));
}

const b64RegPattern = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;

function NodeObject(type, uuid, position, data = {}) {
    this.uuid = uuid;
    this.type = type;
    this.position = position;
    this._data = data;
}
