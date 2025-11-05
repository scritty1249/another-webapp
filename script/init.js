import WebGL from "three/addons/capabilities/WebGL.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DragControls } from "three/addons/controls/DragControls.js";
import * as MESH from "./mesh.js";
import * as THREEUTILS from "./three-utils.js";
import { NodeManager } from "./nodes.js";
import { Mouse } from "./cursor.js";
import { OverlayManager } from "./overlay.js";
import { PhysicsManager } from "./physics.js";
import * as UTILS from "./utils.js";

const tetherForce = 0.2;
const shapeMinProximity = 5.5;
const shapeMaxProximity = 4;
const mouseClickDurationThreshold = 0.4 * 1000; // ms

// Setup
// MouseController functionality
const raycaster = new THREE.Raycaster();
// scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    80
);
camera.position.z = 10;
camera.position.y = 5;
// rendererererer
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.LinearToneMapping;

if (WebGL.isWebGL2Available()) {
    // Initiate function or other initializations here
    mainloop();
} else {
    const warning = WebGL.getWebGL2ErrorMessage();
    document.getElementById("container").appendChild(warning);
}

function mainloop() {
    const MouseController = new Mouse(window, renderer.domElement, mouseClickDurationThreshold);
    const NodeController = new NodeManager(scene, renderer, camera, raycaster);
    const OverlayController = new OverlayManager(scene, renderer, camera, raycaster,
        MouseController, NodeController, document.getElementById("overlay"));
    const PhysicsController = new PhysicsManager(NodeController, shapeMinProximity, shapeMaxProximity, tetherForce);
    const clock = new THREE.Clock();
    document.getElementById("container").appendChild(renderer.domElement);

    // start loading everything
    const gtlfData = Promise.all([
        THREEUTILS.loadGLTFShape("./source/not-cube.glb"),
        THREEUTILS.loadGLTFShape("./source/globe.glb"),
        THREEUTILS.loadGLTFShape("./source/scanner.glb")
    ]);

    // Setup external (yawn) library controls
    const controls = {
        drag: new DragControls(NodeController.nodelist, camera, renderer.domElement), // drag n" drop
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
    });
    controls.drag.addEventListener("drag", function (event) {
        
    });
    controls.drag.addEventListener("dragstart", function (event) {
        controls.camera.enabled = false;
        event.object.userData.dragged = true;
        NodeController.highlightNode(event.object.uuid);
    });
    controls.drag.addEventListener("dragend", function (event) {
        controls.camera.enabled = true;
        event.object.userData.dragged = false;
        NodeController.unhighlightNode(event.object.uuid);
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
        const [ cubeData, globeData, eyeData, ..._] = values;
        console.log("Finished loading shape data:", values);

        // functions using geometry
        renderer.domElement.addEventListener("clicked", function(event) {
            const clickedNodeId = NodeController.getNodeFromFlatCoordinate(MouseController.position);
            if (clickedNodeId && OverlayController.focusedNodeId != clickedNodeId)
                OverlayController.focusNode(clickedNodeId);
            else
                OverlayController.unfocusNode();
        });

        NodeController.addMeshData({
            cube: () => MESH.Nodes.Cube(cubeData),
            globe: () => MESH.Nodes.Globe(globeData),
            scanner: () => MESH.Nodes.Scanner(eyeData),
            tether: (o, t) => MESH.Tether(o, t)
        });
        

        // render the stuff
        function animate() {
            // physics
            PhysicsController.update();

            NodeController.update(clock.getDelta());

            OverlayController.update();

            // required if controls.enableDamping or controls.autoRotate are set to true
            controls.camera.update(); // must be called after any manual changes to the camera"s transform
            renderer.render(scene, camera);
        }
        //NodeController.createNode("cube");
        //console.log("Exported layout:", UTILS.layoutToJson(scene, NodeController));

        UTILS.layoutFromJson(
            `{"nodes":[{"uuid":"4ce326f1-12e7-4766-a8e3-112399c9c489","type":"cube","position":{"x":1,"y":7,"z":0},"_data":{}},{"uuid":"7345e2f0-0498-4aaf-b603-e2c49fa2683b","type":"cube","position":{"x":4,"y":2,"z":0},"_data":{}},{"uuid":"b2460459-4fb2-429d-a6d5-de57539063e3","type":"cube","position":{"x":-2,"y":6,"z":3},"_data":{}},{"uuid":"93897380-c62e-42ac-aa35-13b987d74ad1","type":"cube","position":{"x":-3,"y":5,"z":-4},"_data":{}},{"uuid":"8d3aa3c5-0fdb-4012-981d-461bb21a5350","type":"cube","position":{"x":-3,"y":8,"z":-1},"_data":{}},{"uuid":"862bd996-c371-4bd4-a9f7-12d761741b33","type":"cube","position":{"x":6,"y":7,"z":2},"_data":{}},{"uuid":"2b7b1750-8b32-4989-ba52-04c426636ade","type":"cube","position":{"x":5,"y":4,"z":3},"_data":{}},{"uuid":"0ebd2b3f-2ee0-4c81-90ef-83166fb4e2a0","type":"cube","position":{"x":0,"y":2,"z":2},"_data":{}},{"uuid":"07a114fc-8286-4d25-9b9d-8414bb40cb6f","type":"cube","position":{"x":5,"y":5,"z":-2},"_data":{}},{"uuid":"4f788be6-4325-4a6a-91cf-fe44f6aa1355","type":"cube","position":{"x":1,"y":6,"z":-4},"_data":{}},{"uuid":"cb7e6ce1-4110-4272-99a5-b61ef8543810","type":"cube","position":{"x":-3,"y":4,"z":0},"_data":{}},{"uuid":"23b8d739-e1b3-46f5-a55f-215e9fd9f864","type":"cube","position":{"x":0,"y":2,"z":-2},"_data":{}},{"uuid":"02900a01-c5ab-4553-8e68-75751262172f","type":"cube","position":{"x":1,"y":5,"z":5},"_data":{}}],"neighbors":[["7345e2f0-0498-4aaf-b603-e2c49fa2683b","4ce326f1-12e7-4766-a8e3-112399c9c489"],["b2460459-4fb2-429d-a6d5-de57539063e3","4ce326f1-12e7-4766-a8e3-112399c9c489"],["93897380-c62e-42ac-aa35-13b987d74ad1","4ce326f1-12e7-4766-a8e3-112399c9c489"],["8d3aa3c5-0fdb-4012-981d-461bb21a5350","4ce326f1-12e7-4766-a8e3-112399c9c489"],["862bd996-c371-4bd4-a9f7-12d761741b33","4ce326f1-12e7-4766-a8e3-112399c9c489"],["2b7b1750-8b32-4989-ba52-04c426636ade","4ce326f1-12e7-4766-a8e3-112399c9c489"],["0ebd2b3f-2ee0-4c81-90ef-83166fb4e2a0","4ce326f1-12e7-4766-a8e3-112399c9c489"],["07a114fc-8286-4d25-9b9d-8414bb40cb6f","4ce326f1-12e7-4766-a8e3-112399c9c489"],["4f788be6-4325-4a6a-91cf-fe44f6aa1355","4ce326f1-12e7-4766-a8e3-112399c9c489"],["cb7e6ce1-4110-4272-99a5-b61ef8543810","4ce326f1-12e7-4766-a8e3-112399c9c489"],["23b8d739-e1b3-46f5-a55f-215e9fd9f864","4ce326f1-12e7-4766-a8e3-112399c9c489"],["02900a01-c5ab-4553-8e68-75751262172f","4ce326f1-12e7-4766-a8e3-112399c9c489"]],"background":16724069}`,
            scene,
            NodeController
        );
        renderer.setAnimationLoop(animate);
    });
}
