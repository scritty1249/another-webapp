import {
    Vector3,
    AnimationMixer,
    Group,
    Mesh,
    MeshPhongMaterial,
    MeshBasicMaterial,
    MeshStandardMaterial,
    MeshPhysicalMaterial,
    CylinderGeometry,
    PlaneGeometry,
    FrontSide,
    Object3D,
    LoopOnce,
    LoopRepeat,
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
export function MaterialTable () {
    const self = this;
    this.index = {};
    this._addIndexEntry = function (material) {
        self.index[material.name] = {
            material: material.clone(),
            objects: new Set()
        };
        return self.index[material.name];
    };
    this.has = function (material) {
        return Object.keys(self.index).includes(material.name);
    };
    this.get = function (materialName) {
        return self.index[materialName]?.material;
    }
    this.add = function (material, ...objectNames) {
        if (!material?.isMaterial || !material.name) return;
        if (!self.has(material))
            self._addIndexEntry(material);
        objectNames.forEach(objectName => self.index[material.name].objects.add(objectName));
    };
    this.apply = function (object) {
        try {
            const mats = Object.values(self.index);
            object.traverse(function (child) {
                let applied = false;
                mats.forEach(({material, objects}) => {
                    if (!applied && objects.has(child.name))
                        applied = (child.material = material);
                });
            });
        } catch (err) {
            Logger.warn("Failed to apply material index.", err);
        }
    };
    this.clone = function () {
        const clone = new MaterialTable();
        if (self.index)
            Object.values(self.index).forEach(({material, objects}) => {
                clone.add(material, ...objects);
            });
        return clone;
    };
    return this;
}
function traverseMaterials(mesh) {
    const newMesh = mesh.clone();
    const invisMat = InvisibleMat.clone();
    const table = new MaterialTable();
    newMesh.traverse(function (child) {
        if (child.material?.isMaterial && child.material?.name && !child.userData.hide) {
            const userData = Object.keys(child.userData);
            Object.entries(DEFAULT.MATERIAL_PROP_OVERRIDES).forEach(([prop, overrideProp]) => {
                if (userData.includes(prop))
                    child.material[overrideProp] = child.userData[prop];
            });
            table.add(child.material, child.name);
            child.material = table.get(child.material.name);
            child.userData.sourceMaterial = child.material.clone();
        } else {
            child.material = invisMat;
        }
    });
    return {
        mesh: newMesh,
        materials: table,
    };
}
function Node(nodeType, meshes, animations) {
    const wrapper = new Group();
    const materialIndexes = [];
    for (const m of meshes) {
        const {mesh, materials} = traverseMaterials(m);
        wrapper.add(mesh);
        materialIndexes.push(materials);
    }
    wrapper.userData = {
        materials: Object.assign({}, ...materialIndexes),
        exportData: {},
        animations: {
            action: {},
            active: {},
        },

        dragged: false,
        mixer: new AnimationMixer(wrapper),
        playbackRate: 1,
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
        get activeAnimations() {
            return Object.keys(this.animations.active);
        },
        get actionAnimations() {
            return Object.keys(this.animations.action);
        },
        state: {
            setLowPerformance: function () {},
            setHighPerformance: function () {},
        },
        addAnimation: function (name, animationData) {
            this.animations.action[name] = UTIL.CollectionWrapper(
                animationData
                    .map(ani => this.mixer.clipAction(ani))
                );
            this.animations.action[name].setEffectiveWeight(0);
        },
        fadeAnimation: function (fadeInName, fadeOutName = "", transitionDuration = 0) {
            if (!fadeInName) {
                Logger.warn(`Failed to play animation "${fadeInName}" on Node ${wrapper.uuid}. Action not found.`);
                return;
            }
            const targetAnimation = this.animations.action[fadeInName];
            const transitionDurationMs = transitionDuration * 1000;
            if (fadeInName == fadeOutName) {
                let targetScale;
                targetAnimation.forEach((animationAction) => {
                    const animationDuration = animationAction.getClip().duration;
                    const progress = animationAction.time / animationDuration;
                    const timeScale = animationAction.timeScale;
                    if (progress < .5) { // reverse to 0
                        const secondsToStart = animationAction.time;
                        targetScale = -(secondsToStart / transitionDuration);
                    } else { // fast forward to 1 (which still wraps to 0)
                        const secondsToEnd = animationDuration - animationAction.time;
                        targetScale = secondsToEnd / transitionDuration;
                    }
                    animationAction.setLoop(LoopOnce);
                    animationAction.timeScale = targetScale / this.playbackRate;
                    setTimeout(() => {
                        animationAction.timeScale = timeScale;
                        animationAction.setLoop(LoopRepeat);
                        animationAction.reset();
                    }, transitionDurationMs);
                });
            } else if (fadeOutName && this.activeAnimations.includes(fadeOutName)) {
                const originAnimation = this.animations.active[fadeOutName];
                originAnimation.fadeOut(transitionDuration);
                originAnimation.halt(transitionDuration);

                this.animations.active[fadeInName] = targetAnimation;
                targetAnimation.reset();
                targetAnimation.setEffectiveTimeScale(1);
                targetAnimation.setEffectiveWeight(1);
                targetAnimation.fadeIn(transitionDuration);
                targetAnimation.play();
                setTimeout(() => {
                    delete this.animations.active[fadeOutName];
                }, transitionDurationMs);
            }
        },
        playAnimation: function (animationName, playbackOffset = 0) {
            if (!animationName) {
                Logger.warn(`Failed to play animation "${animationName}" on Node ${wrapper.uuid}. Action not found.`);
                return;
            } else if (this.activeAnimations.includes(animationName)) {
                Logger.warn(`Failed to play animation "${animationName}" on Node ${wrapper.uuid}. Action already active.`);
                return;
            }
            const targetAnimation = this.animations.action[animationName];
            targetAnimation.time = playbackOffset;
            targetAnimation.setEffectiveWeight(1);
            this.animations.active[animationName] = targetAnimation;
            targetAnimation.reset();
            targetAnimation.play();
        },
        stopAnimations: function () {
            this.activeAnimations.forEach(animation => {
                const animationAction = this.animations.active[animation];
                animationAction.enabled = false;
                animationAction.stop();
                animationAction.setEffectiveWeight(0);
                delete this.animations.active[animation];
            });
        },
        updateAnimations: function (timedelta) {
            // Object.values(this.animations.action).forEach(
            //     (animationAction) =>
            //         (animationAction.clampWhenFinished = this.dragged)
            // );
            if (this.mixer)
                this.mixer.update(timedelta * this.playbackRate);
        },
        child: function (name) {
            const child = wrapper.children.filter((c) => c.name == name);
            return child ? child.at(0) : undefined;
        },
    };
    wrapper.traverse(function (mesh) {
        mesh.userData.nodeid = wrapper.uuid;
        mesh.userData.child = function (name) {
            const child = mesh.children.filter((c) => c.name == name);
            return child ? child.at(0) : undefined;
        };
    });
    Object.entries(animations).forEach(([name, animationData]) =>
        wrapper.userData.addAnimation(name, animationData)
    );
    const NodeConfig = CONFIG.NODES[nodeType];
    if (NodeConfig) {
        try {
            wrapper.userData.exportData = {
                level: 0,
                maxConnections: NodeConfig.build.connections.base
            };
            wrapper.userData.exportData.data = Object.assign({}, NodeConfig.data);
            wrapper.userData.type = NodeConfig.id;
            NodeConfig.settings.init(wrapper.userData.exportData);
            wrapper.userData.upgradeData = () => NodeConfig.settings.upgrade(wrapper.userData.exportData);
        } catch (err) {
            Logger.error(`Something went wrong while trying to initialize configuration data for node type "${nodeType}".\nNode Config: `, NodeConfig, "\nDump: ", err);
        }
    } else {
        Logger.warn(
            `Failed to find configuration data while creating mesh for Node type "${nodeType}".`,
            `UUID: ${wrapper.uuid}`
        );
    }
    return wrapper;
}

function SelectionGlobe(sceneData, scale) {
    const wrapper = new Group();
    const countriesWrapper = new Object3D();
    const matt = new MeshPhongMaterial({
        color: 0xaa0000,
        side: FrontSide,
        specular: 0xaa0505,
        shininess: 15,
        reflectivity: 0.025,
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
        roughness: .14,
        opacity: 1,
        reflectivity: 0.05,
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
    tether.userData.sourceMaterial = material.clone();
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
    Barracks: function (
        sceneData,
        animationOptions = { idle: true, randomize: true },
    ) {
        const cube = Node("barracks", sceneData.meshes, sceneData.animations);

        cube.userData.playbackRate = 0.45;
        if (animationOptions) {
            if (animationOptions.randomize) {
                cube.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                cube.userData.playAnimation("idle", animationOptions.randomize ? UTIL.random(0.05, 2) : 0);
            }
        }

        return cube;
    },
    CashStore: function (
        sceneData,
        animationOptions = { idle: true, randomize: true },
    ) {
        const store = Node("cashstore", sceneData.meshes, sceneData.animations);
        store.userData.isStorageNode = true;

        store.userData.child("stack").scale.setScalar(0.65);
        store.scale.setScalar(0.8);
        if (animationOptions) {
            if (animationOptions.randomize) {
                store.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                store.userData.playAnimation("idle", animationOptions.randomize ? UTIL.random(0.05, 2) : 0);
            }
        }

        return store;
    },
    CryptoStore: function (
        sceneData,
        animationOptions = { idle: true, randomize: true },
    ) {
        const store = Node("cryptostore", sceneData.meshes, sceneData.animations);
        store.userData.isStorageNode = true;

        store.userData.child("stack").scale.setScalar(0.65);
        store.scale.setScalar(0.8);

        if (animationOptions) {
            if (animationOptions.randomize) {
                store.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                store.userData.playAnimation("idle", animationOptions.randomize ? UTIL.random(0.05, 2) : 0);
            }
        }

        return store;
    },
    CashFarm: function (
        sceneData,
        animationOptions = { idle: true, randomize: true },
    ) {
        const farm = Node("cashfarm", sceneData.meshes, sceneData.animations);
        farm.userData.isCurrencyNode = true;
        farm.scale.setScalar(0.8);
        if (animationOptions) {
            if (animationOptions.randomize) {
                farm.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                farm.userData.playAnimation("idle", animationOptions.randomize ? UTIL.random(0.05, 2) : 0);
            }
        }

        return farm;
    },
    CryptoFarm: function (
        sceneData,
        animationOptions = { idle: true, randomize: true },
    ) {
        const farm = Node("cryptofarm", sceneData.meshes, sceneData.animations);
        farm.userData.isCurrencyNode = true;

        farm.scale.setScalar(0.7);

        if (animationOptions) {
            if (animationOptions.randomize) {
                farm.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                farm.userData.playAnimation("idle", animationOptions.randomize ? UTIL.random(0.05, 2) : 0);
            }
        }

        return farm;
    },
    Cube: function (
        sceneData,
        animationOptions = { idle: true, randomize: true }
    ) {
        const cube = Node("cube", sceneData.meshes, sceneData.animations);
        cube.userData.isDefenseNode = true;
        if (animationOptions) {
            if (animationOptions.randomize) {
                cube.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                cube.userData.playAnimation("idle", animationOptions.randomize ? UTIL.random(0.05, 2) : 0);
            }
        }
        return cube;
    },
    Globe: function (
        sceneData,
        animationOptions = { idle: true, randomize: true }
    ) {
        const globe = Node("globe", sceneData.meshes, sceneData.animations);

        globe.scale.setScalar(0.65);
        if (animationOptions) {
            if (animationOptions.randomize) {
                globe.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                globe.userData.playAnimation("idle", animationOptions.randomize ? UTIL.random(0.05, 2) : 0);
            }
        }
        return globe;
    },
    Scanner: function (
        sceneData,
        animationOptions = { idle: true, randomize: true }
    ) {
        const scanner = Node("scanner", sceneData.meshes, sceneData.animations);
        scanner.userData.isDefenseNode = true;
        scanner.scale.setScalar(0.7);
        if (animationOptions) {
            if (animationOptions.randomize) {
                scanner.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                scanner.userData.playAnimation("idle", animationOptions.randomize ? UTIL.random(0.05, 2) : 0);
            }
        }
        return scanner;
    },
    Placeholder: function (
        sceneData,
        animationOptions = { idle: true, randomize: true }
    ) {
        const cube = Node("placeholder", sceneData.meshes, sceneData.animations);

        cube.scale.setScalar(0.45);
        if (animationOptions) {
            if (animationOptions.randomize) {
                cube.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                cube.userData.playAnimation("idle", animationOptions.randomize ? UTIL.random(0.05, 2) : 0);
            }
        }
        return cube;
    },
    Botnet: function (
        sceneData,
        animationOptions = { idle: true, randomize: true }
    ) {
        const cube = Node("botnet", sceneData.meshes, sceneData.animations);

        cube.userData.playbackRate = .7;
        cube.scale.setScalar(0.6);
        cube.userData.child("wrap").scale.setScalar(0.5);

        cube.userData.animations.action["clicked"].clampWhenFinished = true;
        cube.userData.animations.action["clicked"].setLoop(LoopOnce);

        if (animationOptions) {
            if (animationOptions.randomize) {
                cube.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                cube.userData.playAnimation("idle", animationOptions.randomize ? UTIL.random(0.05, 2) : 0);
            }
        }

        return cube;
    },
    Core: function (
        sceneData,
        animationOptions = { idle: true, randomize: true }
    ) {
        const core = Node("core", sceneData.meshes, sceneData.animations);
        core.userData.isCore = true;
        core.scale.setScalar(1.5);

        if (animationOptions) {
            if (animationOptions.randomize) {
                core.rotation.y = UTIL.random(0, Math.PI * 2);
            }
            if (animationOptions.idle) {
                core.userData.playAnimation("idle", animationOptions.randomize ? UTIL.random(0.05, 2) : 0);
            }
        }

        return core;
    },
};

const AttackManagerFactory = {
    SpriteProjectile: function ( // not actaully using sprites. PlaneGeometry updated to always face camera
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
        playbackSpeed = 1,
        glow = 1,
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
            glowIntensity: glow,
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
    },
    WrappedProjectile: function (
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
        playbackSpeed = 1,
        glow = 1,
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
            glowIntensity: glow, 
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
    },
    Beam: function (
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
        playbackSpeed = 1,
        glow = 1,
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
            glowIntensity: glow, 
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
    },
};

const Attacks = {
    Particle: function (count) {
        const ParticleController = AttackManagerFactory.WrappedProjectile(
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
    CubeDefense: function (camera, count) {
        const CubeDefenseController = AttackManagerFactory.SpriteProjectile(
            "cubedefense",
            camera,
            0.6,
            count,
            {
                // animation data
                mappath: "./source/attacks/cubedefense/attack.png",
                maskpath: "./source/attacks/cubedefense/attack-mask.png",
                fps: 30,
                frames: 21,
            },
            1,
            1
        );
        return CubeDefenseController;
    },
    Laser: function (count) {
        const LaserController = AttackManagerFactory.Beam("cubedefense", 0.25, 3, 3, count, {
            // animation data
            mappath: "./source/attacks/laser/attack.png",
            maskpath: "./source/attacks/laser/attack-mask.png",
            fps: 30,
            frames: 31,
        }, 1, 1.805);
        return LaserController;
    },
    PascualCannon: function (camera, count) {
        const PCannonController = AttackManagerFactory.SpriteProjectile(
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
            1,
            4.5
        );

        return PCannonController;
    },
};

export {
    Tether,
    Nodes,
    Attacks,
    SelectionGlobe,
    WorldMarker,
};
