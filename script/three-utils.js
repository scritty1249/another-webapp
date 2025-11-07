import { Vector3, CubeTextureLoader } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const zeroVector = new Vector3();

function isVectorZero(vector) {
    // meant for handling floating-point bullshit
    return (
        Math.abs(vector.x) < Number.EPSILON &&
        Math.abs(vector.y) < Number.EPSILON &&
        Math.abs(vector.z) < Number.EPSILON
    );
}
function loadTextureCube(cubeAssetsPath, cubeAssetsFormat = ".png") {
    return new CubeTextureLoader().load([
        cubeAssetsPath + 'px' + cubeAssetsFormat, cubeAssetsPath + 'nx' + cubeAssetsFormat,
        cubeAssetsPath + 'py' + cubeAssetsFormat, cubeAssetsPath + 'ny' + cubeAssetsFormat,
        cubeAssetsPath + 'pz' + cubeAssetsFormat, cubeAssetsPath + 'nz' + cubeAssetsFormat
    ]);
}
function loadGLTFShape(gltfPath) {
    return loadGLTF(gltfPath)
        .then((gltf) =>
            Promise.resolve([
                getMesh(gltf.scene),
                Object.fromEntries(Array.from(gltf.animations, ani => [ani.name, ani])),
            ])
        )
        .then((values) => {
            return {
                mesh: values[0],
                animations: values[1],
            };
        });
}
function getMesh(scene) {
    let mesh = undefined;
    scene.traverse(function (child) {
        if (child.isMesh) {
            // "child" is a THREE.Mesh object
            if (!mesh) {
                console.info(`Found Mesh object "${child.name}":`, child);
                mesh = child;
            }
        }
    });
    if (!mesh) {
        console.error("Error getting mesh");
        return;
    }
    return mesh;
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
    getZoom,
    loadTextureCube
};
