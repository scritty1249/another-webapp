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
    MathUtils,
    Matrix4,
    DoubleSide,
} from "three";
export function AttackManager(
    attackType,
    textureAtlas,
    alphaAtlas,
    geometry,
    frameCount,
    instanceCount,
    tickspeed,
    textureOptions = {
        repeat: {
            x: 1,
            y: 1,
        },
        alphaCutoff: 0.3,
    }
) {
    const self = this;
    this.attackType = attackType;
    this._dummy = new Object3D();
    this._atlas.map = new TextureLoader().load(textureAtlas);
    this._atlas.alphaMap = new TextureLoader().load(textureAtlas);
    this.config.frames = frameCount;
    this.config.repeat = new Vector2(
        textureOptions?.repeat?.x
            ? textureOptions?.repeat?.x / this.config.frames
            : textureOptions?.repeat?.x / this.config.frames,
        textureOptions?.repeat?.y ? textureOptions?.repeat?.y : 1
    );
    this.tick.interval = tickspeed;
    this.tick.delta = 0;
    this.config.maxInstances = instanceCount;
    this._geometry = geometry;
    this._material = new ShaderMaterial({
        vertexShader: this.shader._vert,
        fragmentShader: this.shader._frag,
        transparent: true,
        side: DoubleSide,
        uniforms: {
            map: { value: this._atlas.map },
            alphaMap: { value: this._atlas.alphaMap },
            repeat: { value: this.config.repeat },
            alphaThreshold: {
                value: textureOptions.alphaCutoff
                    ? textureOptions.alphaCutoff
                    : 1.0,
            },
        },
    });
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
    for (let i = 0; i < instanceCount; i++) {
        const uuid = MathUtils.generateUUID();
        this.instanceAttributes.options[uuid] = {
            callback: undefined, // callable
            visible: true, // changing does not do anything, only for monitoring instance states outside of class
            _enabled: true,
            _index: i,
        };
    }
    return this;
}

AttackManager.prototype = {
    attackType: undefined,
    textureAtlas: undefined,
    instances: undefined,
    _dummy: undefined, // for instance transformations
    _material: undefined,
    _geometry: undefined,
    _atlas: {
        map: undefined,
        alphaMap: undefined,
    },
    instanceAttributes: {
        _tileIdx: undefined,
        tileIdx: undefined,
        options: undefined,
    },
    tick: {
        delta: undefined,
        interval: undefined,
    },
    get instanceCount() {
        return this.instances?.count;
    },
    set instanceCount(count) {
        if (this.instances) this.instances.count = count;
    },
    config: {
        frames: 1,
        repeat: undefined, // Vector2
        maxInstances: 0,
    },
    shader: {
        uniforms: undefined, // Proxy for shader uniforms attribute
        _frag: `
         	varying vec2 vuv;
            uniform sampler2D map;
            uniform sampler2D alphaMap;
            uniform float alphaThreshold;
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
                gl_FragColor = vec4(txl, alpha > alphaThreshold ? 1. : alpha);
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

AttackManager.prototype.clear = function (delta) {
    this._atlas.map.dispose();
    this._atlas.alphaMap.dispose();
    this._geometry.dispose();
    this._dummy = undefined;
    this._material = undefined;
    this.instances = undefined;
};

AttackManager.prototype._swapInstances = function (originid, targetid) {
    const originData = this.getData(originid);
    const targetData = this.getData(targetid);
    const originMatrix = new Matrix4();
    const targetMatrix = new Matrix4();
    const targetIdx = targetData._index;
    this.instances.getMatrixAt(originOptions._index, originMatrix);
    this.instances.getMatrixAt(targetOptions._index, targetMatrix);
    this.instances.setMatrixAt(originOptions._index, targetMatrix);
    this.instances.setMatrixAt(targetOptions._index, originMatrix);
    targetData._index = originData._index;
    originData._index = targetIdx;
};

AttackManager.prototype.getHiddenInstance = function () { // returns the first hidden instance found in list
    if (this.instanceCount == this.config.maxInstances) return undefined; // nothing hidden
    return this.getInstanceId(this.instanceCount - 1);
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
    const lastInstanceId = this.getInstanceId(this.instanceCount - 1);
    if (instanceid == lastInstanceId) {
        // do nothing
    } else {
        this._swapInstances(instanceid, lastInstanceId);
    }
    this.getOptions(instanceid).visible = false;
    this.instanceCount -= 1;
};

AttackManager.prototype.show = function (instanceid) {
    if (this.instanceCount == this.config.maxInstances) return; // nothing hidden
    const firstHiddenInstanceId = this.getInstanceId(this.instanceCount); // +1 from last idx
    if (instanceid == firstHiddenInstanceId) {
        // do nothing
    } else {
        this._swapInstances(instanceid, firstHiddenInstanceId);
    }
    this.getOptions(instanceid).visible = true;
    this.instanceCount += 1;
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

AttackManager.prototype._getData = function (instanceIdx) {
    const instanceOptions = Object.values(
        this.instanceAttributes.options
    ).filter((o) => o._index == instanceIdx)?.[0];
    if (!instanceOptions)
        Logger.throw(
            new Error(
                `[AttackManager (${this.attackType})] | Instance at index ${instanceIdx} does not exist.`
            )
        );
    return InstanceDataFactory(this, instanceOptions);
};

AttackManager.prototype._updateAnimations = function () {
    // also handles callbacks, to avoid iterating again
    const tileIdxes = this.instanceAttributes.tileIdx;
    const options = this.instanceAttributes.options;
    for (let i = 0; i < this.instanceCount; i++) {
        if (tileIdxes[i] >= this.config.frames) {
            tileIdxes[i] = 0;
            if (options[i].callback) options[i].callback(options[i]);
        } else {
            tileIdxes[i]++;
        }
        tileIdxes[i] =
            tileIdxes[i] >= this.config.frames ? 0 : tileIdxes[i] + 1;
    }
};

AttackManager.prototype._updateTick = function (timedelta) {
    this.tick.delta += timedelta;
    if (this.tick.delta < this.tick.interval) return;
    for (let i = 0; i < Math.floor(this.tick.delta / this.tick.interval); i++) {
        this._updateAnimations();
    }
    this.tick.delta = this.tick.delta % this.tick.interval;
};

AttackManager.prototype.update = function (timedelta) {
    this._updateTick(timedelta);
};

function InstanceDataFactory(manager, instanceid) {
    const options = manager.getOptions(instanceid);
    const obj = {
        uuid: instanceid,
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
                key != "options" && (
                    Array.isArray(desc.value) ||
                    desc.value instanceof Float32Array
                )
        )
        .forEach(([key]) => {
            obj.attributes[key] =
                manager.instanceAttributes[key][options._index];
        });
    attributes.filter(
        ([key, desc]) =>
            !key.startsWith("_") &&
            key != "options" &&
            typeof desc.value === "object" &&
            desc.value.hasOwnProperty(instanceid)
    );

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

export const AttackerData = {
    attacks: [
        {
            type: "particle",
            amount: 99,
        },
    ],
};

export const AttackTypeData = {
    particle: {
        damage: 5,
        logic: AttackLogic.ParticleLogicFactory, // don't need to instantite logic controllers for "dumb" attackers- they're stateless!
    },
    cubedefense: {
        damage: 10,
        logic: AttackLogic.BasicLogicFactory,
    },
};

export const NodeTypeData = {
    placeholder: {
        health: 50,
        slots: 5,
    },
    cube: {
        health: 100,
        slots: 6,
    },
    scanner: {
        health: 75,
        slots: 4,
    },
    globe: {
        health: 0,
        slots: 3,
    },
};
