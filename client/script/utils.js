export function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}

export function random(min, max) {
    return Math.random() * (max - min) + min;
}

export function deepCopy(obj) { // ONYL FOR NORMAL JS OBJECTS. threejs objects have a dedicated stringify method!
    return JSON.parse(JSON.stringify(obj));
}

export function layoutToJson(shapes) {
    const data = {
        nodes: [],
        neighbors: [],
        background: 0xff3065
    };
    const neighbors = new Set();
    shapes.forEach((shape, i) => {
        data.nodes.push(
            new NodeObject(shape.userData.type, shape.uuid, shape.position.round())
        );
        [
            ...Object.values(shape.userData.tethers.target).map(other => other.userData.origin),
            ...Object.values(shape.userData.tethers.origin).map(other => other.userData.target)
        ].forEach(other => {
            neighbors.add(new Set([shape.uuid, other.uuid]));
        });
    });
    data.neighbors = [...neighbors].map(s => [...s]);
    return JSON.stringify(data);
}
export function layoutFromJson(json, scene, shapeData = {}) {
    const data = JSON.parse(json);
    scene.background.set(data.background);
}
function NodeObject(type, uuid, position, data = {}) {
    this.uuid = uuid;
    this.type = type;
    this.position = position;
    this._data = data;
}

function ShapeData(type, geometry, animations = {}) {
    this.type = type;
    this.geometry = geometry;
    this.animations = animations
}

function AnimationData(name, animationData, id = "shape") {
    this.name = name;
    this.animationData = animationData;
    this.id = id; // should always be exported from blender as "shape", but just in case we can configure it here...
}