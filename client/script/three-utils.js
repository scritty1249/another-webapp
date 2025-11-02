import { Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const zeroVector = new Vector3();

function highlightObject(object) {
    object.material.emissive.set(0x999999);
}
function unHighlightObject(object) {
    object.material.emissive.set(0x000000);
}
function getHoveredShape(raycaster, mouse, camera, shapes) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(shapes, true);
    return intersects.length > 0
        ? intersects[0].object.parent
            ? intersects[0].object.parent
            : intersects[0].object
        : undefined;
}
function getObjectScreenPosition(obj, camera, renderer) {
    const worldPosition = new Vector3();
    obj.getWorldPosition(worldPosition); // Get world position

    worldPosition.project(camera); // Project to NDC

    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    const screenX = (worldPosition.x * 0.5 + 0.5) * rect.width + rect.left;
    const screenY = (-worldPosition.y * 0.5 + 0.5) * rect.height + rect.top;

    return { x: screenX, y: screenY, distance: camera.position.distanceTo(worldPosition)};
}
function isVectorZero(vector) {
    // meant for handling floating-point bullshit
    return (
        Math.abs(vector.x) < Number.EPSILON &&
        Math.abs(vector.y) < Number.EPSILON &&
        Math.abs(vector.z) < Number.EPSILON
    );
}
function loadGLTFShape(gltfPath) {
    return loadGLTF(gltfPath)
        .then((gltf) =>
            Promise.all([
                getGeometry(gltf.scene),
                Promise.resolve(gltf.animations[0]),
            ])
        )
        .then((values) => {
            return {
                geometry: values[0],
                animation: values[1],
            };
        });
}
async function getGeometry(scene) {
    let promise = Promise.resolve(false);
    scene.traverse(function (child) {
        if (child.isMesh) {
            console.info(`Found Geometry:`, child.geometry);
            // "child" is a THREE.Mesh object
            // "child.geometry" is the THREE.BufferGeometry associated with this mesh
            promise = Promise.resolve(child.geometry);
        }
    });
    let result = await promise;
    if (result == false) {
        console.error("Error getting geometry");
        return;
    }
    return result;
}
async function loadGLTF(gltfPath) {
    const loader = new GLTFLoader();
    try {
        const gltf = await loader.loadAsync(gltfPath);
        // Access the loaded scene, animations, etc.
        console.info("Scene loaded successfully:", gltf.scene);
        return gltf;
    } catch (error) {
        console.error("Error loading model:", error);
        throw error; // Re-throw the error for further handling
    }
}
function getZoom(camera) {
    return camera.position.distanceTo(zeroVector);
}

export {
    isVectorZero,
    loadGLTFShape,
    getHoveredShape,
    highlightObject,
    unHighlightObject,
    getObjectScreenPosition,
    getZoom
};
