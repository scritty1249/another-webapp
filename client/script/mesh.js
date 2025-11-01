import {
    Vector3,
    MeshPhongMaterial,
    Mesh
} from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";

function Shape(geometry, clickable = true) {
    const material = new MeshPhongMaterial({ color: 0x00ff00 });
    const mesh = new Mesh(geometry, material);
    console.info("Loaded mesh:", mesh);
    mesh.castShadow = true;
    mesh.clickable = clickable;
    mesh.dragged = false;
    mesh.lines = {
        origin: [],
        target: [],
    };
    return mesh;
}

function Tether(origin, target, color = 0xc0c0c0) {
    const material = new LineMaterial({
        color: color,
        linewidth: 2.5,
        alphaToCoverage: true,
    });
    const geometry = new LineGeometry();
    const line = new Line2(geometry, material);
    line.direction = new Vector3();
    line.vectors = {
        origin: new Vector3(),
        target: new Vector3()
    }
    line.update = function () {
        line.geometry.setFromPoints([line.origin.position, line.target.position]);
        line.vectors.origin.set(line.origin.position);
        line.vectors.target.set(line.target.position);
        line.length = line.origin.position.distanceTo(line.target.position);
        line.direction.subVectors(line.target.position, line.origin.position).normalize(); // always points from target to origin
        line.geometry.attributes.position.needsUpdate = true;
    }
    line.set = function (origin, target) {
        line.origin = origin;
        line.target = target;
        line.update();
    }
    line.set(origin, target);
    if (origin.lines) {
        origin.lines.origin.push(line);
    }
    if (target.lines) {
        target.lines.target.push(line);
    }
    return line;
}

export { Tether, Shape };