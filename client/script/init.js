import WebGL from "three/addons/capabilities/WebGL.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DragControls } from "three/addons/controls/DragControls.js";
import { applyPhysicsForces } from "/script/physics.js";
import * as MESH from "/script/mesh.js";
import * as THREEUTILS from "/script/three-utils.js";
import * as LAYOUT from "/script/layout.js";
import * as DOMUTILS from "/script/dom-utils.js";

const shapes = {
    parents: [],
    subjects: [],
    add: function(shape) {
        this.parents.push(shape);
        this.subjects.push(shape.userData.subject);
    }
};
const mouseData = {
    left: {
        down: {
            ms: 0,
            position: new THREE.Vector3()
        },
        up: {
            ms: 0,
            position: new THREE.Vector3()
        }
    },
    right: {
        down: {
            ms: 0,
            position: new THREE.Vector3()
        },
        up: {
            ms: 0,
            position: new THREE.Vector3()
        }
    },
    scroll: {
        zoom: 0
    }
}
const overlayElements = [];
const tethers = [];
const tetherForce = 0.15;
const shapeMinProximity = 6;
const shapeMaxProximity = 4;
const mouseClickDurationThreshold = 0.5 * 1000; // ms

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
camera.position.z = 10;
camera.position.y = 5;
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
    mouseData.scroll.zoom = THREEUTILS.getZoom(camera);

    // start loading everything
    const gtlfData = Promise.all([
        THREEUTILS.loadGLTFShape("source/moving-not-cube.glb"),
        THREEUTILS.loadGLTFShape("source/empty-globe.glb")
    ]);

    // Setup external (yawn) library controls
    const controls = {
        drag: new DragControls(shapes.parents, camera, renderer.domElement), // drag n" drop
        camera: new OrbitControls(camera, renderer.domElement), // camera
    };
    controls.camera.enablePan = false;
    controls.camera.maxDistance = 25;
    controls.camera.enableDamping = true;
    controls.camera.dampingFactor = 0.12;
    controls.drag.transformGroup = true;
    controls.drag.rotateSpeed = 0;

    // release right click
    controls.drag.domElement.removeEventListener("contextmenu", controls.drag._onContextMenu);
    controls.camera.domElement.removeEventListener("contextmenu", controls.camera._onContextMenu);

    controls.camera.addEventListener("change", function (event) {
        const zoom = THREEUTILS.getZoom(camera);
        if (zoom != mouseData.scroll.zoom) {
            const scrollEvent = new CustomEvent("zoom", {
                bubbles: true,
                cancelable: true,
                detail: { distance: mouseData.scroll.zoom - zoom }
            });
            renderer.domElement.dispatchEvent(scrollEvent);
        }
        mouseData.scroll.zoom = zoom;
    });
    controls.drag.addEventListener("drag", function (event) {
        const positionData = THREEUTILS.getObjectScreenPosition(event.object, camera, renderer);
        const overlayEl = getObjectOverlay(event.object.uuid);
    });
    controls.drag.addEventListener("dragstart", function (event) {
        mouseData.left.down.position.copy(event.object.position);
        controls.camera.enabled = false;
        event.object.userData.dragged = true;
        THREEUTILS.highlightObject(event.object.userData.subject);
    });
    controls.drag.addEventListener("dragend", function (event) {
        mouseData.left.up.position.copy(event.object.position);
        controls.camera.enabled = true;
        event.object.userData.dragged = false;
        THREEUTILS.unHighlightObject(event.object.userData.subject);
    });
    renderer.domElement.addEventListener("mousedown", function(event) {
        if (event.button === 2)
            mouseData.right.down.ms = Date.now();
        else
            mouseData.left.down.ms = Date.now();
    });
    renderer.domElement.addEventListener("mouseup", function(event) {
        if (event.button === 2) { // right click = 2
            mouseData.right.up.ms = Date.now();
            if (mouseData.right.up.ms - mouseData.right.down.ms < mouseClickDurationThreshold) {
                const clickedEvent = new CustomEvent("rclicked", {
                    bubbles: true,
                    cancelable: true,
                    detail: {}
                });
                renderer.domElement.dispatchEvent(clickedEvent);
            }
        } else { // left click = 0
            mouseData.left.up.ms = Date.now();
            if (mouseData.left.up.ms - mouseData.left.down.ms < mouseClickDurationThreshold) {
                const clickedEvent = new CustomEvent("clicked", {
                    bubbles: true,
                    cancelable: true,
                    detail: {}
                });
                renderer.domElement.dispatchEvent(clickedEvent);
            }
        }
    });
    renderer.domElement.addEventListener("zoom", function(event) {

    });
    
    scene.background = new THREE.Color(0xff3065);
    // render a plane
    const planeGeometry = new THREE.PlaneGeometry(20, 20); // A 20x20 unit plane
    const planeMaterial = new THREE.MeshPhongMaterial({
        color: 0x000000,
        transparent: true, // Ensure this is enabled for opacity
        opacity: 0.8
    }); // single-sided plane
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

        // functions using geometry
        renderer.domElement.addEventListener("clicked", function(event) {
            const obj = THREEUTILS.getHoveredShape(raycaster, mouse, camera, shapes.parents);
            const noOverlay = (obj) ? getObjectOverlay(obj.uuid) == undefined : true;
            overlayElements.forEach(el => el.remove());
            overlayElements.splice(0, overlayElements.length);
            if (obj && noOverlay) {
                overlayOnObject(obj, camera, renderer);
            }
        });
        function overlayOnObject(object, camera, renderer) {
            const objPos = THREEUTILS.getObjectScreenPosition(object, camera, renderer);
            const el = DOMUTILS.OverlayElement.createNodeMenu();
            el.dataset.focusedObjectUuid = object.uuid;
            overlayElements.push(el);
            // make buttons work
            el.querySelector(`:scope > .button[data-button-type="link"]`)
                .addEventListener("click", function (event) {
                    nodeMenuActions.linkNode(el.dataset.focusedObjectUuid);
                });
            el.querySelector(`:scope > .button[data-button-type="add"]`)
                .addEventListener("click", function (event) {
                    nodeMenuActions.addNode(el.dataset.focusedObjectUuid, {geometry: notCubeGeometry, animation: notCubeIdleAnimation});
                });
            el.querySelector(`:scope > .button[data-button-type="info"]`)
                .addEventListener("click", function (event) {
                    // does nothing for now
                });
            DOMUTILS.overlayElementOnScene(objPos, document.getElementById("overlay"), el);
            
        }

        const cube = createCube( [0, 0, 0], notCubeGeometry);
        
        const cube2 = createCube( [3, 0, 3], notCubeGeometry);
        const cube3 = createCube( [-3, 0, 3], notCubeGeometry);
        tetherNodes(cube, cube2);
        tetherNodes(cube, cube3);
        tetherNodes(cube2, cube3);
        cube.userData.subject.userData.addAnimation("idle", notCubeIdleAnimation).play();
        cube2.userData.subject.userData.addAnimation("idle", notCubeIdleAnimation, 0.4).play();
        cube3.userData.subject.userData.addAnimation("idle", notCubeIdleAnimation, 0.71).play();

        const globe = createGlobe([6, 3, 5], globeData.geometry);

        // render the stuff
        function animate() {
            // ambient animation
            applyShapeIdleAnimation(clock.getDelta());
            
            // physics
            applyPhysicsForces(shapes.parents, shapeMinProximity, shapeMaxProximity, tetherForce);

            // update any onscreen overlays after physics applied
            updateObjectOverlays();

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
function getObjectOverlay(uuid) {
    return [undefined, ...overlayElements.filter(el => el.dataset.focusedObjectUuid == uuid)].at(-1);
}
function getObject(uuid) {
    return [undefined, ...shapes.parents.filter(shape => shape.uuid == uuid)].at(-1);
}
function updateObjectOverlays() {
    overlayElements.forEach(overlayEl => {
        const focusObj = getObject(overlayEl.dataset.focusedObjectUuid);
        const positionData = THREEUTILS.getObjectScreenPosition(focusObj, camera, renderer);
        DOMUTILS.updateOverlayElementOnScene(positionData, overlayEl);
    });
}
function removeOverlayFromObject(tag, focusedObjectUuid) {
    tag = tag.toLowerCase();
    const removeEls = overlayElements.filter(e => e.tagName.toLowerCase() == tag && e.dataset.focusedObjectUuid == focusedObjectUuid);
    for (let i = overlayElements.length - 1; i >= 0; i--) { // iterate backwards to avoid issues caused by reindexing
        if (removeEls.includes(overlayElements[i])) {
            overlayElements[i].remove();
            overlayElements.splice(i, 1);
        }
    }
}
function isObjectMoved(startPosition, endPosition, distanceThreshold) {
    if (distanceThreshold == 0)
        distanceThreshold = Number.EPSILON;
    return startPosition.distanceTo(endPosition) > distanceThreshold;
}
function addNode(position, geometry, defaultAnimation = undefined, neighbors = []) {
    const node = createCube(position, geometry);
    if (defaultAnimation) {
        node.userData.subject.userData.addAnimation("idle", defaultAnimation, random(0.4, 1.6)).play();
    }
    neighbors.forEach(neighbor => {
        tetherNodes(node, neighbor);
    });
    return node;
}
function random(min, max) {
  return Math.random() * (max - min) + min;
}
function createCube(position, geometry) {
    const notCube = MESH.DragShape(geometry, 0x000000);
    notCube.userData.type = "cube";
    notCube.position.set(...position);
    shapes.add(notCube); // make interactable
    scene.add(notCube);
    console.debug("Added Cube to scene:", notCube);
    return notCube;
}
function createGlobe(position, geometry) {
    const globe = MESH.DragShape(geometry, 0x880101);
    globe.userData.type = "globe";
    globe.position.set(...position);
    shapes.add(globe);
    scene.add(globe);
    console.debug("Added Globe to scene:", globe);
    return globe;
}
function tetherNodes(origin, target) {
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
const nodeMenuActions = {
    linkNode: function (uuid) { // function called by clicking the link button in the node menu
        const origin = getObject(uuid);
        THREEUTILS.highlightObject(origin.userData.subject);
        renderer.domElement.addEventListener("clicked", function (event) {
            const other = THREEUTILS.getHoveredShape(raycaster, mouse, camera, shapes.parents);
            if (shapes.parents.includes(other)) {
                console.log("interlinked");
                tetherNodes(origin, other);
                
            } else {
                console.log("didnt link :(", other);
            }
            THREEUTILS.unHighlightObject(origin.userData.subject);
        }, { once: true });
        console.log("looking to link");
    },
    addNode: function (uuid, newNodeData) { // may depreciate this in 1-2 commits in favor of creating new nodes without any connecitons, now that the overlay menu works.
        const origin = getObject(uuid);
        addNode(
            [
                origin.position.x + random(-shapeMaxProximity/1.5, shapeMaxProximity/1.5),
                origin.position.y + random(-shapeMaxProximity/1.5, shapeMaxProximity/1.5),
                origin.position.z + random(-shapeMaxProximity/1.5, shapeMaxProximity/1.5)
            ],
            newNodeData.geometry,
            newNodeData.animation,
            [origin]
        );
    }
};