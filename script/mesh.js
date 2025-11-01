import {
    Vector3,
    MeshPhongMaterial,
    Mesh,
    AnimationMixer,
    Group
} from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";

function DragShape(geometry) {
    const parent = new Group();
    parent.add(Shape(geometry, false));
    parent.children[0].parent = parent; // may be bad to have a recursive reference here
    parent.subject = parent.children[0] // easier access
    parent.dragged = false;
    parent.lines = {
        origin: [],
        target: [],
    };
    return parent;
}
function Shape(geometry) {
    const material = new MeshPhongMaterial({ color: 0x00ff00 });
    const mesh = new Mesh(geometry, material);
    console.info("Loaded mesh:", mesh);
    mesh.castShadow = true;
    mesh.name = "shape"; // needed for animation binding
    mesh.mixer = new AnimationMixer(mesh);
    mesh.animation = {}; // yes, I've overriding "animations" attribute. When importing the whole Mesh the animation array is empty anyways and IDK and IDC how to fanangle this damn thing.
    mesh.addAnimation = function(name, animation, secDelay = 0) {
        mesh.animation[name] = mesh.mixer.clipAction(animation);
        mesh.animation[name].startAt(mesh.mixer.time + secDelay);
        return mesh.animation[name];
    }
    mesh.updateAnimation = function(timedelta) {
        Array.from(mesh.animation).forEach(animationAction => animationAction.clampWhenFinished = mesh.dragged);
        if (mesh.mixer) {
            mesh.mixer.update(timedelta);
        }
    }
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

export { Tether, Shape, DragShape };