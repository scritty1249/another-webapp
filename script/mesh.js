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

function DragShape(geometry, color = 0x00ff00) {
    const parent = new Group();
    parent.add(new Shape(geometry, color));
    parent.children[0].parent = parent; // may be bad to have a recursive reference here
    parent.userData.subject = parent.children[0] // easier access
    parent.userData.dragged = false;
    parent.userData.lines = {
        origin: [],
        target: [],
    };
    return parent;
}
function Shape(geometry, color) {
    const material = new MeshPhongMaterial({ color: color });
    const mesh = new Mesh(geometry, material);
    console.info("Loaded mesh:", mesh);
    mesh.castShadow = true;
    mesh.name = "shape"; // needed for animation binding
    mesh.userData.mixer = new AnimationMixer(mesh);
    mesh.userData.animation = {}; // yes, I've overriding "animations" attribute. When importing the whole Mesh the animation array is empty anyways and IDK and IDC how to fanangle this damn thing.
    mesh.userData.addAnimation = function(name, animation, secDelay = 0) {
        mesh.userData.animation[name] = mesh.userData.mixer.clipAction(animation);
        mesh.userData.animation[name].startAt(mesh.userData.mixer.time + secDelay);
        return mesh.userData.animation[name];
    }
    mesh.userData.updateAnimation = function(timedelta) {
        Array.from(mesh.userData.animation).forEach(animationAction => animationAction.clampWhenFinished = mesh.dragged);
        if (mesh.userData.mixer) {
            mesh.userData.mixer.update(timedelta);
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
    line.userData.vectors = {
        origin: new Vector3(),
        target: new Vector3()
    }
    line.userData.update = function () {
        line.geometry.setFromPoints([line.userData.origin.position, line.userData.target.position]);
        line.userData.vectors.origin.set(line.userData.origin.position);
        line.userData.vectors.target.set(line.userData.target.position);
        line.geometry.attributes.position.needsUpdate = true;
    }
    line.userData.set = function (origin, target) {
        line.userData.origin = origin;
        line.userData.target = target;
        line.userData.update();
    }
    line.userData.set(origin, target);
    if (origin.userData.lines) {
        origin.userData.lines.origin.push(line);
    }
    if (target.userData.lines) {
        target.userData.lines.target.push(line);
    }
    return line;
}

export { Tether, Shape, DragShape };