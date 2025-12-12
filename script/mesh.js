import {
    Vector3,
    AnimationMixer,
    Group,
    Mesh,
    MeshPhongMaterial,
    MeshBasicMaterial,
    MeshPhysicalMaterial,
    CylinderGeometry,
    PlaneGeometry,
    FrontSide,
    Object3D,
    SphereGeometry,
} from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import * as UTIL from "./utils.js";
import * as THREEUTIL from "./three-utils.js";
import { AttackManager } from "./attacker.js";

const InvisibleMat = new MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
    visible: false,
});
function recurseMeshChildren(mesh, maxDepth, callback, ...args) {
    if (maxDepth >= 0) {
        callback(mesh, ...args);
        mesh.children.forEach((child) =>
            recurseMeshChildren(child, maxDepth - 1, callback, ...args)
        );
    }
}
function WorldMarker(startPos, endPos, lineOptions = {}) {
    const material = new LineMaterial({
        ...{
            color: 0xffffff,
            linewidth: 0.7,
            alphaToCoverage: true,
        },
        ...lineOptions,
    });
    const newStart = new Vector3();
    const newEnd = endPos.clone().sub(startPos);
    const geometry = new LineGeometry().setFromPoints([newStart, newEnd]);

    const headmat = new MeshBasicMaterial({
        color: material.color,
    });
    const headgeo = new SphereGeometry(0.03, 16, 16);
    const head = new Mesh(headgeo, headmat);
    head.position.copy(newEnd);
    const marker = new Line2(geometry, material);
    marker.attach(head);
    marker.position.copy(startPos);

    marker.userData = {
        head: head,
        get origin() {
            const origin = new Vector3(
                marker.geometry.attributes.position.array[0],
                marker.geometry.attributes.position.array[1],
                marker.geometry.attributes.position.array[2]
            );
            origin.set = function (x, y, z) {
                marker.geometry.attributes.position.array[0] = x;
                marker.geometry.attributes.position.array[1] = y;
                marker.geometry.attributes.position.array[2] = z;
                origin.x = x;
                origin.y = y;
                origin.z = z;
                marker.geometry.attributes.position.needsUpdate = true;
            };
            origin.add = function (vec) {
                origin.set(
                    origin.x + vec.x,
                    origin.y + vec.y,
                    origin.z + vec.z
                );
                return origin;
            };
            origin.sub = function (vec) {
                origin.set(
                    origin.x - vec.x,
                    origin.y - vec.y,
                    origin.z - vec.z
                );
                return origin;
            };
            origin.copy = function (vec) {
                origin.set(vec.x, vec.y, vec.z);
            };
            origin.clone = function () {
                return new Vector3(origin.x, origin.y, origin.z);
            };
            return origin;
        },
        get target() {
            const target = new Vector3(
                marker.geometry.attributes.position.array[3],
                marker.geometry.attributes.position.array[4],
                marker.geometry.attributes.position.array[5]
            );
            target.set = function (x, y, z) {
                marker.geometry.attributes.position.array[3] = x;
                marker.geometry.attributes.position.array[4] = y;
                marker.geometry.attributes.position.array[5] = z;
                target.x = x;
                target.y = y;
                target.z = z;
                marker.geometry.attributes.position.needsUpdate = true;
            };
            target.add = function (vec) {
                target.set(
                    target.x + vec.x,
                    target.y + vec.y,
                    target.z + vec.z
                );
                return target;
            };
            target.sub = function (vec) {
                target.set(
                    target.x - vec.x,
                    target.y - vec.y,
                    target.z - vec.z
                );
                return target;
            };
            target.copy = function (vec) {
                target.set(vec.x, vec.y, vec.z);
            };
            target.clone = function () {
                return new Vector3(target.x, target.y, target.z);
            };
            return target;
        },
        get direction() {
            return THREEUTIL.directionVector(
                marker.userData.origin,
                marker.userData.target
            );
        },
        set length(value) {
            const origin = marker.userData.origin;
            marker.userData.target.copy(
                origin
                    .clone()
                    .add(marker.userData.direction.multiplyScalar(value))
            );
        },
        get length() {
            return marker.userData.origin.distanceTo(marker.userData.target);
        },
    };
    return marker;
}
function Node(mesh, animations = []) {
    const wrapper = new Group();
    wrapper.add(mesh.clone());
    wrapper.userData = {
        exportData: {},
        animations: {},
        dragged: false,
        mixer: new AnimationMixer(wrapper),
        tethers: {
            origin: {},
            target: {},
        },
        get tetherlist () {
            return [
                ...Object.values(this.tethers.origin),
                ...Object.values(this.tethers.target),
            ];
        },
        traverseMesh: function (callback, ...args) {
            wrapper.children.forEach((parentMesh) =>
                recurseMeshChildren(parentMesh, 3, callback, ...args)
            );
        },
        addAnimation: function (animation, secDelay = 0) {
            this.animations[animation.name] =
                this.mixer.clipAction(animation);
            this.animations[animation.name].startAt(
                this.mixer.time + secDelay
            );
            return this.animations[animation.name];
        },
        updateAnimations: function (timedelta) {
            Object.values(this.animations).forEach(
                (animationAction) =>
                    (animationAction.clampWhenFinished = this.dragged)
            );
            if (this.mixer)
                this.mixer.update(timedelta);
        },
        child: function (name) {
            const child = wrapper.children.filter((c) => c.name == name);
            return child ? child.at(0) : undefined;
        },
    };
    wrapper.userData.traverseMesh(function (mesh) {
        mesh.userData.nodeid = wrapper.uuid;
        mesh.userData.child = function (name) {
            const child = mesh.children.filter((c) => c.name == name);
            return child ? child.at(0) : undefined;
        };
    });
    Object.values(animations).forEach((animation) =>
        wrapper.userData.addAnimation(animation)
    );
    return wrapper;
}

function SelectionGlobe(sceneData, scale) {
    const wrapper = new Group();
    const countriesWrapper = new Object3D();
    const matt = new MeshPhongMaterial({
        color: 0xaa0000,
        side: FrontSide,
        specular: 0xaa0505,
        shininess: 65,
    });
    const CORE_SCALE = 0.95; // from model file
    wrapper.add(sceneData.mesh.children[0].clone()); // core
    wrapper.add(countriesWrapper);
    sceneData.mesh.children[1].children // countries wrapper
        .forEach((child) => {
            const kid = new Mesh(child.geometry.clone(), matt);
            kid.position.copy(child.position);
            kid.rotation.copy(child.rotation);
            kid.scale.copy(child.scale);
            kid.userData.id = child.name;
            countriesWrapper.attach(kid);
        });

    wrapper.scale.setScalar(scale);
    wrapper.userData = {
        ...wrapper.userData,
        rotation: wrapper.children[1].rotation.clone(),
        core: wrapper.children[0],
        get radius() {
            return wrapper.scale.x * CORE_SCALE; // should all be the same anyways
        },
        get children() {
            return wrapper.children[1].children;
        },
        _reset: function (callback = (objs) => {}) {
            const s = wrapper.userData.children.map((child) =>
                child.scale.clone()
            );
            const p = wrapper.userData.children.map((child) =>
                child.position.clone()
            );
            wrapper.userData.children.forEach((child) => {
                if (child.userData.position?.origin)
                    child.position.copy(child.userData.position.origin);
                if (child.userData.scale?.origin)
                    child.scale.copy(child.userData.scale.origin);
            });
            wrapper.updateMatrixWorld();
            const result = callback(wrapper.userData.children);
            wrapper.userData.children.forEach((child, i) => {
                child.position.copy(p[i]);
                child.scale.copy(s[i]);
            });
            wrapper.updateMatrixWorld();
            return result;
        },
    };
    wrapper.userData.core.material = new MeshPhysicalMaterial({
        color: 0x0f0f0f,
        transmission: 1,
        roughness: 0,
        opacity: 1,
        reflectivity: 0.4,
        thickness: 0.1,
    });
    wrapper.userData.core.material.needsUpdate = true;
    wrapper.userData.children.forEach((child) => {
        child.userData = {
            ...child.userData,
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
                        child.position.lerpVectors(
                            child.position,
                            this.target,
                            this.lerpSpeed
                        );
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
                        child.scale.lerpVectors(
                            child.scale,
                            this.target,
                            this.lerpSpeed
                        );
                },
            },
            update: function () {
                if (this.scale.needsUpdate) this.scale.update();
                if (this.position.needsUpdate) this.position.update();
            },
            scaleTo: function (targetScale, lerpSpeed = undefined) {
                this.scale.target.copy(
                    this.scale.origin.clone().multiplyScalar(targetScale)
                );
                if (lerpSpeed) this.scale.lerpSpeed = lerpSpeed;
            },
            moveTo: function (targetPos, lerpSpeed = undefined) {
                // expects Vector3
                this.position.target.copy(targetPos);
                if (lerpSpeed) this.position.lerpSpeed = lerpSpeed;
            },
            revert: function (lerpSpeed = undefined) {
                this.scaleTo(1, lerpSpeed);
                this.moveTo(this.position.origin, lerpSpeed);
            },
            _reset: function (callback = (obj) => {}) {
                const [scale, pos] = [
                    child.scale.clone(),
                    child.position.clone(),
                ];
                child.position.copy(child.userData.position.origin);
                child.scale.copy(child.userData.scale.origin);
                child.updateMatrixWorld();
                const result = callback(child);
                child.position.copy(pos);
                child.scale.copy(scale);
                child.updateMatrixWorld();
                return result;
            },
        };
    });

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
    CashStore: function (
        sceneData,
        animationOptions = { idle: true, randomize: true },
    ) {
        const store = Node(sceneData.mesh, sceneData.animations);
        const sliceMaterial = new MeshPhongMaterial({
                color: 0xD3AF37,
                emissive: 0x000000, 
                emissiveIntensity: 0.6,
                shininess: 45,
            });
        store.userData.child("stack").material = InvisibleMat;
        store.userData.child("stack").userData.child("1").material = sliceMaterial.clone();
        store.userData.child("stack").userData.child("2").material = sliceMaterial.clone();
        store.userData.child("stack").userData.child("3").material = sliceMaterial.clone();
        store.userData.child("stack").userData.child("4").material = sliceMaterial.clone();
        store.userData.child("stack").userData.child("5").material = sliceMaterial.clone();
        store.userData.child("stack").userData.child("6").material = sliceMaterial.clone();
        store.scale.setScalar(0.5);
        store.userData.type = "cashstore";
        store.userData.state = {
            setLowPerformance: function () {},
            setHighPerformance: function () {},
        };
        store.userData.exportData.maxConnections = 3;
        store.userData.exportData.store = {
            type: "cash",
            amount: 0,
            max: 200
        };

        if (animationOptions) {
            if (animationOptions.randomize) {
                store.userData.mixer.setTime(
                    animationOptions.randomize ? UTIL.random(0.05, 2) : 0
                );
                store.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                store.userData.animations["1-idle"].play();
                store.userData.animations["2-idle"].play();
                store.userData.animations["3-idle"].play();
                store.userData.animations["4-idle"].play();
                store.userData.animations["5-idle"].play();
                store.userData.animations["6-idle"].play();
            }
        }

        return store;
    },
    CryptoStore: function (
        sceneData,
        animationOptions = { idle: true, randomize: true },
    ) {
        const store = Node(sceneData.mesh, sceneData.animations);
        const sliceMaterial = new MeshPhongMaterial({
                color: 0xF7931A,
                emissive: 0x000000, 
                emissiveIntensity: 0.6,
                shininess: 45,
            });
        store.userData.child("stack").material = InvisibleMat;
        store.userData.child("stack").userData.child("1").material = sliceMaterial.clone();
        store.userData.child("stack").userData.child("2").material = sliceMaterial.clone();
        store.userData.child("stack").userData.child("3").material = sliceMaterial.clone();
        store.userData.child("stack").userData.child("4").material = sliceMaterial.clone();
        store.userData.child("stack").userData.child("5").material = sliceMaterial.clone();
        store.userData.child("stack").userData.child("6").material = sliceMaterial.clone();
        store.scale.setScalar(0.5);
        store.userData.type = "cryptostore";
        store.userData.state = {
            setLowPerformance: function () {},
            setHighPerformance: function () {},
        };
        store.userData.exportData.maxConnections = 3;
        store.userData.exportData.store = {
            type: "crypto",
            amount: 0,
            max: 30
        };

        if (animationOptions) {
            if (animationOptions.randomize) {
                store.userData.mixer.setTime(
                    animationOptions.randomize ? UTIL.random(0.05, 2) : 0
                );
                store.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                store.userData.animations["1-idle"].play();
                store.userData.animations["2-idle"].play();
                store.userData.animations["3-idle"].play();
                store.userData.animations["4-idle"].play();
                store.userData.animations["5-idle"].play();
                store.userData.animations["6-idle"].play();
            }
        }

        return store;
    },
    CashFarm: function (
        sceneData,
        animationOptions = { idle: true, randomize: true },
    ) {
        const farm = Node(sceneData.mesh, sceneData.animations);
        const sliceMaterial = new MeshPhongMaterial({
                color: 0xD3AF37,
                emissive: 0x000000, 
                emissiveIntensity: 0.6,
                shininess: 45,
            });
        farm.userData.child("stack").material = InvisibleMat;
        farm.userData.child("stack").userData.child("1").material = sliceMaterial.clone();
        farm.userData.child("stack").userData.child("2").material = sliceMaterial.clone();
        farm.userData.child("stack").userData.child("3").material = sliceMaterial.clone();
        farm.userData.child("stack").userData.child("4").material = sliceMaterial.clone();
        farm.scale.setScalar(0.4);
        farm.userData.type = "cashfarm";
        farm.userData.state = {
            setLowPerformance: function () {},
            setHighPerformance: function () {},
        };
        farm.userData.exportData.maxConnections = 3;
        farm.userData.exportData.currency = {
            type: "cash",
            amount: 0,
            max: 10,
            rate: 1800, // per hour
            lastUpdated: UTIL.getNowUTCSeconds(),
        };

        if (animationOptions) {
            if (animationOptions.randomize) {
                farm.userData.mixer.setTime(
                    animationOptions.randomize ? UTIL.random(0.05, 2) : 0
                );
                farm.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                farm.userData.animations["1-idle"].play();
                farm.userData.animations["2-idle"].play();
                farm.userData.animations["3-idle"].play();
                farm.userData.animations["4-idle"].play();
            }
        }

        return farm;
    },
    CryptoFarm: function (
        sceneData,
        animationOptions = { idle: true, randomize: true },
    ) {
        const farm = Node(sceneData.mesh, sceneData.animations);
        const sliceMaterial = new MeshPhongMaterial({
                color: 0xF7931A,
                emissive: 0x000000, 
                emissiveIntensity: 0.6,
                shininess: 45,
            });
        farm.userData.child("stack").material = InvisibleMat;
        farm.userData.child("stack").userData.child("1").material = sliceMaterial.clone();
        farm.userData.child("stack").userData.child("2").material = sliceMaterial.clone();
        farm.userData.child("stack").userData.child("3").material = sliceMaterial.clone();
        farm.userData.child("stack").userData.child("4").material = sliceMaterial.clone();
        farm.scale.setScalar(0.4);
        farm.userData.type = "cryptofarm";
        farm.userData.state = {
            setLowPerformance: function () {},
            setHighPerformance: function () {},
        };
        farm.userData.exportData.maxConnections = 3;
        farm.userData.exportData.currency = {
            type: "crypto",
            amount: 0,
            max: 10,
            rate: 720, // per hour
            lastUpdated: UTIL.getNowUTCSeconds(),
        };

        if (animationOptions) {
            if (animationOptions.randomize) {
                farm.userData.mixer.setTime(
                    animationOptions.randomize ? UTIL.random(0.05, 2) : 0
                );
                farm.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                farm.userData.animations["1-idle"].play();
                farm.userData.animations["2-idle"].play();
                farm.userData.animations["3-idle"].play();
                farm.userData.animations["4-idle"].play();
            }
        }

        return farm;
    },
    Cube: function (
        sceneData,
        animationOptions = { idle: true, randomize: true }
    ) {
        const cube = Node(sceneData.mesh, sceneData.animations);
        cube.userData.child("cube").material = new MeshPhongMaterial({
            color: 0x000000,
        });
        cube.userData.type = "cube";
        cube.userData.exportData = {
            maxConnections: 4
        };
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
            color: 0xB8B8B8,
            specular: 0xff0000,
            shininess: 0,
        });
        const highPerfMat = new MeshPhysicalMaterial({
            transmission: 0.9,
            roughness: 0.2,
            shininess: 0,
            color: 0xB8B8B8
        });
        globe.userData.child("globe").material = InvisibleMat;
        globe.userData.child("globe").userData.child("frame").material =
            new MeshPhongMaterial({
                color: 0x880101,
                specular: 0xff0000,
                shininess: 100,
            });
        globe.userData.child("globe").userData.child("ball").material =
            highPerfMat;
        globe.userData.state = {
            setLowPerformance: function () {
                globe.userData
                    .child("globe")
                    .userData.child("ball").material = lowPerfMat;
                globe.userData
                    .child("globe")
                    .userData.child("ball").material.needsUpdate = true;
            },
            setHighPerformance: function () {
                globe.userData
                    .child("globe")
                    .userData.child("ball").material = highPerfMat;
                globe.userData
                    .child("globe")
                    .userData.child("ball").material.needsUpdate = true;
            },
        };
        // transparent objects that are nested are not rendered. Tell the renderer to draw our nested transparent mesh FIRST so it actually does it
        globe.userData
            .child("globe")
            .userData.child("frame").renderOrder = 1;
        globe.userData.child("globe").renderOrder = 1;
        globe.userData.type = "globe";
        globe.userData.exportData = {
            maxConnections: 1
        };
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
        scanner.userData.child("ball").material = ballMat;
        scanner.userData.child("ball").userData.child("pupil").material =
            pupilMat;
        scanner.userData.type = "scanner";
        scanner.userData.exportData = {
            maxConnections: 3
        };
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
                cube.userData.child("Cube").material = lowPerfMat;
                cube.userData.child("Cube").material.needsUpdate = true;
            },
            setHighPerformance: function () {
                cube.userData.child("Cube").material = highPerfMat;
                cube.userData.child("Cube").material.needsUpdate = true;
            },
        };
        cube.userData.child("Cube").material = highPerfMat;
        cube.userData.type = "placeholder";
        cube.userData.exportData = {
            maxConnections: 5
        };
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

function SpriteProjectile( // not actaully using sprites. PlaneGeometry updated to always face camera
    type,
    camera,
    size,
    instanceCount,
    animation = {
        mappath: undefined,
        maskpath: undefined,
        fps: undefined,
        frames: undefined,
    },
    playbackSpeed = 1
) {
    const aniMeta = {
        // animation metadata
        fps: animation.fps,
        frames: animation.frames,
    };
    const texOptions = {
        repeat: {
            x: 1,
            y: 1,
        },
    };
    const geometry = new PlaneGeometry(size, size);

    const controller = new AttackManager(
        type,
        animation.mappath,
        animation.maskpath,
        geometry,
        instanceCount,
        aniMeta,
        texOptions
    );

    {
        // adding Projectile specific methods
        Object.keys(controller.instanceAttributes.userData).forEach((id) => {
            controller.getOptions(id).speed = playbackSpeed;
            controller.setUserData(id, {
                position: {
                    start: new Vector3(),
                    end: new Vector3(),
                    get direction() {
                        return camera.quaternion;
                    },
                    get current() {
                        return this.end
                            .clone()
                            .sub(this.start)
                            .multiplyScalar(controller.getElapsed(id))
                            .add(this.start);
                    },
                },
                setVectors: function (originVector, targetVector) {
                    this.position.start.copy(originVector);
                    this.position.end.copy(targetVector);
                    this.update();
                },
                setOrigin: function (originVector) {
                    this.setVectors(originVector, this.position.end);
                },
                setTarget: function (targetVector) {
                    this.setVectors(this.position.start, targetVector);
                },
                update: function () {
                    const [pos, rot, sca] = controller.getMatrixComposition(id);
                    controller.setMatrixComposition(
                        id,
                        this.position.current,
                        this.position.direction,
                        sca
                    );
                },
                reset: function () {
                    this.setVectors(THREEUTIL.zeroVector, THREEUTIL.zeroVector);
                },
            });
        });
        controller.update = function (delta) {
            const result = AttackManager.prototype.update.call(
                controller,
                delta
            );
            const instances = controller.getInstances();
            instances.forEach((id) => {
                const userData = controller.getUserData(id);
                userData?.update();
            });
            return result;
        };

        controller.clear = function () {
            controller.instances.parent.remove(controller.instances);
            return AttackManager.prototype.clear.call(controller);
        };

        controller.userData.createAttack = function () {
            // returns a "fresh" instance, if available
            const instanceid = controller.allocateInstance();
            if (!instanceid)
                Logger.throw(
                    new Error(
                        `[SpriteProjectileAttack (${controller.attackType})] | Failed to create new attack: max instances already created (${controller.config.maxInstances})`
                    )
                );
            controller.play(instanceid);
            controller.show(instanceid);
            return instanceid;
        };

        controller.userData.removeAttack = function (instanceid) {
            controller.releaseInstance(instanceid);
        };
    }

    return controller;
}

function WrappedProjectile(
    type,
    thickness = 0.5,
    faces = 16,
    repeatX,
    repeatY,
    instanceCount,
    animation = {
        mappath: undefined,
        maskpath: undefined,
        fps: undefined,
        frames: undefined,
    },
    playbackSpeed = 1
) {
    const aniMeta = {
        // animation metadata
        fps: animation.fps,
        frames: animation.frames,
    };
    const texOptions = {
        repeat: {
            x: repeatX,
            y: repeatY,
        },
    };
    const geometry = new CylinderGeometry(
        thickness,
        thickness,
        thickness,
        faces,
        1,
        true // open-ended
    );

    const controller = new AttackManager(
        type,
        animation.mappath,
        animation.maskpath,
        geometry,
        instanceCount,
        aniMeta,
        texOptions
    );

    {
        // adding Beam specific methods
        Object.keys(controller.instanceAttributes.userData).forEach((id) => {
            controller.getOptions(id).speed = playbackSpeed;
            controller.setUserData(id, {
                position: {
                    start: new Vector3(),
                    end: new Vector3(),
                    get direction() {
                        return THREEUTIL.directionQuaternion(
                            controller.instances.up,
                            this.start.clone().sub(this.end).normalize()
                        );
                    },
                    get current() {
                        return this.end
                            .clone()
                            .sub(this.start)
                            .multiplyScalar(controller.getElapsed(id))
                            .add(this.start);
                    },
                },
                setVectors: function (originVector, targetVector) {
                    this.position.start.copy(originVector);
                    this.position.end.copy(targetVector);
                    this.update();
                },
                setOrigin: function (originVector) {
                    this.setVectors(originVector, this.position.end);
                },
                setTarget: function (targetVector) {
                    this.setVectors(this.position.start, targetVector);
                },
                update: function () {
                    const [pos, rot, sca] = controller.getMatrixComposition(id);
                    controller.setMatrixComposition(
                        id,
                        this.position.current,
                        this.position.direction,
                        sca
                    );
                },
                reset: function () {
                    this.setVectors(THREEUTIL.zeroVector, THREEUTIL.zeroVector);
                },
            });
        });
        controller.update = function (delta) {
            const result = AttackManager.prototype.update.call(
                controller,
                delta
            );
            const instances = controller.getInstances();
            instances.forEach((id) => {
                const userData = controller.getUserData(id);
                userData?.update();
            });
            return result;
        };

        controller.clear = function () {
            controller.instances.parent.remove(controller.instances);
            return AttackManager.prototype.clear.call(controller);
        };

        controller.userData.createAttack = function () {
            // returns a "fresh" instance, if available
            const instanceid = controller.allocateInstance();
            if (!instanceid)
                Logger.throw(
                    new Error(
                        `[WrappedProjectileAttack (${controller.attackType})] | Failed to create new attack: max instances already created (${controller.config.maxInstances})`
                    )
                );
            controller.play(instanceid);
            controller.show(instanceid);
            return instanceid;
        };

        controller.userData.removeAttack = function (instanceid) {
            controller.releaseInstance(instanceid);
        };
    }

    return controller;
}

function Beam(
    type,
    thickness = 0.5,
    faces = 16,
    repeatX,
    instanceCount,
    animation = {
        mappath: undefined,
        maskpath: undefined,
        fps: undefined,
        frames: undefined,
    },
    playbackSpeed = 1
) {
    const aniMeta = {
        // animation metadata
        fps: animation.fps,
        frames: animation.frames,
    };
    const texOptions = {
        repeat: {
            x: repeatX,
            y: 1,
        },
    };
    const geometry = new CylinderGeometry(
        thickness,
        thickness,
        thickness,
        faces,
        1,
        true // open-ended
    );

    const controller = new AttackManager(
        type,
        animation.mappath,
        animation.maskpath,
        geometry,
        instanceCount,
        aniMeta,
        texOptions
    );

    {
        // adding Beam specific methods
        Object.keys(controller.instanceAttributes.userData).forEach((id) => {
            controller.getOptions(id).speed = playbackSpeed;
            controller.setUserData(id, {
                position: {
                    start: new Vector3(),
                    end: new Vector3(),
                    get direction() {
                        return THREEUTIL.directionQuaternion(
                            controller.instances.up,
                            this.start.clone().sub(this.end).normalize()
                        );
                    },
                    get current() {
                        return this.start.clone().lerp(this.end, 0.5);
                    },
                    get scale() {
                        return new Vector3(
                            1,
                            Math.abs(this.start.distanceTo(this.end)) /
                                geometry.parameters.height,
                            1
                        );
                    },
                },
                setVectors: function (originVector, targetVector) {
                    this.position.start.copy(originVector);
                    this.position.end.copy(targetVector);
                    const scale = this.position.scale;
                    controller.setMatrixComposition(
                        id,
                        this.position.current,
                        this.position.direction,
                        scale
                    );
                    controller.setRepeatY(id, scale.y);
                },
                setOrigin: function (originVector) {
                    this.setVectors(originVector, this.position.end);
                },
                setTarget: function (targetVector) {
                    this.setVectors(this.position.start, targetVector);
                },
                update: function () {
                    // do nothing
                },
                reset: function () {
                    this.setVectors(THREEUTIL.zeroVector, THREEUTIL.zeroVector);
                },
            });
        });
        controller.update = function (delta) {
            const result = AttackManager.prototype.update.call(
                controller,
                delta
            );
            const instances = controller.getInstances();
            instances.forEach((id) => {
                const userData = controller.getUserData(id);
                userData?.update();
            });
            return result;
        };

        controller.clear = function () {
            controller.instances.parent.remove(controller.instances);
            return AttackManager.prototype.clear.call(controller);
        };

        controller.userData.createAttack = function () {
            // returns a "fresh" instance, if available
            const instanceid = controller.allocateInstance();
            if (!instanceid)
                Logger.throw(
                    new Error(
                        `[BeamAttack (${controller.attackType})] | Failed to create new attack: max instances already created (${controller.config.maxInstances})`
                    )
                );
            controller.play(instanceid);
            controller.show(instanceid);
            return instanceid;
        };

        controller.userData.removeAttack = function (instanceid) {
            controller.releaseInstance(instanceid);
        };
    }

    return controller;
}

const AttackManagerFactory = {
    Particle: function (count) {
        const ParticleController = WrappedProjectile(
            "particle",
            0.55,
            16,
            3,
            1,
            count,
            {
                // animation data
                mappath: "./source/attacks/particle/attack.png",
                maskpath: "./source/attacks/particle/attack-mask.png",
                fps: 30,
                frames: 121,
            },
            2
        );

        return ParticleController;
    },
    CubeDefense: function (count) {
        const CubeDefenseController = WrappedProjectile(
            "cubedefense",
            0.65,
            16,
            1,
            1,
            count,
            {
                // animation data
                mappath: "./source/attacks/particle/attack.png",
                maskpath: "./source/attacks/particle/attack-mask.png",
                fps: 30,
                frames: 121,
            }
        );

        return CubeDefenseController;
    },
    Laser: function (count) {
        const LaserController = Beam("cubedefense", 0.25, 3, 3, count, {
            // animation data
            mappath: "./source/attacks/laser/attack.png",
            maskpath: "./source/attacks/laser/attack-mask.png",
            fps: 30,
            frames: 31,
        });

        return LaserController;
    },
    PascualCannon: function (camera, count) {
        const PCannonController = SpriteProjectile(
            "pascualcannon",
            camera,
            0.6,
            count,
            {
                // animation data
                mappath: "./source/attacks/pascualcannon/attack.png",
                maskpath: "./source/attacks/pascualcannon/attack-mask.png",
                fps: 30,
                frames: 61,
            },
            1
        );

        return PCannonController;
    },
};

export {
    Tether,
    Nodes,
    AttackManagerFactory,
    SelectionGlobe,
    WorldMarker,
};
