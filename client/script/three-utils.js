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
    return new Promise((resolve, reject) => {
        new CubeTextureLoader().load([
            cubeAssetsPath + 'px' + cubeAssetsFormat, cubeAssetsPath + 'nx' + cubeAssetsFormat,
            cubeAssetsPath + 'py' + cubeAssetsFormat, cubeAssetsPath + 'ny' + cubeAssetsFormat,
            cubeAssetsPath + 'pz' + cubeAssetsFormat, cubeAssetsPath + 'nz' + cubeAssetsFormat
        ], resolve, ()=>{}, reject);
    });
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
            const exported = {
                mesh: values[0],
                animations: values[1],
            };
            Logger.info(`Found in scene "${gltfPath}":`, exported);
            return exported;
        });
}
function loadGLTFShapes(gltfPath) {
    return loadGLTF(gltfPath)
        .then((gltf) =>
            Promise.resolve([
                getMeshes(gltf.scene),
                getAnimations(gltf.animations)
            ])
        )
        .then((values) => {
            const exported = {
                meshes: values[0],
                animations: values[1],
            };
            Logger.info(`Found in scene "${gltfPath}":`, exported);
            return exported;
        });
}
function getMesh(scene) { // only returns the first mesh (will also return any children)
    let mesh = undefined;
    scene.traverse(function (child) {
        if (child.isMesh) {
            // "child" is a THREE.Mesh object
            if (!mesh)
                mesh = child;
        }
    });
    return mesh;
}
function getMeshes(scene) {
    const meshes = [];
    scene.traverse(function (child) {
        if (child.isMesh && !isMeshChild(child))
            meshes.push(child);
    });
    return meshes;
}
function isMeshChild(mesh) {
    let curr = mesh?.parent;
    while (curr) {
        if (curr.isMesh)
            return true;
        curr = curr.parent;
    }
    return false;
}
function getAnimations(animations) {
    const anis = {};
    for (const animation of animations) {
        const name = animation.name.includes(".")
            ? animation.name.split(".", 2)[0]
            : animation.name.includes("-")
                ? animation.name.split("-", 2)[0]
                : animation.name;
        if (anis.hasOwnProperty(name))
            anis[name].push(animation);
        else
            anis[name] = [animation];
    }
    return anis;
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
    loadGLTFShapes,
    getZoom,
    loadTextureCube,
    loadTexture,
    raycast,
    directionVector,
    distanceTo,
    directionQuaternion,
    zeroVector
};
