import * as UTIL from "./three-utils.js";

export function layoutToJson(shapes) {
    const data = {
        nodes: [],
        neighbors: [],
        background: 0xff3065
    };
    const neighbors = new Set();
    shapes.forEach((shape, i) => {
        data.nodes.push(
            new NodeObject(shape.userData.type, shape.uuid, shape.position)
        );
        [
            ...shape.userData.lines.target.map(other => other.userData.origin),
            ...shape.userData.lines.origin.map(other => other.userData.target)
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