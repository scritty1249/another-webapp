import * as UTIL from "./utils.js";
import { zeroVector } from "./three-utils.js";
import { MathUtils, Vector3 } from "three";

export function AudioManager (audioContext) {
    const self = this;
    this.ctx = audioContext;
    this.buffer = {};
    this.sound = [];
    this._filter.volume = this.ctx.createGain();
    this._tempVec = new Vector3();

    // init
    this._filter.volume.connect(this.output);
    // add connection point after creating filters
    this._connect = this._filter.volume;

    this.volume = 1;
    return this;
}

AudioManager.prototype = {
    ctx: undefined,
    sound: undefined, // stack
    buffer: undefined,
    _filter: {
        volume: undefined,
    },
    _connect: undefined, // modify this to the "bottommost" node as more filter nodes are added
    _tempVec: undefined,
    get volume () {
        return this._filter.volume.gain.value;
    },
    set volume (gain) {
        this._filter.volume.gain.value = UTIL.clamp(gain, 0, 1);
    },
    get output () {
        return this.ctx?.destination;
    },
    get playing () {
        return this.ctx?.state == "running";
    },
};

AudioManager.prototype.update = function (position, maxDistance) {
    const soundStack = [...this.sound];
    soundStack.forEach(({pos, vol}) => {
        if (pos.isObject3D) { // object as source
            pos.getWorldPosition(this._tempVec);
            vol.gain.value = (maxDistance - Math.abs(position.distanceTo(this._tempVec))) / maxDistance;
        } else if (pos.isVector3) { // position as source
            vol.gain.value = (maxDistance - Math.abs(position.distanceTo(pos))) / maxDistance;
        }
    });
};

AudioManager.prototype.stop = function () { // stop everything
    const soundStack = [...this.sound];
    soundStack.forEach(({src, onended}) => {
        src.stop(0);
        onended();
    });
};
AudioManager.prototype.isPlaying = function (id) {
    return this.sound.some(s => s.id == id);
};
AudioManager.prototype.play = function (name, source = undefined, delay = 0) { // delay in milliseconds
    if (!name || !this.buffer?.[name]) {
        Logger.error(`[AudioManager] | Failed to play audio "${name}": No buffer data found.`);
        return false;
    }
    const srcNode = this.ctx.createBufferSource();
    const volNode = this.ctx.createGain();
    volNode.gain.value = 1;
    srcNode.buffer = this.buffer[name].array;
    srcNode.connect(volNode);
    volNode.connect(this.buffer[name]._volume);

    const soundStack = this.sound;
    const id = MathUtils.generateUUID();
    this.sound.push({
        id: id,
        src: srcNode,
        vol: volNode,
        pos: source,
        get onended() {
            return srcNode.onended;
        }
    });
    srcNode.onended = () => {
        const idx = soundStack.map(s => s.id).indexOf(id);
        if(idx !== -1)
            soundStack.splice(idx, 1);
    };
    setTimeout(() => srcNode.start(0), delay);
    return id;
};

AudioManager.prototype.register = function (name, arrayBuffer, volume = 1) {
    const audioSourceEntry = {
        name: name,
        array: arrayBuffer,
        _playing: false,
        _volume: this.ctx.createGain(),
        get volume () {
            return audioSourceEntry._volume.gain.value;
        },
        set volume (gain) {
            audioSourceEntry._volume.gain.value = UTIL.clamp(gain, 0, 1);
        },
    };
    audioSourceEntry._volume.connect(this._connect);
    audioSourceEntry.volume = volume;
    this.buffer[name] = audioSourceEntry;
    return audioSourceEntry;
};