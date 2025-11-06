import {
    Vector3,
    AnimationMixer,
    Group,
    MeshPhongMaterial,
    MeshBasicMaterial,
    MeshPhysicalMaterial
} from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { random } from "./utils.js";

function recurseMeshChildren(mesh, maxDepth, callback, ...args) {
    if (maxDepth >= 0) {
        callback(mesh, ...args);
        mesh.children.forEach(child => recurseMeshChildren(child, maxDepth - 1, callback, ...args));
    }
}
function Node(mesh, animations = []) {
    const wrapper = new Group();
    wrapper.add(mesh.clone());
    wrapper.userData.dragged = false;
    wrapper.userData.mixer = new AnimationMixer(wrapper);
    wrapper.userData.animations = {};
    wrapper.userData.tethers = {
        origin: {},
        target: {},
    };
    wrapper.userData.traverseMesh = function(callback, ...args) {
        wrapper.children.forEach(parentMesh => recurseMeshChildren(parentMesh, 3, callback, ...args));
    }
    wrapper.userData.addAnimation = function(animation, secDelay = 0) {
        wrapper.userData.animations[animation.name] = wrapper.userData.mixer.clipAction(animation);
        wrapper.userData.animations[animation.name].startAt(wrapper.userData.mixer.time + secDelay);
        return wrapper.userData.animations[animation.name];
    }
    wrapper.userData.updateAnimations = function(timedelta) {
        Object.values(wrapper.userData.animations).forEach(animationAction => animationAction.clampWhenFinished = wrapper.userData.dragged);
        if (wrapper.userData.mixer) {
            wrapper.userData.mixer.update(timedelta);
        }
    }
    wrapper.userData.children = function(name) {
        const child = wrapper.children.filter(c => c.name == name);
        return child ? child.at(0) : undefined;
    }
    wrapper.userData.traverseMesh(function(mesh) {
        mesh.userData.children = function(name) {
            const child = mesh.children.filter(c => c.name == name);
            return child ? child.at(0) : undefined;
        }
    });
    Object.values(animations).forEach(animation => wrapper.userData.addAnimation(animation));
    return wrapper;
}

function Tether(origin, target, color = 0xc0c0c0) {
    const material = new LineMaterial({
        color: color,
        linewidth: 2.5,
        alphaToCoverage: true,
    });
    const geometry = new LineGeometry();
    const tether = new Line2(geometry, material);
    tether.userData.vectors = {
        origin: new Vector3(),
        target: new Vector3()
    }
    tether.userData.update = function () {
        tether.geometry.setFromPoints([tether.userData.origin.position, tether.userData.target.position]);
        tether.userData.vectors.origin.set(tether.userData.origin.position);
        tether.userData.vectors.target.set(tether.userData.target.position);
        tether.geometry.attributes.position.needsUpdate = true;
    }
    tether.userData.set = function (origin, target) {
        tether.userData.origin = origin;
        tether.userData.target = target;
        tether.userData.update();
    }
    tether.userData.set(origin, target);
    if (origin.userData.tethers) {
        origin.userData.tethers.origin[tether.uuid] = tether;
    }
    if (target.userData.tethers) {
        target.userData.tethers.target[tether.uuid] = tether;
    }
    return tether;
}
const Nodes = {
    Cube: function (sceneData, position = [0, 0, 0], animationOptions = {idle: true, randomize: true}) {
        const cube = Node(sceneData.mesh, sceneData.animations);
        cube.userData.children("cube").material = new MeshPhongMaterial({
            color: 0x000000
        });
        cube.userData.type = "cube";
        cube.position.set(...position);
        if (animationOptions && animationOptions.idle) {
            cube.userData.mixer.setTime(animationOptions.randomize ? random(0.05, 2) : 0);
            cube.userData.animations["cube-idle"].play();
        }
        return cube;
    },
    Globe: function (sceneData, position = [0, 0, 0], animationOptions = {idle: true, randomize: true}) {
        const globe = Node(sceneData.mesh, sceneData.animations);
        globe.userData.children("globe").material = new MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0
        });
        globe.userData.children("globe").userData.children("frame").material = new MeshPhongMaterial({
            color: 0x880101,
            specular: 0xff0000,
            shininess: 100
        });
        globe.userData.children("globe").userData.children("ball").material = new MeshPhysicalMaterial({
            transmission: 1,
            roughness: 0.18
        });
        // transparent objects that are nested are not rendered. Tell the renderer to draw our nested transparent mesh FIRST so it actually does it
        globe.userData.children("globe").userData.children("frame").renderOrder = 1;
        globe.userData.children("globe").renderOrder = 1;
    
        globe.userData.type = "globe";
        globe.position.set(...position);
        if (animationOptions && animationOptions.idle) {
            globe.userData.mixer.setTime(animationOptions.randomize ? random(0.05, 2) : 0);
            globe.userData.animations["frame-idle"].play();
            globe.userData.animations["ball-idle"].play();
        }
        return globe;
    },
    Scanner: function (sceneData, position = [0, 0, 0], animationOptions = {idle: true, randomize: true}) {
        const scanner = Node(sceneData.mesh, sceneData.animations);
        const ballMat = new MeshPhongMaterial({ color: 0x000000 });
        const pupilMat = new MeshPhongMaterial({
            toneMapped: false,
            color: 0x880101,
            emissive: 0xff0000,
            emissiveIntensity: 7
        })
        scanner.userData.children("ball").material = ballMat;
        scanner.userData.children("ball").userData.children("pupil").material = pupilMat;
        scanner.userData.type = "scanner";
        scanner.position.set(...position);
        if (animationOptions && animationOptions.idle) {
            scanner.userData.mixer.setTime(animationOptions.randomize ? random(0.05, 2) : 0);
            scanner.userData.animations["ball-idle"].play();
            scanner.userData.animations["pupil-idle"].play();
        }
        return scanner;
    }
};

export { Tether, Nodes, Node };