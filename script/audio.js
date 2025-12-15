import * as UTIL from "./utils.js";

export function AudioManager (audioContext) {
    const self = this;
    this.ctx = audioContext;
    this.buffer = {};
    this.sound = [];
    this._filter.volume = this.ctx.createGain();

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
    _connect: undefined, // modify this to the bottommost as more filter nodes are added
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

AudioManager.prototype.stop = function () { // stop everything
    const soundStack = [...this.sound];
    soundStack.forEach(s => {
        s.stop(0);
        s.onended();
    });
};

AudioManager.prototype.play = function (name, delay = 0) { // delay in milliseconds
    if (!this.buffer?.[name]) {
        Logger.error(`[AudioManager] | Failed to play audio "${name}": No buffer data found.`);
        return false;
    }
    const srcNode = this.ctx.createBufferSource();
    srcNode.buffer = this.buffer[name].array;
    srcNode.connect(this.buffer[name]._volume);

    const soundStack = this.sound;
    this.sound.push(srcNode);
    srcNode.onended = () => {
        const idx = soundStack.indexOf(srcNode);
        if(idx !== -1)
            soundStack.splice(idx, 1);
    };
    setTimeout(() => srcNode.start(0), delay);
    return true;
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