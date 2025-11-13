import {
    Vector3,
    Quaternion,
    AnimationMixer,
    Group,
    Mesh,
    MeshPhongMaterial,
    MeshBasicMaterial,
    MeshPhysicalMaterial,
    CylinderGeometry,
    VideoTexture,
    RGBAFormat,
    RepeatWrapping
} from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import * as UTIL from "./utils.js";

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
    Object.defineProperty(wrapper.userData, "tetherlist", {
        get: function() {
            return [...Object.values(wrapper.userData.tethers.origin), ...Object.values(wrapper.userData.tethers.target)];
        }
    });
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
        mesh.userData.nodeid = wrapper.uuid;
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
    // Line2 does not implement a toJSON method, and any attempt to serialize the object normally causes an error.
    //  so, we create one ourselves
    tether.toJSON = function () {
        return {uuid: tether.uuid, ...tether.userData};
    }
    tether.userData.vectors = {
        origin: new Vector3(),
        target: new Vector3()
    }
    tether.userData.update = function () {
        tether.geometry.setFromPoints([tether.userData.origin.position, tether.userData.target.position]);
        tether.userData.vectors.origin.copy(tether.userData.origin.position);
        tether.userData.vectors.target.copy(tether.userData.target.position);
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
    Cube: function (sceneData, animationOptions = {idle: true, randomize: true}) {
        const cube = Node(sceneData.mesh, sceneData.animations);
        cube.userData.children("cube").material = new MeshPhongMaterial({
            color: 0x000000
        });
        cube.userData.type = "cube";
        cube.userData.state = {
            setLowPerformance: function () {},
            setHighPerformance: function () {}
        };
        if (animationOptions) {
            if (animationOptions.randomize) {
                cube.userData.mixer.setTime(animationOptions.randomize ? UTIL.random(0.05, 2) : 0);
                cube.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                cube.userData.animations["cube-idle"].play();
            }
        }
        return cube;
    },
    Globe: function (sceneData, animationOptions = {idle: true, randomize: true}) {
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
            transmission: 0.9,
            roughness: 0.2
        });
        globe.userData.state = {
            setLowPerformance: function () {
                globe.userData.children("globe").userData.children("ball").material = new MeshPhongMaterial({
                    color: 0xffffff,
                    specular: 0xff0000,
                    shininess: 0
                });
            },
            setHighPerformance: function () {
                globe.userData.children("globe").userData.children("ball").material = new MeshPhysicalMaterial({
                    transmission: 0.9,
                    roughness: 0.2
                });
            }
        };
        // transparent objects that are nested are not rendered. Tell the renderer to draw our nested transparent mesh FIRST so it actually does it
        globe.userData.children("globe").userData.children("frame").renderOrder = 1;
        globe.userData.children("globe").renderOrder = 1;
        globe.userData.type = "globe";
        globe.scale.set(0.65, 0.65, 0.65);
        if (animationOptions) {
            if (animationOptions.randomize) {
                globe.userData.mixer.setTime(animationOptions.randomize ? UTIL.random(0.05, 2) : 0);
                globe.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                globe.userData.animations["frame-idle"].play();
                globe.userData.animations["ball-idle"].play();
            }
        }
        return globe;
    },
    Scanner: function (sceneData, animationOptions = {idle: true, randomize: true}) {
        const scanner = Node(sceneData.mesh, sceneData.animations);
        const ballMat = new MeshPhongMaterial({ color: 0x000000 });
        const pupilMat = new MeshPhongMaterial({
            toneMapped: false,
            color: 0x880101,
            emissive: 0xff0000,
            emissiveIntensity: 7
        })
        scanner.userData.state = {
            setLowPerformance: function () {},
            setHighPerformance: function () {}
        };
        scanner.userData.children("ball").material = ballMat;
        scanner.userData.children("ball").userData.children("pupil").material = pupilMat;
        scanner.userData.type = "scanner";
        scanner.scale.set(0.7, 0.7, 0.7);
        if (animationOptions) {
            if (animationOptions.randomize) {
                scanner.userData.mixer.setTime(animationOptions.randomize ? UTIL.random(0.05, 2) : 0);
                scanner.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                scanner.userData.animations["ball-idle"].play();
                scanner.userData.animations["pupil-idle"].play();
            }
        }
        return scanner;
    }
};
const Attack = {
    Beam: function (videopath, maskpath, tether, thickness = 0.2, segments = 5) {
        const { origin, target } = tether.userData.vectors;
        Logger.log(origin, target);
        const height = origin.distanceTo(target);
        const geometry = new CylinderGeometry(1, 1, 1, segments, 1, true);
        geometry.translate( 1, 1/2, 1 ); // make origin point for translations the end instead of midpoint to save headache later


        const videoEl = createVideoElement(videopath, 1.7);
        const maskEl = createVideoElement(maskpath, 1.7);

        const texture = new VideoTexture(videoEl);
        texture.format = RGBAFormat;
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.repeat.set(
            Math.ceil(segments / 2), // # of sides (excluding caps)
            1 // # of repeats on each side
        );
        texture.offset.set(0, 0);
        texture.needsUpdate = true;

        const mask = new VideoTexture(maskEl);
        mask.format = RGBAFormat;
        mask.wrapS = RepeatWrapping;
        mask.wrapT = RepeatWrapping;
        mask.repeat.set(
            Math.ceil(segments / 2), // # of sides (excluding caps)
            1 // # of repeats on each side
        );
        mask.offset.set(0, 0);
        mask.needsUpdate = true;

        const material = new MeshBasicMaterial({ map: texture, alphaMap: mask, transparent: true });

        const cylinder_must_not_be_harmed = new Mesh(geometry, material);
        cylinder_must_not_be_harmed.scale.set(thickness, height, thickness);
        texture.repeat.set(1/thickness, 1/height);
        mask.repeat.set(1/thickness, 1/ height);

        cylinder_must_not_be_harmed.position.copy(origin);
        // sure, whatever the fuck this means...
        const direction = target.clone().sub(origin).normalize();
        const quaternion = new Quaternion().setFromUnitVectors(cylinder_must_not_be_harmed.up, direction);
        cylinder_must_not_be_harmed.setRotationFromQuaternion(quaternion);

        cylinder_must_not_be_harmed.userData = {
            textureElement: {
                video: videoEl,
                mask: maskEl
            },
            tetherid: tether.uuid,
            play: function () {
                this.textureElement.video.play();
                this.textureElement.mask.play();
            },
            load: function () {
                this.textureElement.video.load();
                this.textureElement.mask.load();
            },
            pause: function () {
                this.textureElement.video.pause();
                this.textureElement.mask.pause();
            },
            get currentTime() {
                return this.textureElement.video.currentTime;
            },
            set currentTime(value) {
                this.textureElement.video.currentTime = value;
                this.textureElement.mask.currentTime = value;
            },
            get ended() {
                return this.textureElement.video.ended;
            },
            get paused() {
                return this.textureElement.video.paused;
            },
            get duration() {
                return this.textureElement.video.duration;
            },
            set onended(callback) { // simpler substitute for replacing event listeners
                this.textureElement.video.onended = callback;
            }
        };

        return cylinder_must_not_be_harmed;
    }
};

function createVideoElement(videopath, speed = 1) {
    const videoEl = document.createElement("video");
    videoEl.src = videopath;
    videoEl.playbackRate = speed;
    videoEl.crossOrigin = "anonymous";
    // we will manually loop so callbacks can be set at the end of every loop
    videoEl.autoplay = false;
    videoEl.loop = false;
    videoEl.muted = true; // [!] muted autoplay required by most browsers
    videoEl.style.display = "none";
    return videoEl;
}

export { Tether, Nodes, Node, Attack };