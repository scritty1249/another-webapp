import {
    Vector2,
    Vector3,
    FrontSide,
    ShaderMaterial,
    TextureLoader,
    Group,
    Mesh,
} from "three";
import * as UTIL from "./utils.js";

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
        const vertShader = `
            varying vec2 vuv;
            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                vuv = uv;
            }
        `;
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
    Mask: function (map, alphaMap) {
        const fragShader = `
            varying vec2 vuv;
            uniform sampler2D map;
            uniform sampler2D alphaMap;
            uniform vec2 maskOffset;
            void main() {
                vec2 uv = fract(vuv);
                vec4 duv = vec4(dFdx(vuv), dFdy(vuv));
                vec3 txl = textureGrad(map, uv, duv.xy, duv.zw).rgb;
                vec4 alphaTxl = textureGrad(alphaMap, uv, duv.xy + maskOffset, duv.zw);
                float alpha = ((alphaTxl.r + alphaTxl.g + alphaTxl.b) / 3.);
                gl_FragColor = vec4(txl, alpha);
            }
        `;
        const vertShader = `
            varying vec2 vuv;
            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                vuv = uv;
            }
        `;
        const material = new ShaderMaterial({
            vertexShader: vertShader,
            fragmentShader: fragShader,
            transparent: true,
            depthWrite: false,
            side: FrontSide,
            uniforms: {
                maskOffset: { value: new Vector2() },
                map: { value: new TextureLoader().load(map) },
                alphaMap: {
                    value: new TextureLoader().load(alphaMap),
                },
            },
        });
        return material;
    },
    NodeSlots: function (map, alphaMap, tileSize, mapSize) {
        const fragShader = `
            varying vec2 vuv;
            uniform sampler2D map;
            uniform sampler2D alphaMap;
            uniform vec2 tileIdx;
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
        const vertShader = `
            varying vec2 vuv;
            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                vuv = uv;
            }
        `;
        const material = new ShaderMaterial({
            vertexShader: vertShader,
            fragmentShader: fragShader,
            transparent: true,
            depthWrite: false,
            side: FrontSide,
            uniforms: {
                tileSize: { value: tileSize.clone().divide(mapSize)},
                tileIdx: { value: new Vector2() },
                map: { value: new TextureLoader().load(map) },
                alphaMap: {
                    value: new TextureLoader().load(alphaMap),
                },
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
                if (child?.update) child.update();
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
        set slots (value) {
            if (value > slots || value < 1)
                Logger.throw(
                    new Error(
                        `[SpriteSheetNodeSlotsMesh] | Error: cannot set number of slots to less than 1 or more than ${slots}.`
                    )
                );
            material.uniforms.tileIdx.value.y = value - 1;
        },
        get slots () {
            return material.uniforms.tileIdx.value.y -1;
        },
        set filled (value) {
            if (value > slots + 1 || value < 0)
                Logger.throw(
                    new Error(
                        `[SpriteSheetNodeSlotsMesh] | Error: cannot set number of filled slots to less than 0 or more than ${slots}.`
                    )
                );
            material.uniforms.tileIdx.value.x = value;
        }, 
        get filled () {
            return material.uniforms.tileIdx.value.x;
        },
    };
    return spriteSheetNodeSlotsMesh;
}
