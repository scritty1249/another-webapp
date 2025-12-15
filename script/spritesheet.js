import {
    Vector2,
    Vector3,
    FrontSide,
    ShaderMaterial,
    RawShaderMaterial,
    TextureLoader,
    Group,
    Mesh,
    Color,
} from "three";
import * as UTIL from "./utils.js";

const _vertShader = `
    varying vec2 vuv;
    void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        vuv = uv;
    }
`;

export const SSMaterialType = {
    // planes, not actual sprites lol
    Frames: function (map, alphaMap, frames) {
        const fragShader = `
            varying vec2 vuv;
            uniform sampler2D map;
            uniform sampler2D alphaMap;
            uniform float tileIdx;
            uniform vec2 tileSize;
            void main() {
                vec2 uv = vuv;
                uv = fract((uv + tileIdx) * tileSize);
                vec2 smooth_uv = tileSize * vuv;
                vec4 duv = vec4(dFdx(smooth_uv), dFdy(smooth_uv));
                vec3 txl = textureGrad(map, uv, duv.xy, duv.zw).rgb;
                vec4 alphaTxl = textureGrad(alphaMap, uv, duv.xy, duv.zw);
                float alpha = ((alphaTxl.r + alphaTxl.g + alphaTxl.b) / 3.);
                gl_FragColor = vec4(txl, alpha);
            }
        `;
        const vertShader = _vertShader;
        const material = new ShaderMaterial({
            vertexShader: vertShader,
            fragmentShader: fragShader,
            transparent: true,
            depthWrite: false,
            side: FrontSide,
            uniforms: {
                tileSize: { value: new Vector2(1 / frames, 1) },
                tileIdx: { value: 0 },
                map: { value: new TextureLoader().load(map) },
                alphaMap: {
                    value: new TextureLoader().load(alphaMap),
                },
            },
        });
        return material;
    },
    Mask: function (map, alphaMap, mapSize, alphaMapSize) {
        const fragShader = `
            varying vec2 vuv;
            uniform sampler2D map;
            uniform sampler2D alphaMap;
            uniform vec2 maskOffset;
            uniform vec2 mapSizeRatio;
            void main() {
                vec2 uv = fract(vuv);
                vec2 alphaUv = fract((vuv + maskOffset) * mapSizeRatio);
                vec4 duv = vec4(dFdx(vuv), dFdy(vuv));
                vec4 alphaDuv = vec4(dFdx(vuv * mapSizeRatio), dFdy(vuv * mapSizeRatio));
                vec3 txl = textureGrad(map, uv, duv.xy, duv.zw).rgb;
                vec4 alphaTxl = textureGrad(alphaMap, alphaUv, alphaDuv.xy, alphaDuv.zw);
                float alpha = ((alphaTxl.r + alphaTxl.g + alphaTxl.b) / 3.);
                gl_FragColor = vec4(txl, alpha);
            }
        `;
        const vertShader = _vertShader;
        const material = new ShaderMaterial({
            vertexShader: vertShader,
            fragmentShader: fragShader,
            transparent: true,
            depthWrite: false,
            side: FrontSide,
            uniforms: {
                mapSizeRatio: { value: mapSize.clone().divide(alphaMapSize) },
                maskOffset: { value: new Vector2() },
                map: { value: new TextureLoader().load(map) },
                alphaMap: {
                    value: new TextureLoader().load(alphaMap),
                },
            },
        });
        return material;
    },
    CircleProgress: function (color, bgColor = 0x000000, bgOpacity = .0) {
        const fragShader = `
            precision mediump float;
            varying vec2 vuv;
            uniform float progress;
            uniform vec3 color;
            uniform vec3 bgColor;
            uniform float bgOpacity;
            uniform float innerRadius;
            uniform float outerRadius;
            void main() {
                vec2 vuv = vec2( 1. - vuv.y, vuv.x); // rotate, start at 12 o'clock
                float dist = length(vuv - vec2(.5, .5));

                float ring = smoothstep(innerRadius, innerRadius + 0.01, dist) * 
                    smoothstep(outerRadius, outerRadius - 0.01, dist);
                float angle = atan(vuv.y -.5, vuv.x -.5);
                // Remap angle from [-PI, PI] to [0, 2*PI]
                angle = angle + PI; 

                float arc = smoothstep(0.0, 0.01, angle - (progress * 2.0 * PI));
                
                if (angle < progress * 2.0 * PI && ring > 0.5) {
                    gl_FragColor = vec4(color, 1.0); // Draw the colored part
                } else if (ring > 0.5) {
                    gl_FragColor = vec4(bgColor, bgOpacity); // Draw a dimmer background ring
                } else {
                    gl_FragColor = vec4(0.0); // Transparent background
                }
            }
        `;
        const vertShader = `
            uniform mat4 projectionMatrix;
            uniform mat4 viewMatrix;
            uniform mat4 modelMatrix;
            attribute vec3 position;
            attribute vec2 uv;
            varying vec2 vuv;

            void main() {
                vuv = uv;
                gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
            }
        `;
        const material = new RawShaderMaterial({
            vertexShader: vertShader,
            fragmentShader: fragShader,
            transparent: true,
            depthWrite: false,
            side: FrontSide,
            uniforms: {
                progress: { value: 0.0 },
                color: { value: new Color(color) },
                bgColor: { value: new Color(bgColor) },
                bgOpacity: { value: bgOpacity },
                innerRadius: { value: 0.25 },
                outerRadius: { value: 0.35 },
            },
            defines: {
                PI: Math.PI,
            },
        });
        return material;
    },
};

export function NodeSSOverlay(targetNodeMesh) {
    // [!] fix naming
    const wrapper = new Group();
    wrapper.userData = {
        children: {},
        target: targetNodeMesh,
        update: function (camera) {
            wrapper.quaternion.copy(camera.quaternion);
            const pos = new Vector3();
            this.target.getWorldPosition(pos);
            wrapper.position.copy(pos);
            Object.values(this.children).forEach((child) => {
                if (child.userData.update) child.userData.update();
                if (!child.userData.needsUpdate) return;
                child.position.copy(
                    child.userData.offset
                        .clone()
                        .multiplyScalar(this.target.scale.x)
                );
                child.userData.needsUpdate = false;
            });
        },
        addChild: function (name, mesh, offset) {
            this.children[name] = NodeOverlayChild(mesh, offset);
            wrapper.add(mesh);
        },
    };
    return wrapper;
}

function NodeOverlayChild(mesh, offset) {
    mesh.userData._offset = offset.clone();
    mesh.userData.needsUpdate = true;
    Object.defineProperty(mesh.userData, "offset", {
        get: function () {
            return this._offset;
        },
        set: function (value) {
            this._offset.copy(value);
            this.needsUpdate = true;
        },
    });

    return mesh;
}

export function SSFramesMesh(geometry, material, tiles) {
    // NEVER CLONE THIS.
    const spriteSheetFramesMesh = new Mesh(geometry, material);
    spriteSheetFramesMesh.userData = {
        tileCount: tiles,
        get tileIdx() {
            return material.uniforms.tileIdx.value;
        },
        set tileIdx(value) {
            material.uniforms.tileIdx.value = UTIL.clamp(
                value,
                0,
                this.tileCount
            );
        },
    };
    return spriteSheetFramesMesh;
}

export function SSMaskMesh(geometry, material) {
    // NEVER CLONE THIS.
    const spriteSheetMaskMesh = new Mesh(geometry, material);
    spriteSheetMaskMesh.userData = {
        maskOffset: new Proxy(material.uniforms.maskOffset.value, {}),
    };
    return spriteSheetMaskMesh;
}

export function SSNodeSlotsMesh(geometry, material, slots) {
    // NEVER CLONE THIS.
    const spriteSheetNodeSlotsMesh = new Mesh(geometry, material);
    spriteSheetNodeSlotsMesh.userData = {
        set slots(value) {
            if (value > slots || value < 1)
                Logger.throw(
                    new Error(
                        `[SpriteSheetNodeSlotsMesh] | Error: cannot set number of slots to less than 1 or more than ${slots}.`
                    )
                );
            material.uniforms.maskOffset.value.y = value - 1;
        },
        get slots() {
            return material.uniforms.maskOffset.value.y - 1;
        },
        set filled(value) {
            if (value > slots + 1 || value < 0)
                Logger.throw(
                    new Error(
                        `[SpriteSheetNodeSlotsMesh] | Error: cannot set number of filled slots to less than 0 or more than ${slots}.`
                    )
                );
            material.uniforms.maskOffset.value.x = value;
        },
        get filled() {
            return material.uniforms.maskOffset.value.x;
        },
    };
    return spriteSheetNodeSlotsMesh;
}

export function SSProgressMesh(geometry, material) {
    const spriteSheetProgressMesh = new Mesh(geometry, material);
    spriteSheetProgressMesh.userData = {
        set progress(value) {
            if (value > 1 || value < 0)
                Logger.throw(
                    new Error(
                        `[SpriteSheetProgressMesh] | Error: progress must be set to a value between 0 and 1 (inclusive).`
                    )
                );
            material.uniforms.progress.value = value;
        },
        get progress() {
            return material.uniforms.progress.value;
        },
    };
    return spriteSheetProgressMesh;
}
