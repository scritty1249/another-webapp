import WebGL from "three/addons/capabilities/WebGL.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DragControls } from "three/addons/controls/DragControls.js";
import { applyTetherForces } from "./physics.js";
import * as MESH from "./mesh.js";
import { loadGeometry } from "./three-utils.js";

const shapes = [];
const tethers = [];
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
    // start loading everything
    const geometries = Promise.all([
        loadGeometry("source/not-cube.glb")
    ]);

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
        applyTetherForces(tethers, shapeMinProximity, shapeMaxProximity, tetherForce, dragForceMultiplier);

        // update all connecting lines
        applyTetherUpdates();

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

    geometries.then(values => {
        let [ notCubeGeometry, ..._] = values;
        const cube = addNotCube( [0, 0, 0], notCubeGeometry);
        const cube2 = addNotCube( [3, 0, 3], notCubeGeometry);
        const cube3 = addNotCube( [-3, 0, 3], notCubeGeometry);
        addTether(cube, cube2);
        addTether(cube, cube3);
        addTether(cube2, cube3);

        // render the stuff
        renderer.setAnimationLoop(animate);
    });
}

function addNotCube(position, geometry) {
    const notCube = MESH.Shape(geometry);
    notCube.position.set(...position);
    shapes.push(notCube); // make interactable
    scene.add(notCube);
    return notCube;
}

function addTether(origin, target) {
    const tether = MESH.Tether(origin, target);
    tethers.push(tether); // tracking
    scene.add(tether);
    return tether;
}
function applyShapeIdleAnimation() {
    shapes.forEach((shape, i) => {
        // ambient motion
        if (!shape.dragged) {
            shape.rotation.y += 0.005 + i / 1000;
        }
    })
}
function applyTetherUpdates() {
    tethers.forEach(tether => {
        if (
            tether.origin.position != tether.vectors.origin ||
            tether.target.position != tether.vectors.target
        ) {
            tether.update();
        }
    });
}

