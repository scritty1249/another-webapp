import WebGL from "three/addons/capabilities/WebGL.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DragControls } from "three/addons/controls/DragControls.js";
import { applyPhysicsForces } from "./physics.js";
import * as MESH from "./mesh.js";
import { loadGLTFShape, getHoveredShape, highlightObject, unHighlightObject, getObjectScreenPosition } from "./three-utils.js";
import * as LAYOUT from "./layout.js";
import { overlayElement } from "./dom-utils.js";

const shapes = {
    parents: [],
    subjects: [],
    add: function(shape) {
        this.parents.push(shape);
        this.subjects.push(shape.userData.subject);
    }
};
const tethers = [];
const tetherForce = 0.15;
const shapeMinProximity = 6;
const shapeMaxProximity = 4;

// Setup
// mouse functionality
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
// scene
const scene = new THREE.Scene();
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
    const gtlfData = Promise.all([
        loadGLTFShape("source/moving-not-cube.glb"),
        loadGLTFShape("source/empty-globe.glb")
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
        event.object.userData.dragged = true;
        highlightObject(event.object.userData.subject);
        const objPos = getObjectScreenPosition(event.object, camera, renderer);
        const el = document.createElement("img");
        el.src = "../source/circle.png";
        el.classList.add("button");
        el.dataset.focusedObjectUuid = event.object.uuid;
        overlayElement(objPos, document.getElementById("overlay"), el);
        setTimeout(() => {
            el.remove();
        }, 1500);
        console.log(el);
    });
    controls.drag.addEventListener("dragend", function (event) {
        controls.camera.enabled = true;
        event.object.userData.dragged = false;
        unHighlightObject(event.object.userData.subject);
    });
    
    scene.background = new THREE.Color(0xff3065);
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

    

    gtlfData.then(values => {
        const [ notCubeData, globeData, ..._] = values;
        const notCubeGeometry = notCubeData.geometry;
        const notCubeIdleAnimation = notCubeData.animation;
        const cube = createCube( [0, 0, 0], notCubeGeometry);
        
        const cube2 = createCube( [3, 0, 3], notCubeGeometry);
        const cube3 = createCube( [-3, 0, 3], notCubeGeometry);
        linkNodes(cube, cube2);
        linkNodes(cube, cube3);
        linkNodes(cube2, cube3);
        cube.userData.subject.userData.addAnimation("idle", notCubeIdleAnimation).play();
        cube2.userData.subject.userData.addAnimation("idle", notCubeIdleAnimation, 0.4).play();
        cube3.userData.subject.userData.addAnimation("idle", notCubeIdleAnimation, 0.71).play();

        const globe = createGlobe([3, 0, 5], globeData.geometry);

        // for fun :)
        renderer.domElement.addEventListener("contextmenu", function(event) {
            const shape = getHoveredShape(raycaster, mouse, camera, scene);
            if (shapes.parents.includes(shape)) {
                if (event.shiftKey) {
                    highlightObject(shape.userData.subject);
                    renderer.domElement.addEventListener("click", function (event) {
                        const other = getHoveredShape(raycaster, mouse, camera, scene);
                        if (shapes.parents.includes(other)) {
                            console.log("interlinked");
                            linkNodes(shape, other);
                            
                        } else {
                            console.log("didnt link :(", other);
                        }
                        unHighlightObject(shape.userData.subject);
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
        console.log("Exported layout:", LAYOUT.layoutToJson(shapes.parents));
        renderer.setAnimationLoop(animate);
    });
}

function addNode(position, geometry, defaultAnimation = undefined, neighbors = []) {
    const node = createCube(position, geometry);
    if (defaultAnimation) {
        node.userData.subject.userData.addAnimation("idle", defaultAnimation, random(0.4, 1.6)).play();
    }
    neighbors.forEach(neighbor => {
        linkNodes(node, neighbor);
    });
    return node;
}
function random(min, max) {
  return Math.random() * (max - min) + min;
}
function createCube(position, geometry) {
    const notCube = MESH.DragShape(geometry);
    notCube.userData.type = "cube";
    notCube.position.set(...position);
    shapes.add(notCube); // make interactable
    scene.add(notCube);
    console.debug("Added Cube to scene:", notCube);
    return notCube;
}
function createGlobe(position, geometry) {
    const globe = MESH.DragShape(geometry);
    globe.userData.type = "globe";
    globe.position.set(...position);
    shapes.add(globe);
    scene.add(globe);
    console.debug("Added Globe to scene:", globe);
    return globe;
}
function linkNodes(origin, target) {
    const tether = MESH.Tether(origin, target);
    tethers.push(tether); // tracking
    scene.add(tether);
    return tether;
}
function applyShapeIdleAnimation(delta) {
    // requestAnimationFrame(animate); // [!] google says I need this, but it runs fine without it and lags horribly...
    shapes.subjects.forEach(shape => {
        shape.userData.updateAnimation(delta);
    });
}
function applyTetherUpdates() {
    tethers.forEach(tether => {
        if (
            tether.userData.origin.userData.subject.position != tether.userData.vectors.origin ||
            tether.userData.target.userData.subject.position != tether.userData.vectors.target
        ) {
            tether.userData.update();
        }
    });
}
