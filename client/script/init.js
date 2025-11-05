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
    
    const _bgCubePath = "./source/bg/";
    const _bgCubeFormat = ".png";
    const backgroundTextureCube = new THREE.CubeTextureLoader().load([
        _bgCubePath + 'px' + _bgCubeFormat, _bgCubePath + 'nx' + _bgCubeFormat,
        _bgCubePath + 'py' + _bgCubeFormat, _bgCubePath + 'ny' + _bgCubeFormat,
        _bgCubePath + 'pz' + _bgCubeFormat, _bgCubePath + 'nz' + _bgCubeFormat
    ]);
    backgroundTextureCube.generateMipmaps = false
    scene.background = backgroundTextureCube; // new THREE.Color(0xff3065); // light red
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
        // [!] testing
        const urlParams = new URLSearchParams(window.location.search);
        let r = urlParams.has("layout");
        if (r)
            r = UTILS.layoutFromJson(decodeURIComponent(urlParams.get("layout")), scene, NodeController);
        if (!r)
            NodeController.createNode("cube", [], [0, 0, 1]);
        NodeController.createNode("scanner", [], [1, 0, 1]);
        NodeController.createNode("globe", [], [0, 1, 1]);
        renderer.setAnimationLoop(animate);
    });
}
