import WebGL from "three/addons/capabilities/WebGL.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DragControls } from "three/addons/controls/DragControls.js";
import { applyPhysicsForces } from "./physics.js";
import * as MESH from "./mesh.js";
import { loadGLTFShape, getHoveredShape, highlightObject, unHighlightObject } from "./three-utils.js";

const shapes = {
    parents: [],
    subjects: [],
    add: function(shape) {
        this.parents.push(shape);
        this.subjects.push(shape.subject);
    }
};
const tethers = [];
const tetherForce = 0.15;
const shapeMinProximity = 5;
const shapeMaxProximity = 3.5;

// Setup
// mouse functionality
const mouse = new THREE.Vector2();
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

window.addEventListener('mousemove', function (event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}, false);

if (WebGL.isWebGL2Available()) {
    // Initiate function or other initializations here
    mainloop();
} else {
    const warning = WebGL.getWebGL2ErrorMessage();
    document.getElementById("container").appendChild(warning);
}

function mainloop() {
    document.getElementById("container").appendChild(renderer.domElement);
    const clock = new THREE.Clock();
    // start loading everything
    const geometries = Promise.all([
        loadGLTFShape("source/moving-not-cube.glb")
    ]);

    // Setup external (yawn) library controls
    const controls = {
        drag: new DragControls(shapes.parents, camera, renderer.domElement), // drag n" drop
        camera: new OrbitControls(camera, renderer.domElement), // camera
    };
    controls.camera.enablePan = false;
    controls.drag.transformGroup = true;
    controls.drag.rotateSpeed = 0;

    // release right click
    controls.drag.domElement.removeEventListener("contextmenu", controls.drag._onContextMenu);
    controls.camera.domElement.removeEventListener("contextmenu", controls.camera._onContextMenu);
    controls.drag.addEventListener("dragstart", function (event) {
        controls.camera.enabled = false;
        event.object.dragged = true;
        highlightObject(event.object.subject);
    });
    controls.drag.addEventListener("dragend", function (event) {
        controls.camera.enabled = true;
        event.object.dragged = false;
        unHighlightObject(event.object.subject);
    });
    

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
        const [ notCubeData, ..._] = values;
        const notCubeGeometry = notCubeData.geometry;
        const notCubeIdleAnimation = notCubeData.animation;
        const cube = createCube( [0, 0, 0], notCubeGeometry);
        
        const cube2 = createCube( [3, 0, 3], notCubeGeometry);
        const cube3 = createCube( [-3, 0, 3], notCubeGeometry);
        linkCubes(cube, cube2);
        linkCubes(cube, cube3);
        linkCubes(cube2, cube3);
        cube.subject.addAnimation("idle", notCubeIdleAnimation).play();
        cube2.subject.addAnimation("idle", notCubeIdleAnimation, 0.4).play();
        cube3.subject.addAnimation("idle", notCubeIdleAnimation, 0.71).play();

        // for fun :)
        renderer.domElement.addEventListener("contextmenu", function(event) {
            const shape = getHoveredShape(raycaster, mouse, camera, scene);
            if (shapes.parents.includes(shape)) {
                if (event.shiftKey) {
                    highlightObject(shape.subject);
                    renderer.domElement.addEventListener("click", function (event) {
                        const other = getHoveredShape(raycaster, mouse, camera, scene);
                        if (shapes.parents.includes(other)) {
                            console.log("interlinked");
                            linkCubes(shape, other);
                            
                        } else {
                            console.log("didnt link :(", other);
                        }
                        unHighlightObject(shape.subject);
                    }, { once: true });
                    console.log("looking to link");
                } else {
                    addNode(
                        [random(0, 15), 0, random(0, 15)],
                        notCubeGeometry,
                        notCubeIdleAnimation,
                        [shape]
                    );
                }
            }
            event.preventDefault();
        });

        // render the stuff
        function animate() {
            // ambient animation
            applyShapeIdleAnimation(clock.getDelta());
            
            // physics
            applyPhysicsForces(shapes.parents, shapeMinProximity, shapeMaxProximity, tetherForce);

            // update all connecting lines
            applyTetherUpdates();

            // required if controls.enableDamping or controls.autoRotate are set to true
            controls.camera.update(); // must be called after any manual changes to the camera"s transform
            renderer.render(scene, camera);
        }
        renderer.setAnimationLoop(animate);
    });
}

function addNode(position, geometry, defaultAnimation = undefined, neighbors = []) {
    const node = createCube(position, geometry);
    if (defaultAnimation) {
        node.subject.addAnimation("idle", defaultAnimation, random(0.4, 1.6)).play();
    }
    neighbors.forEach(neighbor => {
        linkCubes(node, neighbor);
    });
    return node;
}
function random(min, max) {
  return Math.random() * (max - min) + min;
}
function createCube(position, geometry) {
    const notCube = MESH.DragShape(geometry);
    notCube.position.set(...position);
    shapes.add(notCube); // make interactable
    scene.add(notCube);
    console.debug("Added Cube to scene:", notCube);
    return notCube;
}

function linkCubes(origin, target) {
    const tether = MESH.Tether(origin, target);
    tethers.push(tether); // tracking
    scene.add(tether);
    return tether;
}
function applyShapeIdleAnimation(delta) {
    // requestAnimationFrame(animate); // [!] google says I need this, but it runs fine without it and lags horribly...
    shapes.subjects.forEach(shape => {
        shape.updateAnimation(delta);
    });
}
function applyTetherUpdates() {
    tethers.forEach(tether => {
        if (
            tether.origin.subject.position != tether.vectors.origin ||
            tether.target.subject.position != tether.vectors.target
        ) {
            tether.update();
        }
    });
}
