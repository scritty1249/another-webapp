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
    Frames: function (map, alphaMap) {
        const fragShader = `
            varying vec2 vuv;
            uniform sampler2D map;
            uniform sampler2D alphaMap;
            uniform float tileIdx;
            void main() {
                vec2 uv = vuv;
                uv = fract(uv + tileIdx);
                vec4 duv = vec4(dFdx(vuv), dFdy(vuv));
                vec3 txl = textureGrad(map, uv, duv.xy, duv.zw).rgb;
                vec4 alphaTxl = textureGrad(alphaMap, uv, duv.xy, duv.zw);
                float alpha = ((alphaTxl.r + alphaTxl.g + alphaTxl.b) / 3.);
                gl_FragColor = vec4(txl, alpha);
            }
        `;
        const vertShader = `
            varying vec2 vuv;
            void main() {
                vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
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
                vec2 uv = vuv;
                uv = fract(uv + tileIdx);
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
                vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
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
};

export function NodeSSOverlay(targetNodeMesh) {
    // [!] fix naming
    const wrapper = new Group();
    wrapper.userData = {
        children: {},
        target: targetNodeMesh,
        update: function (camera) {
            // wrapper.quaternion.copy(camera.quaternion);
            const pos = new Vector3();
            this.target.getWorldPosition(pos);
            wrapper.position.copy(pos);
            Object.values(this.children).forEach((child) => {
                if (child?.update) child.update();
                if (!child.needsUpdate) return;
                child.mesh.position.copy(child.offset);
                child.needsUpdate = false;
            });
        },
        addChild: function (name, mesh, offset) {
            this.children[name] = NodeOverlayChild(mesh, offset);
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
