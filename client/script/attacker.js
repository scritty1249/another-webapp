// Attack Data / Manager. Stores attack data for attack phase and used as reference between Managers.

import * as MESH from "./mesh.js";
import {
    TextureLoader,
    MeshLambertMaterial,
    InstancedMesh,
    Object3D,
    InstancedBufferAttribute,
    ShaderMaterial,
    Vector2,
    Vector3,
    Quaternion,
    MathUtils,
    Matrix4,
    DoubleSide,
} from "three";
export function AttackManager(
    attackType,
    textureAtlas,
    alphaAtlas,
    geometry,
    instanceCount,
    metadata = {
        fps: 60,
        frames: 1,
    },
    textureOptions = {
        repeat: {
            x: 1,
            y: 1,
        },
    }
) {
    const self = this;
    this.attackType = attackType;
    this.userData = {};
    this._dummy = new Object3D();
    this._atlas = {
        map: new TextureLoader().load(textureAtlas),
        alphaMap: new TextureLoader().load(alphaAtlas),
    };
    this.config = {
        frames: metadata.frames,
        repeat: new Vector2(
            textureOptions?.repeat?.x
                ? textureOptions?.repeat?.x / metadata.frames
                : 1 / metadata.frames,
            textureOptions?.repeat?.y ? textureOptions?.repeat?.y : 1
        ),
        maxInstances: instanceCount,
        fps: metadata.fps, // frames per second
        duration: metadata.frames / metadata.fps, // calculated for internal use. Duration of animation in seconds
    };
    this.tick = {
        interval: this.config.duration / this.config.frames,
        delta: 0,
    };
    this._geometry = geometry;
    this._material = new ShaderMaterial({
        vertexShader: this.shader._vert,
        fragmentShader: this.shader._frag,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
            map: { value: this._atlas.map },
            alphaMap: { value: this._atlas.alphaMap },
            repeat: { value: this.config.repeat },
        },
    });
    this.instanceAttributes = {};
    this._geometry.setAttribute(
        "tileIdx",
        new InstancedBufferAttribute(new Float32Array(instanceCount).fill(0), 1)
    );

    this._material.defines = { USE_UV: "" };
    this.instances = new InstancedMesh(
        this._geometry,
        this._material,
        instanceCount
    );
    // setup proxies for instancedmesh
    this.shader.uniforms = new Proxy(this._material.uniforms, {
        get(target, prop, receiver) {
            return target[prop]?.value;
        },
        set(target, prop, val, receiver) {
            target[prop].value = val;
            return true;
        },
    });
    this.instanceAttributes._tileIdx =
        this.instances.geometry.getAttribute("tileIdx");
    this.instanceAttributes.tileIdx = new Proxy(
        this.instanceAttributes._tileIdx.array,
        {
            get(target, prop, receiver) {
                return Reflect.get(target, prop, receiver);
            },
            set(target, prop, val, receiver) {
                const result = Reflect.set(target, prop, val, receiver);
                if (result) self.instanceAttributes._tileIdx.needsUpdate = true;
                return result;
            },
        }
    );

    this.instanceAttributes.options = {};
    this.instanceAttributes.userData = {};
    for (let i = 0; i < instanceCount; i++) {
        const uuid = this.attackType + "-" + MathUtils.generateUUID();
        this.instanceAttributes.options[uuid] = {
            uuid: uuid,
            callback: undefined, // callable
            visible: true, // changing does not do anything, only for monitoring instance states outside of class
            playing: true, // used for pausing an animation without "removing" the instance
            allocated: false, // used to check if this instance is already being referenced
            speed: 1,
            _index: i,
        };
        this.instanceAttributes.userData[uuid] = {};
    }
    return this;
}

AttackManager.prototype = {
    get instancestack () {
        return Object.values(this.instanceAttributes.options) // [!] expensive...
            .toSorted((a, b) => a._index - b._index)
            .map((o) => this.getData(o.uuid));
    },
    get instanceCount() {
        return this.instances?.count;
    },
    set instanceCount(count) {
        this.instances.count = Math.min(
            this.config.maxInstances,
            Math.max(0, count)
        );
    },
    shader: {
        uniforms: undefined, // Proxy for shader uniforms attribute
        _frag: `
         	varying vec2 vuv;
            uniform sampler2D map;
            uniform sampler2D alphaMap;
            uniform vec2 repeat;
            varying float mapTileIdx;
            void main() {
                vec2 uv = vuv;
                uv = fract((uv + mapTileIdx) * repeat);
                vec2 smooth_uv = repeat * vuv;
                vec4 duv = vec4(dFdx(smooth_uv), dFdy(smooth_uv));
                vec3 txl = textureGrad(map, uv, duv.xy, duv.zw).rgb;
                vec4 alphaTxl = textureGrad(alphaMap, uv, duv.xy, duv.zw);
                float alpha = ((alphaTxl.r + alphaTxl.g + alphaTxl.b) / 3.);
                gl_FragColor = vec4(txl, alpha);
            }
        `,
        _vert: `
            attribute float tileIdx;
            varying float mapTileIdx;
            varying vec2 vuv;
            void main() {
                vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                mapTileIdx = tileIdx;
                vuv = uv;
            }
        `,
    },
};

AttackManager.prototype.init = function (scene) {
    scene.add(this.instances);
    this.pauseAll();
    this.hideAll();
};

AttackManager.prototype.clear = function () {
    this.hideAll(); // prevent any further instance callbacks
    this._atlas.map.dispose();
    this._atlas.alphaMap.dispose();
    this._geometry.dispose();
    this._dummy = undefined;
    this._material = undefined;
    this.instances = undefined;
};

AttackManager.prototype._nextTileIdx = function (frame) {
    return frame >= this.config.frames - 1
        ? 0
        : frame < 0
        ? 0
        : frame + 1;
};

AttackManager.prototype._swapInstances = function (originid, targetid) {
    // swap transforms
    const originMatrix = this.getMatrix4(originid);
    const targetMatrix = this.getMatrix4(targetid);
    this.setMatrix4(targetid, originMatrix);
    this.setMatrix4(originid, targetMatrix);

    // swap indexes
    const originOptions = this.getOptions(originid);
    const targetOptions = this.getOptions(targetid);
    const targetIdx = targetOptions._index;
    targetOptions._index = originOptions._index;
    originOptions._index = targetIdx;

    // swap animation state
    const targetFrame = this.getFrame(targetid);
    const originFrame = this.getFrame(originid);
    this.setFrame(originid, targetFrame);
    this.setFrame(targetid, originFrame);
};

AttackManager.prototype.getInstances = function () {
    // returns VISIBLE instances (ones included in instanceCount)
    return Object.values(this.instanceAttributes.options) // [!] expensive...
        .toSorted((a, b) => a._index - b._index)
        .slice(0, this.instanceCount)
        .map((o) => o.uuid);
};

AttackManager.prototype.getHiddenInstance = function () { // returns the first hidden instance found in list
    if (this.instanceCount == this.config.maxInstances) return undefined; // nothing hidden
    return this.getInstanceId(this.instanceCount);
};

AttackManager.prototype.allocateInstance = function () {
    // returns the first hidden instance found in list
    if (this.instanceCount >= this.config.maxInstances) return undefined; // nothing hidden
    const instanceid = Object.values(this.instanceAttributes.options) // [!] expensive...
        .toSorted((a, b) => a._index - b._index)
        .slice(this.instanceCount)
        .filter((o) => !o.allocated)
        .map((o) => o.uuid)?.[0];
    if (instanceid) {
        const options = this.getOptions(instanceid);
        options.allocated = true;
    }
    return instanceid;
};

AttackManager.prototype.releaseInstance = function (instanceid) {
    const options = this.getOptions(instanceid);
    options.allocated = false;
    this.hide(instanceid);
    this.pause(instanceid);
    this.resetInstance(instanceid);
};

AttackManager.prototype.hideAll = function () {
    this.instanceCount = 0;
    Object.values(this.instanceAttributes.options).forEach(
        (options) => (options.visible = false)
    );
};

AttackManager.prototype.showAll = function () {
    this.instanceCount = this.config.maxInstances;
    Object.values(this.instanceAttributes.options).forEach(
        (options) => (options.visible = true)
    );
};

AttackManager.prototype.hide = function (instanceid) {
    const beforeLastInstanceId = this.getInstanceId(
        this.instanceCount ? this.instanceCount - 1 : 0
    );
    const options = this.getOptions(instanceid);
    if (options.visible) {
        if (instanceid != beforeLastInstanceId) {
            this._swapInstances(instanceid, beforeLastInstanceId);
        }
        options.visible = false;
        this.instanceCount -= 1;
    }
};

AttackManager.prototype.show = function (instanceid) {
    if (this.instanceCount == this.config.maxInstances) return; // nothing hidden
    const options = this.getOptions(instanceid);
    if (!options.visible) {
        const firstHiddenInstanceId = this.getHiddenInstance();
        if (!(
            instanceid == firstHiddenInstanceId || // this instance is the first hidden one
            firstHiddenInstanceId === undefined // this instance is the only one that exists (also the "first" hidden one)
        )) {
            this._swapInstances(instanceid, firstHiddenInstanceId);
        }
        options.visible = true;
        this.instanceCount += 1;
    }
};

AttackManager.prototype.pauseAll = function () {
    Object.values(this.instanceAttributes.options).forEach(
        (options) => (options.playing = false)
    );
};

AttackManager.prototype.playAll = function () {
    Object.values(this.instanceAttributes.options).forEach(
        (options) => (options.playing = true)
    );
};

AttackManager.prototype.play = function (instanceid) {
    this.getOptions(instanceid).playing = true;
};

AttackManager.prototype.pause = function (instanceid) {
    this.getOptions(instanceid).playing = false;
};

AttackManager.prototype.restartPlayback = function (instanceid) {
    this.setFrame(instanceid, 0);
    const options = this.getOptions(instanceid);
    this.show(instanceid);
    this.play(instanceid);
};

AttackManager.prototype.resetInstance = function (instanceid) {
    this.setFrame(instanceid, 0);
    const options = this.getOptions(instanceid);
    // options.speed = 1;

    const userData = this.getUserData(instanceid);
    if (typeof userData?.reset === "function") userData.reset();
};

AttackManager.prototype.getFrame = function (instanceid) {
    const index = this.getOptions(instanceid)?._index;
    return (index !== undefined && index >= 0)
        ? this.instanceAttributes.tileIdx[index]
        : undefined;
};

AttackManager.prototype.setFrame = function (instanceid, frame) {
    if (frame >= this.config.frames || frame < 0)
        Logger.throw(
            new Error(
                `[AttackManager (${
                    this.attackType
                })] | Cannot set instance ${instanceid} to frame ${frame}. Frame is out of bounds (0 - ${
                    this.config.frames - 1
                }).`
            )
        );
    const index = this.getOptions(instanceid)?._index;
    this.instanceAttributes.tileIdx[index] = frame;
};

AttackManager.prototype.getMatrix4 = function (instanceid) {
    const index = this.getOptions(instanceid)?._index;
    const matrix = new Matrix4();
    this.instances.getMatrixAt(index, matrix);
    return matrix;
};

AttackManager.prototype.setMatrix4 = function (instanceid, matrix) {
    const index = this.getOptions(instanceid)?._index;
    this.instances.setMatrixAt(index, matrix);
    this.instances.instanceMatrix.needsUpdate = true;
};

AttackManager.prototype.setMatrixComposition = function (
    instanceid,
    position,
    rotation,
    scale
) {
    this.setMatrix4(
        instanceid,
        new Matrix4().compose(position, rotation, scale)
    );
};

AttackManager.prototype.getMatrixComposition = function (instanceid) {
    const matrix = this.getMatrix4(instanceid);
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    matrix.decompose(position, rotation, scale);
    return [position, rotation, scale];
};

AttackManager.prototype.setPosition = function (instanceid, position) {
    const [p, r, s] = this.getMatrixComposition(instanceid);
    this.setMatrixComposition(instanceid, position, r, s);
};

AttackManager.prototype.setRotation = function (instanceid, rotation) {
    // accepts rotation as a Quaternion
    const [p, r, s] = this.getMatrixComposition(instanceid);
    this.setMatrixComposition(instanceid, p, rotation, s);
};

AttackManager.prototype.setScale = function (instanceid, scale) {
    // accepts scale as Vector3, NOT scalar
    const [p, r, s] = this.getMatrixComposition(instanceid);
    this.setMatrixComposition(instanceid, p, r, scale);
};

AttackManager.prototype.getElapsed = function (instanceid) {
    // returns animation progress as a float between 0-1
    const frame = this.getFrame(instanceid);
    return frame / (this.config.frames - 1);
};

AttackManager.prototype.getInstanceId = function (index) {
    const idx = Object.values(this.instanceAttributes.options)
        .map((o) => o._index)
        .indexOf(index);
    if (idx === -1)
        Logger.throw(
            new Error(
                `[AttackManager (${this.attackType})] | Instance at index "${index}" does not exist.`
            )
        );
    return Object.keys(this.instanceAttributes.options)?.[idx];
};

AttackManager.prototype.getData = function (instanceid) {
    return InstanceDataFactory(this, instanceid);
};

AttackManager.prototype.getOptions = function (instanceid) {
    const instanceOptions = this.instanceAttributes.options[instanceid];
    if (!instanceOptions)
        Logger.throw(
            new Error(
                `[AttackManager (${this.attackType})] | Instance tagged with UUID "${instanceid}" does not exist.`
            )
        );
    return instanceOptions;
};

AttackManager.prototype.getUserData = function (instanceid) {
    const userData = this.instanceAttributes.userData[instanceid];
    if (!userData)
        Logger.throw(
            new Error(
                `[AttackManager (${this.attackType})] | Instance tagged with UUID "${instanceid}" does not exist.`
            )
        );
    return userData;
};

AttackManager.prototype.setUserData = function (instanceid, data) {
    this.instanceAttributes.userData[instanceid] = data;
};

AttackManager.prototype.getData = function (instanceid) {
    const instanceOptions = this.getOptions(instanceid);
    if (!instanceOptions)
        Logger.throw(
            new Error(
                `[AttackManager (${this.attackType})] | Instance with UUID ${instanceid} does not exist.`
            )
        );
    return InstanceDataFactory(this, instanceOptions);
};

AttackManager.prototype._updateAnimation = function (instanceid) {
    // manages it's own timing
    // also handles callbacks, to avoid iterating again
    const options = this.getOptions(instanceid);
    const index = options._index;
    const intervals = Math.floor(this.tick.delta / (this.tick.interval / options.speed));
    const currentFrame = this.getFrame(instanceid);
    for (
        let _ = 0;
        _ < intervals;
        _++
    ) {
        if (options.playing) {
            if (currentFrame >= this.config.frames - 1) {
                options.playing = false;
                if (options.callback) options.callback(options);
            } else {
                this.setFrame(instanceid, currentFrame + 1);
            }
        }
    }
};

AttackManager.prototype._updateAnimations = function () {
    const tileIdxes = this.instanceAttributes.tileIdx;
    const options = this.getInstances().map((id) => this.getOptions(id));
    for (let i = 0; i < this.instanceCount && i < options.length; i++) {
        this._updateAnimation(options[i].uuid);
    }
};

AttackManager.prototype._updateTick = function (timedelta) {
    this.tick.delta += timedelta;
    this._updateAnimations();
    if (this.tick.delta >= this.tick.interval)
        this.tick.delta = this.tick.delta % this.tick.interval;
};

AttackManager.prototype.update = function (timedelta) {
    this._updateTick(timedelta);
};

function InstanceDataFactory(manager, instanceid) {
    const options = manager.getOptions( // [!] hacky solution until I can figure out how manager.instacestack keeps passing in object instead of object attribute
        instanceid.uuid
        ? instanceid.uuid
        : instanceid
    );
    const obj = {
        uuid: options.uuid,
        options: options,
        attributes: {},
    };
    const attributes = Object.entries(
        Object.getOwnPropertyDescriptors(manager.instanceAttributes)
    );
    attributes
        .filter(
            ([key, desc]) =>
                !key.startsWith("_") &&
                key != "options" &&
                (Array.isArray(desc.value) ||
                    desc.value instanceof Float32Array)
        ).forEach(([key]) => {
            obj.attributes[key] =
                manager.instanceAttributes[key][options._index];
        });
    attributes.filter(
        ([key, desc]) =>
            !key.startsWith("_") &&
            key != "options" &&
            typeof desc.value === "object" &&
            desc.value.hasOwnProperty(options.uuid)
        ).forEach(([key]) => {
            obj.attributes[key] =
                manager.instanceAttributes[key][options.uuid];
        });

    return obj;
}

export const AttackLogic = {
    BasicLogicFactory: function () {
        return Object.create({
            logic: (tis, tat) => {
                // sorts by total health
                if (tis.hp.total < tat.hp.total) return -1;
                else if (tis.hp.total > tat.hp.total) return 1;
                // both are equal
                else return 0;
            },
            target: function (targets) {
                return targets
                    .sort(this.logic)
                    ?.map((target) => target.uuid)
                    .at(0);
            },
        });
    },
    ParticleLogicFactory: function () {
        const self = AttackLogic.BasicLogicFactory();
        self.logic = function (me, them) {
            return them.hp.total - me.hp.total; // sorts from greatest to lowest health
        };
        return self;
    },
};
