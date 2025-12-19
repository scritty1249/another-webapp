import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { ShaderMaterial, Color } from "three";

export function VignetteShaderPass (color = 0xff0000) {
    this.material = new ShaderMaterial({
        vertexShader: this.shader.vert,
        fragmentShader: this.shader.frag,
        uniforms: {
            color: { value: new Color(color) },
            intensity: { value: .35 },
            choke: { value: 0 },
            spread: { value: 0 },
            tDiffuse: { value: null }, // [!] cannot be renamed, used to recieve the rendered scene texture
        },
    });
    this.pass = new ShaderPass(this.material);
    return this;
}

VignetteShaderPass.prototype = {
    material: undefined,
    pass: undefined,
    _flashInterval: 10, // ms, length between update intervals after calling flash()
    _flashTarget: {
        choke: .7,
        spread: .2
    },
    _flashActiveTimeout: undefined,
    shader: {
        vert: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        frag: `
            uniform sampler2D tDiffuse;
            uniform float intensity;
            uniform float spread;
            uniform float choke;
            uniform vec3 color;
            varying vec2 vUv;
            void main() {
                vec4 txl = texture2D(tDiffuse, vUv);
                if (intensity > 0. && choke != 0.) {
                    float dist = distance(vUv, vec2(0.5, 0.5));
                    float vignette = smoothstep(choke, spread, 1. - dist);
                    txl.rgb += color * (vignette * intensity);
                }
                gl_FragColor = txl;
            }`
    },
    get spread () {
        return this.pass?.uniforms.spread?.value;
    },
    set spread (value) { // [0-1] range
        if (this.spread !== undefined && value < this.choke) // glitches if choke < spread. Also shouldn't ever happen anyways.
            this.pass.uniforms.spread.value = value;
    },
    get choke () {
        return this.pass?.uniforms.choke?.value;
    },
    set choke (value) { // [0-1] range
        if (this.choke !== undefined && value > this.spread) // glitches if choke < spread. Also shouldn't ever happen anyways.
            this.pass.uniforms.choke.value = value;
    },
    get intensity () {
        return this.pass?.uniforms.intensity?.value;
    },
    set intensity (value) { // [0-1] range
        if (this.intensity !== undefined)
            this.pass.uniforms.intensity.value = value;
    },
    get color () {
        return this.pass?.uniforms.color?.value;
    },
    set color (value) {
        if (this.color !== undefined)
            this.pass.uniforms.color.value.set(value);
    }
};

VignetteShaderPass.prototype.flash = function (duration = 3000) {
    let remaining = duration;
    const self = this;
    return new Promise(function (resolve, reject) {
        const handler = () => {
            try {
                if (self._flashActiveTimeout)
                    clearTimeout(self._flashActiveTimeout);
                const progress = (duration - remaining) / duration;
                if (progress == 1) {
                    self._flashActiveTimeout = undefined;
                    resolve(true);
                }
                const currentProgress = progress < .5 ? progress * 2 : 1 - ((progress - .5) * 2);
                self.spread = self._flashTarget.spread * currentProgress;
                self.choke = self._flashTarget.choke * currentProgress;
                if (remaining < self._flashInterval) {
                    const r = remaining;
                    remaining = 0;
                    self._flashActiveTimeout = setTimeout(handler, self._flashInterval - r);
                } else {
                    remaining -= self._flashInterval;
                    self._flashActiveTimeout = setTimeout(handler, self._flashInterval);
                }
            } catch (err) { // don't leave any chance for a permanently hanging Promise...
                reject(err);
            }
        }
        handler();
    });
};