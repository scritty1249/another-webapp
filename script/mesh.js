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
    RepeatWrapping,
    DoubleSide,
    FrontSide,
    BackSide,
    Path,
    EdgesGeometry,
    LineSegments
} from "three";
import * as THREE from 'three';
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import * as UTIL from "./utils.js";

const InvisibleMat = new MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
});

function recurseMeshChildren(mesh, maxDepth, callback, ...args) {
    if (maxDepth >= 0) {
        callback(mesh, ...args);
        mesh.children.forEach((child) =>
            recurseMeshChildren(child, maxDepth - 1, callback, ...args)
        );
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
        get: function () {
            return [
                ...Object.values(wrapper.userData.tethers.origin),
                ...Object.values(wrapper.userData.tethers.target),
            ];
        },
    });
    wrapper.userData.traverseMesh = function (callback, ...args) {
        wrapper.children.forEach((parentMesh) =>
            recurseMeshChildren(parentMesh, 3, callback, ...args)
        );
    };
    wrapper.userData.addAnimation = function (animation, secDelay = 0) {
        wrapper.userData.animations[animation.name] =
            wrapper.userData.mixer.clipAction(animation);
        wrapper.userData.animations[animation.name].startAt(
            wrapper.userData.mixer.time + secDelay
        );
        return wrapper.userData.animations[animation.name];
    };
    wrapper.userData.updateAnimations = function (timedelta) {
        Object.values(wrapper.userData.animations).forEach(
            (animationAction) =>
                (animationAction.clampWhenFinished = wrapper.userData.dragged)
        );
        if (wrapper.userData.mixer) {
            wrapper.userData.mixer.update(timedelta);
        }
    };
    wrapper.userData.children = function (name) {
        const child = wrapper.children.filter((c) => c.name == name);
        return child ? child.at(0) : undefined;
    };
    wrapper.userData.traverseMesh(function (mesh) {
        mesh.userData.nodeid = wrapper.uuid;
        mesh.userData.children = function (name) {
            const child = mesh.children.filter((c) => c.name == name);
            return child ? child.at(0) : undefined;
        };
    });
    Object.values(animations).forEach((animation) =>
        wrapper.userData.addAnimation(animation)
    );
    return wrapper;
}

function Outline(targetmesh) {
    const outlineMaterial = new MeshBasicMaterial({
        color: 0x0000ff, // Outline color (e.g., blue)
        side: BackSide // Crucial for rendering only the back faces
    });

    const outlineMesh = new THREE.Mesh(targetmesh.geometry, outlineMaterial);
    outlineMesh.scale.copy(targetmesh.scale); // Match the original scale
    outlineMesh.scale.multiplyScalar(1.05); // Slightly enlarge for the outline effect

    // Position the outline mesh at the same position as the original
    outlineMesh.position.copy(targetmesh.position);
    outlineMesh.quaternion.copy(targetmesh.quaternion);

    // Add the outline mesh to the scene
    targetmesh.add(outlineMesh);
    return outlineMesh;
}

function SelectionGlobe(sceneData, radius = 5, widthSeg = 32, heightSeg = 32) {
    const wrapper = new Group();
    const matt = new MeshPhongMaterial({
        color: 0xaa0000,
        side: DoubleSide,
        specular: 0xaa0505,
        shininess: 65,
    });
    wrapper.add(sceneData.mesh.children[1].clone());
    wrapper.add(sceneData.mesh.children[0].clone());
    wrapper.scale.setScalar(6);
    wrapper.userData = {...wrapper.userData,
        core: wrapper.children[1],
        get radius () {
            return radius;
        },
        get children () {
            return wrapper.children[0].children;
        },
    };
    wrapper.children[0].material = InvisibleMat;
    wrapper.userData.core.material = new MeshPhysicalMaterial({
        transmission: 0.85,
        roughness: 0.65,
        reflectivity: 0.4,
        specularColor: 0x050505,
    });
    wrapper.userData.children.forEach(child => {
        child.material = matt;
        child.userData = {...child.userData,
            position: {
                origin: child.position.clone(),
                target: child.position.clone(),
                lerpSpeed: 0.12,
                get needsUpdate() {
                    return child.position.distanceTo(this.target) > 0.01;
                },
                update: function () {
                    if (child.position.distanceTo(this.target) <= 0.01)
                        child.position.copy(this.target); // snap to distnace
                    else
                        child.position.lerpVectors(child.position, this.target, this.lerpSpeed);
                },
            },
            scale: {
                origin: child.scale.clone(),
                target: child.scale.clone(),
                lerpSpeed: 0.12,
                get needsUpdate() {
                    return child.scale.distanceTo(this.target) > 0.01;
                },
                update: function () {
                    if (child.scale.distanceTo(this.target) <= 0.01)
                        child.scale.copy(this.target); // snap to distnace
                    else
                        child.scale.lerpVectors(child.scale, this.target, this.lerpSpeed);
                }, 
            },
            update: function () {
                if (this.scale.needsUpdate)
                    this.scale.update();
                if (this.position.needsUpdate)
                    this.position.update();
            },
            scaleTo: function (targetScale, lerpSpeed = undefined) {
                this.scale.target.copy(this.scale.origin.clone().multiplyScalar(targetScale));
                if (lerpSpeed)
                    this.scale.lerpSpeed = lerpSpeed;
            },
            moveTo: function (targetPos, lerpSpeed = undefined) { // expects Vector3
                this.position.target.copy(targetPos);
                if (lerpSpeed)
                    this.position.lerpSpeed = lerpSpeed;
            },
            revert: function (lerpSpeed = undefined) {
                this.scaleTo(1, lerpSpeed);
                this.moveTo(this.position.origin, lerpSpeed);
            }
        };
    });

    return wrapper;
}
function Beam(
    videopath,
    maskpath,
    thickness = 0.5,
    segments = 5,
    repeatSides = 5
) {
    const geometry = new CylinderGeometry(
        thickness,
        thickness,
        thickness,
        segments,
        1,
        true
    );
    // geometry.translate( thickness, thickness/2, thickness ); // make origin point for translations the end instead of midpoint to save headache later
    const {
        video: videoEl,
        mask: maskEl,
        promise,
    } = UTIL.loadVideoTextureSource(videopath, maskpath, 4);
    const materialPlaceholder = new MeshBasicMaterial({
        transparent: true,
        opacity: 0,
    });
    const cylinder_must_not_be_harmed = new Mesh(geometry, materialPlaceholder);

    cylinder_must_not_be_harmed.userData = {
        textureElement: {
            video: videoEl,
            mask: maskEl,
        },
        update: function () {
            cylinder_must_not_be_harmed.position.copy(this.position.current);
        },
        start: function (startPercent = 0.0) {
            // float between 0 and 1
            if (this.ready && startPercent >= Number.EPSILON)
                this.elapsed = UTIL.clamp(startPercent, 0.0, 1.0);
            else this.video.elapsed = 0;
            this.video.play();
        },
        get elapsed() {
            // returns a percentage of duration as float (should be 0-1), instead of seconds elapsed
            return this.video.elapsed / this.video.duration;
        },
        set elapsed(percent) {
            // float between 0 and 1
            this.video.elapsed = this.video.duration * percent;
        },
        set callback(callback) {
            // [!] redunant convenience function, may remove later
            this.video.onended = callback;
        },
        get ready() {
            return this.video.duration === NaN;
        },
        set: function (originVector, targetVector) {
            this.position.start.copy(originVector);
            this.position.end.copy(targetVector);
            cylinder_must_not_be_harmed.position.copy(originVector);
            // sure, whatever the fuck this means...
            const quaternion = new Quaternion().setFromUnitVectors(
                cylinder_must_not_be_harmed.up,
                this.position.direction
            );
            cylinder_must_not_be_harmed.setRotationFromQuaternion(quaternion);
        },
        setOrigin: function (originVector) {
            this.set(originVector, this.position.end);
        },
        setTarget: function (targetVector) {
            this.set(this.position.start, targetVector);
        },
        position: {
            start: new Vector3(),
            end: new Vector3(),
            get direction() {
                return this.start.clone().sub(this.end).normalize();
            },
            get current() {
                return this.end
                    .clone()
                    .sub(this.start)
                    .multiplyScalar(
                        cylinder_must_not_be_harmed.userData.elapsed
                    )
                    .add(this.start);
            },
        },
        video: {
            play: function () {
                cylinder_must_not_be_harmed.userData.textureElement.video.play();
                cylinder_must_not_be_harmed.userData.textureElement.mask.play();
            },
            load: function () {
                cylinder_must_not_be_harmed.userData.textureElement.video.load();
                cylinder_must_not_be_harmed.userData.textureElement.mask.load();
            },
            pause: function () {
                cylinder_must_not_be_harmed.userData.textureElement.video.pause();
                cylinder_must_not_be_harmed.userData.textureElement.mask.pause();
            },
            get elapsed() {
                return cylinder_must_not_be_harmed.userData.textureElement.video
                    .currentTime;
            },
            set elapsed(seconds) {
                cylinder_must_not_be_harmed.userData.textureElement.video.currentTime =
                    seconds;
                cylinder_must_not_be_harmed.userData.textureElement.mask.currentTime =
                    seconds;
            },
            get ended() {
                return cylinder_must_not_be_harmed.userData.textureElement.video
                    .ended;
            },
            get paused() {
                return cylinder_must_not_be_harmed.userData.textureElement.video
                    .paused;
            },
            get duration() {
                return cylinder_must_not_be_harmed.userData.textureElement.video
                    .duration;
            },
            set onended(callback) {
                // simpler substitute for replacing event listeners
                cylinder_must_not_be_harmed.userData.textureElement.video.onended =
                    callback;
            },
        },
    };

    promise.then(([videoEl, maskEl]) => {
        // videoEl.playbackRate = 5;
        // maskEl.playbackRate = 5;
        const texture = new VideoTexture(videoEl);
        texture.format = RGBAFormat;
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.repeat.set(
            repeatSides, // # of sides (excluding caps)
            1 // # of repeats on each side
        );
        texture.needsUpdate = true;

        const mask = new VideoTexture(maskEl);
        mask.format = RGBAFormat;
        mask.wrapS = RepeatWrapping;
        mask.wrapT = RepeatWrapping;
        mask.repeat.set(
            repeatSides, // # of sides (excluding caps)
            1 // # of repeats on each side
        );
        mask.needsUpdate = true;
        cylinder_must_not_be_harmed.material.copy(
            new MeshBasicMaterial({
                map: texture,
                alphaMap: mask,
                transparent: true,
                side: DoubleSide,
            })
        );
    });
    return cylinder_must_not_be_harmed;
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
        return { uuid: tether.uuid, ...tether.userData };
    };
    tether.userData.vectors = {
        origin: new Vector3(),
        target: new Vector3(),
    };
    tether.userData.update = function () {
        tether.geometry.setFromPoints([
            tether.userData.origin.position,
            tether.userData.target.position,
        ]);
        tether.userData.vectors.origin.copy(tether.userData.origin.position);
        tether.userData.vectors.target.copy(tether.userData.target.position);
        tether.geometry.attributes.position.needsUpdate = true;
    };
    tether.userData.set = function (origin, target) {
        tether.userData.origin = origin;
        tether.userData.target = target;
        tether.userData.update();
    };
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
    Cube: function (
        sceneData,
        animationOptions = { idle: true, randomize: true }
    ) {
        const cube = Node(sceneData.mesh, sceneData.animations);
        cube.userData.children("cube").material = new MeshPhongMaterial({
            color: 0x000000,
        });
        cube.userData.type = "cube";
        cube.userData.state = {
            setLowPerformance: function () {},
            setHighPerformance: function () {},
        };
        if (animationOptions) {
            if (animationOptions.randomize) {
                cube.userData.mixer.setTime(
                    animationOptions.randomize ? UTIL.random(0.05, 2) : 0
                );
                cube.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                cube.userData.animations["cube-idle"].play();
            }
        }
        return cube;
    },
    Globe: function (
        sceneData,
        animationOptions = { idle: true, randomize: true }
    ) {
        const globe = Node(sceneData.mesh, sceneData.animations);
        const lowPerfMat = new MeshPhongMaterial({
            color: 0xffffff,
            specular: 0xff0000,
            shininess: 0,
        });
        const highPerfMat = new MeshPhysicalMaterial({
            transmission: 0.9,
            roughness: 0.2,
        });
        globe.userData.children("globe").material = InvisibleMat;
        globe.userData.children("globe").userData.children("frame").material =
            new MeshPhongMaterial({
                color: 0x880101,
                specular: 0xff0000,
                shininess: 100,
            });
        globe.userData.children("globe").userData.children("ball").material =
            highPerfMat;
        globe.userData.state = {
            setLowPerformance: function () {
                globe.userData
                    .children("globe")
                    .userData.children("ball").material = lowPerfMat;
                globe.userData
                    .children("globe")
                    .userData.children("ball").material.needsUpdate = true;
            },
            setHighPerformance: function () {
                globe.userData
                    .children("globe")
                    .userData.children("ball").material = highPerfMat;
                globe.userData
                    .children("globe")
                    .userData.children("ball").material.needsUpdate = true;
            },
        };
        // transparent objects that are nested are not rendered. Tell the renderer to draw our nested transparent mesh FIRST so it actually does it
        globe.userData
            .children("globe")
            .userData.children("frame").renderOrder = 1;
        globe.userData.children("globe").renderOrder = 1;
        globe.userData.type = "globe";
        globe.scale.setScalar(0.65);
        if (animationOptions) {
            if (animationOptions.randomize) {
                globe.userData.mixer.setTime(
                    animationOptions.randomize ? UTIL.random(0.05, 2) : 0
                );
                globe.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                globe.userData.animations["frame-idle"].play();
                globe.userData.animations["ball-idle"].play();
            }
        }
        return globe;
    },
    Scanner: function (
        sceneData,
        animationOptions = { idle: true, randomize: true }
    ) {
        const scanner = Node(sceneData.mesh, sceneData.animations);
        const ballMat = new MeshPhongMaterial({ color: 0x000000 });
        const pupilMat = new MeshPhongMaterial({
            toneMapped: false,
            color: 0x880101,
            emissive: 0xff0000,
            emissiveIntensity: 7,
        });
        scanner.userData.state = {
            setLowPerformance: function () {},
            setHighPerformance: function () {},
        };
        scanner.userData.children("ball").material = ballMat;
        scanner.userData.children("ball").userData.children("pupil").material =
            pupilMat;
        scanner.userData.type = "scanner";
        scanner.scale.setScalar(0.7);
        if (animationOptions) {
            if (animationOptions.randomize) {
                scanner.userData.mixer.setTime(
                    animationOptions.randomize ? UTIL.random(0.05, 2) : 0
                );
                scanner.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                scanner.userData.animations["ball-idle"].play();
                scanner.userData.animations["pupil-idle"].play();
            }
        }
        return scanner;
    },
    Placeholder: function (
        sceneData,
        animationOptions = { idle: true, randomize: true }
    ) {
        const cube = Node(sceneData.mesh, sceneData.animations);
        const lowPerfMat = new MeshPhongMaterial({
            color: 0x757575,
            shininess: 80,
        });
        const highPerfMat = new MeshPhysicalMaterial({
            color: 0x757575,
            transmission: 0.3,
            roughness: 0.2,
        });
        cube.userData.state = {
            setLowPerformance: function () {
                cube.userData.children("Cube").material = lowPerfMat;
                cube.userData.children("Cube").material.needsUpdate = true;
            },
            setHighPerformance: function () {
                cube.userData.children("Cube").material = highPerfMat;
                cube.userData.children("Cube").material.needsUpdate = true;
            },
        };
        cube.userData.children("Cube").material = highPerfMat;
        cube.userData.type = "placeholder";
        cube.scale.setScalar(0.45);
        if (animationOptions) {
            if (animationOptions.randomize) {
                cube.userData.mixer.setTime(
                    animationOptions.randomize ? UTIL.random(0.05, 2) : 0
                );
                cube.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                cube.userData.animations["cube-idle"].play();
            }
        }
        return cube;
    },
};
const Attack = {
    Particle: function () {
        const particle = Beam(
            "./source/attacks/particle/attack.mp4",
            "./source/attacks/particle/attack-mask.mp4",
            0.55,
            16,
            3
        );
        particle.userData.type = "particle";
        return particle;
    },
    CubeDefense: function () {
        const cubeDefense = Beam(
            "./source/attacks/particle/attack.mp4",
            "./source/attacks/particle/attack-mask.mp4",
            0.65,
            16,
            1
        );
        cubeDefense.userData.type = "cubedefense";
        return cubeDefense;
    },
};

export { Tether, Nodes, Node, Attack, SelectionGlobe, Outline };
