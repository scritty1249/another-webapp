import WebGL from "three/addons/capabilities/WebGL.js";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { DragControls } from "three/addons/controls/DragControls.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";

const shapes = [];
const lines = [];
const tetherForce = 0.15;
const shapeMinProximity = 4;
const shapeMaxProximity = 3;
const dragForceMultiplier = 1.05; // strength applied to tethered objects if the other object is being dragged

// Setup
// mouse functionality
const raycaster = new THREE.Raycaster();
// scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xabcdef);
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 5;
camera.position.y = 2;
// rendererererer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

if (WebGL.isWebGL2Available()) {
    // Initiate function or other initializations here
    mainloop();
} else {
    const warning = WebGL.getWebGL2ErrorMessage();
    document.getElementById("container").appendChild(warning);
}

function mainloop() {
    document.getElementById("container").appendChild(renderer.domElement);

    // Setup external (yawn) library controls
    const controls = {
        drag: new DragControls(shapes, camera, renderer.domElement), // drag n' drop
        camera: new OrbitControls(camera, renderer.domElement), // camera
    };

    controls.drag.addEventListener("dragstart", function (event) {
        controls.camera.enabled = false;
        event.object.dragged = true;
        event.object.material.emissive.set(0x999999);
    });
    controls.drag.addEventListener("dragend", function (event) {
        controls.camera.enabled = true;
        event.object.dragged = false;
        event.object.material.emissive.set(0x000000);
    });

    function animate() {
        // ambient animation
        applyShapeIdleAnimation();
        
        // physics
        applyTethers(shapeMinProximity, shapeMaxProximity, tetherForce, dragForceMultiplier);

        // update all connecting lines
        applyLineUpdates();

        // required if controls.enableDamping or controls.autoRotate are set to true
        controls.camera.update(); // must be called after any manual changes to the camera"s transform
        renderer.render(scene, camera);
    }

    // render a plane
    const planeGeometry = new THREE.PlaneGeometry(20, 20); // A 20x20 unit plane
    const planeMaterial = new THREE.MeshPhongMaterial({ color: 0x090909 }); // dark gray, single-sided
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    scene.add(plane);
    plane.receiveShadow = true;
    plane.rotation.set(-Math.PI / 2, 0, 0); // Rotate to lie flat on the XZ plane
    plane.position.set(0, -1, 0);

    // Control shadows
    const ambientLight = new THREE.AmbientLight(0x404040, 15); // soft white light
    scene.add(ambientLight);

    // render a light
    const light = new THREE.PointLight(0xffffff, 3500);
    light.position.set(-10, 20, 10);
    scene.add(light);
    light.castShadow = true;
    light.shadow.camera.top = 2;
    light.shadow.camera.bottom = -2;
    light.shadow.camera.left = -2;
    light.shadow.camera.right = 2;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 10;

    // load everything
    loadScene("source/not-cube.glb")
        .then((sc) => getGeometry(sc))
        .then((geometry) => {
            const cube = createShape(geometry);
            cube.position.set(0, 0, 0);
            scene.add(cube);

            const cube2 = createShape(geometry);
            cube2.position.set(3, 0, 3);
            scene.add(cube2);

            const cube3 = createShape(geometry);
            cube3.position.set(-3, 0, 3);
            scene.add(cube3);

            const line = connectLine(cube, cube2);
            scene.add(line);

            const line2 = connectLine(cube, cube3);
            scene.add(line2);

            const line3 = connectLine(cube2, cube3);
            scene.add(line3);

            // render the stuff
            renderer.setAnimationLoop(animate);
        });
}

function getHoveredShape() {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    return intersects.length > 0 ? intersects[0].object : undefined;
}

function createShape(geometry, clickable = true) {
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const mesh = new THREE.Mesh(geometry, material);
    shapes.push(mesh);
    console.info("Loaded mesh:", mesh);
    mesh.castShadow = true;
    mesh.clickable = clickable;
    mesh.dragged = false;
    mesh.lines = {
        origin: [],
        target: [],
    };
    return mesh;
}
function getLineVectors(line) {
    const positionAttribute = line.geometry.attributes.position;
    return {
        origin: new THREE.Vector3().fromBufferAttribute(positionAttribute, 0),
        target: new THREE.Vector3().fromBufferAttribute(positionAttribute, 1),
    };
}
function getLineLength(line) {
    let {p1, p2} = getLineVectors(line);
    return p1.distanceTo(p2);
}
function setLine(line, origin, target) {
    line.origin = origin;
    line.target = target;
    updateLine(line);
}
function updateLine(line) {
    line.geometry.setFromPoints([line.origin.position, line.target.position]);
    line.length = line.origin.position.distanceTo(line.target.position);
    line.direction.subVectors(line.target.position, line.origin.position).normalize(); // always points from target to origin
    line.geometry.attributes.position.needsUpdate = true;
}
function connectLine(origin, target, color = 0xc0c0c0) {
    const material = new LineMaterial({
        color: color,
        linewidth: 2.5,
        alphaToCoverage: true,
    });
    const geometry = new LineGeometry();
    const line = new Line2(geometry, material);
    line.direction = new THREE.Vector3();
    setLine(line, origin, target);
    lines.push(line);
    if (origin.lines) {
        origin.lines.origin.push(line);
    }
    if (target.lines) {
        target.lines.target.push(line);
    }
    return line;
}
function random(min, max) {
    return Math.random() * (max - min) + min;
}
function applyShapeIdleAnimation() {
    shapes.forEach((shape, i) => {
        // ambient motion
        if (!shape.dragged) {
            shape.rotation.y += 0.005 + i / 1000;
        }
    })
}
function applyLineUpdates() {
    lines.forEach((line) => {
        let lineVectors = getLineVectors(line);
        if (
            line.origin.position != lineVectors.origin ||
            line.target.position != lineVectors.target
        ) {
            updateLine(line);
        }
    });
}
function applyTethers(attractProximity, repelProximity, force, dragForceMultiplier) {
    // positive forceVec attracts, negative repeals
    lines.forEach(line => {
        const attractiveVector = new THREE.Vector3();
        const magnitude = ((attractProximity - line.length) / attractProximity) * (force * (line.target.dragged || line.origin.dragged) ? dragForceMultiplier : 1);
        if (line.length > attractProximity) {
            attractiveVector.add(line.direction.clone().multiplyScalar(magnitude));
        } else if (line.length < repelProximity) {
            attractiveVector.sub(line.direction.clone().multiplyScalar(-magnitude));
        }
        if (!isVectorZero(attractiveVector))
            if (!line.origin.dragged)
                line.origin.position.sub(attractiveVector);
            if (!line.target.dragged)
                line.target.position.add(attractiveVector);
    });
}

function isVectorZero(vector) {
    // meant for handling floating-point bullshit
    return (
        Math.abs(vector.x) < Number.EPSILON &&
        Math.abs(vector.y) < Number.EPSILON &&
        Math.abs(vector.z) < Number.EPSILON
    );
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
