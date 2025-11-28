/* Rewrite of OutlineEffect (https://threejs.org/docs/#OutlineEffect)
 *  with modifications to allow for selective object outlining,
 *  and configurability after initialization in ES5.
 *
 */
import {
    BackSide,
    Color,
    ShaderMaterial,
    UniformsLib,
    UniformsUtils,
} from "three";
export function SelectiveOutlineEffect(
    renderer // [!] needs to be WebGL renderer specifically
) {
    this.renderer = renderer;
    this.uniformsOutline.outlineColor.value = new Color(0xffffff);
    this.enabled = true;
    return this;
}
SelectiveOutlineEffect.prototype = {
    selected: {},
    get selectedlist () {
        return Object.values(this.selected);
    },
    renderer: undefined,
    enabled: false,
    removeThresholdCount: 60,
    defaultKeepAlive: false,
    originalOnBeforeRenders: {},
    cache: {},
    originalMaterials: {},
    originalOnBeforeRenders: {},
    uniformsOutline: {
        outlineThickness: {
            value: 0.008,
        },
        outlineColor: {
            value: undefined, // needs to be THREE.Color type
        },
        outlineAlpha: {
            value: 1.0,
        },
    },
    shader: {
        vert: [
            "#include <common>",
            "#include <uv_pars_vertex>",
            "#include <displacementmap_pars_vertex>",
            "#include <fog_pars_vertex>",
            "#include <morphtarget_pars_vertex>",
            "#include <skinning_pars_vertex>",
            "#include <logdepthbuf_pars_vertex>",
            "#include <clipping_planes_pars_vertex>",
            "uniform float outlineThickness;",
            "vec4 calculateOutline( vec4 pos, vec3 normal, vec4 skinned ) {",
            "	float thickness = outlineThickness;",
            "	const float ratio = 1.0;", // TODO: support outline thickness ratio for each vertex
            "	vec4 pos2 = projectionMatrix * modelViewMatrix * vec4( skinned.xyz + normal, 1.0 );",
            // [!] yeah this is just straight up wrong for our use case. // NOTE: subtract pos2 from pos because BackSide objectNormal is negative
            "	vec4 norm = normalize( pos2 - pos );",
            "	return pos + norm * thickness * pos.w * ratio;",
            "}",
            "void main() {",
            "	#include <uv_vertex>",
            "	#include <beginnormal_vertex>",
            "	#include <morphnormal_vertex>",
            "	#include <skinbase_vertex>",
            "	#include <skinnormal_vertex>",
            "	#include <begin_vertex>",
            "	#include <morphtarget_vertex>",
            "	#include <skinning_vertex>",
            "	#include <displacementmap_vertex>",
            "	#include <project_vertex>",
            "	vec3 outlineNormal = objectNormal;",
            "	gl_Position = calculateOutline( gl_Position, outlineNormal, vec4( transformed, 1.0 ) );",
            "	#include <logdepthbuf_vertex>",
            "	#include <clipping_planes_vertex>",
            "	#include <fog_vertex>",
            "}",
        ].join("\n"),
        frag: [
            "#include <common>",
            "#include <fog_pars_fragment>",
            "#include <logdepthbuf_pars_fragment>",
            "#include <clipping_planes_pars_fragment>",
            "uniform vec3 outlineColor;",
            "uniform float outlineAlpha;",
            "void main() {",
            "	#include <clipping_planes_fragment>",
            "	#include <logdepthbuf_fragment>",
            "	gl_FragColor = vec4( outlineColor, outlineAlpha );",
            "	#include <tonemapping_fragment>",
            "	#include <colorspace_fragment>",
            "	#include <fog_fragment>",
            "	#include <premultiplied_alpha_fragment>",
            "}",
        ].join("\n"),
    },
};
SelectiveOutlineEffect.prototype.addOutline = function (object, options = {recursive: true}) {
    if (this.isCompatible(object) === false)
        Logger.throw("[SelectiveOutlineEffect] | Object not compatible!", object);
    this.selected[object.uuid] = {object: object, options: options};
}
SelectiveOutlineEffect.prototype.removeOutline = function (object) {
    delete this.selected[object.uuid];
}
SelectiveOutlineEffect.prototype.createMaterial = function () {
    return new ShaderMaterial({
        type: "OutlineEffect",
        uniforms: UniformsUtils.merge([
            UniformsLib["fog"],
            UniformsLib["displacementmap"],
            this.uniformsOutline,
        ]),
        vertexShader: this.shader.vert,
        fragmentShader: this.shader.frag,
        side: BackSide,
    });
};
SelectiveOutlineEffect.prototype.getOutlineMaterialFromCache = function (
    originalMaterial
) {
    let data = this.cache[originalMaterial.uuid];
    if (data === undefined) {
        data = {
            material: this.createMaterial(),
            used: true,
            keepAlive: this.defaultKeepAlive,
            count: 0,
        };
        this.cache[originalMaterial.uuid] = data;
    }
    data.used = true;
    return data.material;
};
SelectiveOutlineEffect.prototype.getOutlineMaterial = function (
    originalMaterial
) {
    const outlineMaterial = this.getOutlineMaterialFromCache(originalMaterial);
    this.originalMaterials[outlineMaterial.uuid] = originalMaterial;
    this.updateOutlineMaterial(outlineMaterial, originalMaterial);
    return outlineMaterial;
};
SelectiveOutlineEffect.prototype.isCompatible = function (object) {
    const geometry = object.geometry;
    const hasNormals =
        geometry !== undefined && geometry.attributes.normal !== undefined;
    return (
        object.isMesh === true &&
        object.material !== undefined &&
        hasNormals === true
    );
};
SelectiveOutlineEffect.prototype.setOutlineMaterial = function (object) {
    if (this.isCompatible(object) === false) return;

    if (Array.isArray(object.material)) {
        for (let i = 0, il = object.material.length; i < il; i++) {
            object.material[i] = getOutlineMaterial(object.material[i]);
        }
    } else {
        object.material = this.getOutlineMaterial(object.material);
    }

    this.originalOnBeforeRenders[object.uuid] = object.onBeforeRender;
    object.onBeforeRender = (m) => {
        this.onBeforeRender(m);
    };
};
SelectiveOutlineEffect.prototype.restoreOriginalMaterial = function (object) {
    if (this.isCompatible(object) === false) return;
    if (Array.isArray(object.material)) {
        for (let i = 0, il = object.material.length; i < il; i++) {
            object.material[i] =
                this.originalMaterials[object.material[i].uuid];
        }
    } else {
        object.material = this.originalMaterials[object.material.uuid];
    }
    object.onBeforeRender = this.originalOnBeforeRenders[object.uuid];
};
SelectiveOutlineEffect.prototype.onBeforeRender = function (material) {
    const originalMaterial = this.originalMaterials[material.uuid];
    // just in case
    if (originalMaterial === undefined) return;
    this.updateUniforms(material, originalMaterial);
};
SelectiveOutlineEffect.prototype.updateUniforms = function (
    material,
    originalMaterial
) {
    const outlineParameters = originalMaterial.userData.outlineParameters;
    material.uniforms.outlineAlpha.value = originalMaterial.opacity;
    if (outlineParameters !== undefined) {
        if (outlineParameters.thickness !== undefined)
            material.uniforms.outlineThickness.value =
                outlineParameters.thickness;
        if (outlineParameters.color !== undefined)
            material.uniforms.outlineColor.value.fromArray(
                outlineParameters.color
            );
        if (outlineParameters.alpha !== undefined)
            material.uniforms.outlineAlpha.value = outlineParameters.alpha;
    }

    if (originalMaterial.displacementMap) {
        material.uniforms.displacementMap.value =
            originalMaterial.displacementMap;
        material.uniforms.displacementScale.value =
            originalMaterial.displacementScale;
        material.uniforms.displacementBias.value =
            originalMaterial.displacementBias;
    }
};
SelectiveOutlineEffect.prototype.updateOutlineMaterial = function (
    material,
    originalMaterial
) {
    if (material.name === "invisible") return;

    const outlineParameters = originalMaterial.userData.outlineParameters;

    material.fog = originalMaterial.fog;
    material.toneMapped = originalMaterial.toneMapped;
    material.premultipliedAlpha = originalMaterial.premultipliedAlpha;
    material.displacementMap = originalMaterial.displacementMap;

    if (outlineParameters !== undefined) {
        if (originalMaterial.visible === false) {
            material.visible = false;
        } else {
            material.visible =
                outlineParameters.visible !== undefined
                    ? outlineParameters.visible
                    : true;
        }

        material.transparent =
            outlineParameters.alpha !== undefined &&
            outlineParameters.alpha < 1.0
                ? true
                : originalMaterial.transparent;

        if (outlineParameters.keepAlive !== undefined)
            cache[originalMaterial.uuid].keepAlive =
                outlineParameters.keepAlive;
    } else {
        material.transparent = originalMaterial.transparent;
        material.visible = originalMaterial.visible;
    }

    if (
        originalMaterial.wireframe === true ||
        originalMaterial.depthTest === false
    )
        material.visible = false;

    if (originalMaterial.clippingPlanes) {
        material.clipping = true;

        material.clippingPlanes = originalMaterial.clippingPlanes;
        material.clipIntersection = originalMaterial.clipIntersection;
        material.clipShadows = originalMaterial.clipShadows;
    }

    material.version = originalMaterial.version; // update outline material if necessary
};
SelectiveOutlineEffect.prototype.cleanupCache = function () {
    let keys;

    // clear originalMaterials
    keys = Object.keys(this.originalMaterials);
    for (let i = 0, il = keys.length; i < il; i++) {
        this.originalMaterials[keys[i]] = undefined;
    }

    // clear originalOnBeforeRenders
    keys = Object.keys(this.originalOnBeforeRenders);
    for (let i = 0, il = keys.length; i < il; i++) {
        this.originalOnBeforeRenders[keys[i]] = undefined;
    }

    // remove unused outlineMaterial from cache
    keys = Object.keys(this.cache);
    for (let i = 0, il = keys.length; i < il; i++) {
        const key = keys[i];

        if (this.cache[key].used === false) {
            this.cache[key].count++;

            if (
                this.cache[key].keepAlive === false &&
                this.cache[key].count > this.removeThresholdCount
            ) {
                delete this.cache[key];
            }
        } else {
            this.cache[key].used = false;
            this.cache[key].count = 0;
        }
    }
};
SelectiveOutlineEffect.prototype.render = function (scene, camera) {
    if (this.enabled === false) {
        this.renderer.render(scene, camera);
        return;
    }
    const currentAutoClear = this.renderer.autoClear;
    this.renderer.autoClear = this.autoClear;
    this.renderer.render(scene, camera);
    this.renderer.autoClear = currentAutoClear;
    this.renderOutlines(scene, camera);
};
SelectiveOutlineEffect.prototype.renderOutlines = function (scene, camera) {
    const currentAutoClear = this.renderer.autoClear;
    const currentSceneAutoUpdate = scene.matrixWorldAutoUpdate;
    const currentSceneBackground = scene.background;
    const currentShadowMapEnabled = this.renderer.shadowMap.enabled;

    scene.matrixWorldAutoUpdate = false;
    scene.background = null;
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = false;

    this.selectedlist.forEach(({object, options}) => {
        if (options?.recursive === true)
            object.traverse((o) => {
                this.setOutlineMaterial(o);
            });
        else
            this.setOutlineMaterial(object);
    });
    this.renderer.render(scene, camera);
    this.selectedlist.forEach(({object, options}) => {
        if (options?.recursive === true)
            object.traverse((o) => {
                this.restoreOriginalMaterial(o);
            });
        else
            this.restoreOriginalMaterial(object);
    });

    this.cleanupCache();

    scene.matrixWorldAutoUpdate = currentSceneAutoUpdate;
    scene.background = currentSceneBackground;
    this.renderer.autoClear = currentAutoClear;
    this.renderer.shadowMap.enabled = currentShadowMapEnabled;
};
SelectiveOutlineEffect.prototype.setSize = function (width, height) {
    this.renderer.setSize(width, height);
};
