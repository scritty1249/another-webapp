import { Vector3, Quaternion, CubeTextureLoader, TextureLoader, Raycaster } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const zeroVector = new Vector3();
const upVector = new Vector3(0, 1, 0);

function isVectorZero(vector) {
    // meant for handling floating-point bullshit
    return (
        Math.abs(vector.x) < Number.MIN_VALUE &&
        Math.abs(vector.y) < Number.MIN_VALUE &&
        Math.abs(vector.z) < Number.MIN_VALUE
    );
}
function loadTextureCube(cubeAssetsPath, cubeAssetsFormat = ".png") {
    return new CubeTextureLoader().load([
        cubeAssetsPath + 'px' + cubeAssetsFormat, cubeAssetsPath + 'nx' + cubeAssetsFormat,
        cubeAssetsPath + 'py' + cubeAssetsFormat, cubeAssetsPath + 'ny' + cubeAssetsFormat,
        cubeAssetsPath + 'pz' + cubeAssetsFormat, cubeAssetsPath + 'nz' + cubeAssetsFormat
    ]);
}
function loadTexture(texturePath) {
    return (new TextureLoader()).loadAsync(texturePath);
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
                Logger.info(`Found Mesh object "${child.name}":`, child);
                mesh = child;
            }
        }
    });
    if (!mesh) {
        Logger.error("Error getting mesh");
        return;
    }
    return mesh;
}
async function loadGLTF(gltfPath) {
    const loader = new GLTFLoader();
    try {
        const gltf = await loader.loadAsync(gltfPath);
        // Access the loaded scene, animations, etc.
        Logger.info("Scene loaded successfully:", gltf.scene);
        return gltf;
    } catch (error) {
        Logger.error("Error loading model:", error);
        Logger.throw(error); // Re-throw the error for further handling
    }
}
function getZoom(camera) {
    return camera.position.distanceTo(zeroVector);
}

function raycast(raycaster, objects, searchChildren = true) {
    objects.forEach(obj => obj.updateMatrixWorld());
    const intersects = raycaster.intersectObjects(objects, searchChildren);
    return intersects.length > 0
        ? intersects[0]
        : undefined;
}

function directionVector(originPos, targetPos) {
    return targetPos.clone().sub(originPos).normalize();
}

function directionQuaternion(originPos, targetPos) {
    return new Quaternion().setFromUnitVectors(originPos, targetPos);
}

function distanceTo(object, point) { // check vertexes, so should go based off edges- more accurate for complex shapes vs. a bounding box
    const vertices = object.geometry.attributes.position.array;
    const vertex = new Vector3();
    let distance = Number.POSITIVE_INFINITY;
    let tempdist;
    for (let i = 0; i < vertices.length; i+=3) {
        vertex.set(vertices[i],vertices[i+1],vertices[i+2]);
        vertex.copy(object.localToWorld(vertex));
        tempdist = vertex.distanceTo(point);
        if (tempdist < distance)
            distance = tempdist;
    }
    return distance;
}

export {
    isVectorZero,
    loadGLTFShape,
    getZoom,
    loadTextureCube,
    loadTexture,
    raycast,
    directionVector,
    distanceTo,
    directionQuaternion,
    zeroVector
};
