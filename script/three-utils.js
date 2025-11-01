import { Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

function getHoveredShape(raycaster, mouse, camera, scene) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    return intersects.length > 0 ? intersects[0].object : undefined;
}
function isVectorZero(vector) {
    // meant for handling floating-point bullshit
    return (
        Math.abs(vector.x) < Number.EPSILON &&
        Math.abs(vector.y) < Number.EPSILON &&
        Math.abs(vector.z) < Number.EPSILON
    );
}
function loadGeometry(gltfPath) {
    return loadScene(gltfPath)
        .then(sc => { return getGeometry(sc) });
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
async function loadScene(gltfPath) {
    const loader = new GLTFLoader();
    try {
        const gltf = await loader.loadAsync(gltfPath);
        // Access the loaded scene, animations, etc.
        console.info("Scene loaded successfully:", gltf.scene);
        return gltf.scene;
    } catch (error) {
        console.error("Error loading model:", error);
        throw error; // Re-throw the error for further handling
    }
}

export { isVectorZero, loadGeometry };