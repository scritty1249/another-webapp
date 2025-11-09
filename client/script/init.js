import WebGL from "three/addons/capabilities/WebGL.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DragControls } from "three/addons/controls/DragControls.js";
import * as MESH from "./mesh.js";
import * as THREEUTILS from "./three-utils.js";
import { NodeManager, BuildNodeManager, AttackNodeManager } from "./nodes.js";
import { Mouse } from "./cursor.js";
import { OverlayManager, AttackOverlayManager, BuildOverlayManager } from "./overlay.js";
import { PhysicsManager } from "./physics.js";
import * as UTILS from "./utils.js";

const tetherForce = 0.2;
const passiveForce = 0.003; // used for elements gravitating towards y=0
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
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
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
        document.getElementById("overlay")
    );
    const PhysicsController = new PhysicsManager(NodeController,
        shapeMinProximity, shapeMaxProximity, tetherForce, tetherForce/2, passiveForce
    );
    const Manager = {
        Node: undefined,
        Overlay: undefined,
        Listener: undefined,
        set: function (managers) {
            ({Node: this.Node, Overlay: this.Overlay, Listener: this.Listener} = managers);
        }
    };
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
    
    OverlayController.element._overlay.addEventListener("swapphase", function (event) {
        const phaseType = event.detail.phase;
        try {
            if (phaseType == "build") {
                Manager.set(UTILS.initBuildPhase(
                    UTILS.layoutToJson(scene, NodeController, false),
                    scene,
                    renderer.domElement,
                    controls,
                    {
                        Node: NodeController,
                        Overlay: OverlayController,
                        Physics: PhysicsController,
                        Mouse: MouseController,
                        Listener: Manager.Listener
                    }
                ));
            } else if (phaseType == "attack") {
                Manager.set(UTILS.initAttackPhase(
                    UTILS.layoutToJson(scene, NodeController, false),
                    scene,
                    renderer.domElement,
                    controls,
                    {
                        Node: NodeController,
                        Overlay: OverlayController,
                        Physics: PhysicsController,
                        Mouse: MouseController,
                        Listener: Manager.Listener
                    }
                ));
            } else {
                Logger.error(`Unrecognized phase "${phaseType}"`);
            }
        } catch (err) {
            Logger.error(`Failed to swap phase to "${phaseType}"`);
            Logger.throw(err);
        }
    })

    const backgroundTextureCube = THREEUTILS.loadTextureCube("./source/bg/");
    scene.background = backgroundTextureCube; // new THREE.Color(0xff3065); // light red
    // // render a plane
    // const planeGeometry = new THREE.PlaneGeometry(20, 20); // A 20x20 unit plane
    // const planeMaterial = new THREE.MeshPhongMaterial({
    //     color: 0x000000,
    //     transparent: true, // Ensure this is enabled for opacity
    //     opacity: 0.8
    // }); // single-sided plane
    // const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    // scene.add(plane);
    // plane.receiveShadow = true;
    // plane.rotation.set(-Math.PI / 2, 0, 0); // Rotate to lie flat on the XZ plane
    // plane.position.set(0, 0, 0);

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
        Logger.info("Finished loading shape data:", values);        

        NodeController.addMeshData({
            cube: () => MESH.Nodes.Cube(cubeData),
            globe: () => MESH.Nodes.Globe(globeData),
            scanner: () => MESH.Nodes.Scanner(eyeData),
            tether: (o, t) => MESH.Tether(o, t)
        });
        
        let trackLowPerformace = false;
        document.getElementById("performance").textContent = "Low Performance mode: OFF";
        const FPSCounter = new Framerate(
            (fps) => {
                document.getElementById("framerate").textContent = `FPS: ${fps}`;
                if (
                    trackLowPerformace &&
                    !NodeController.lowPerformanceMode &&
                    FPSCounter.started &&
                    FPSCounter.fps < 30
                ) {
                    NodeController.lowPerformanceMode = true;
                    document.getElementById("performance").textContent = "Low Performance mode: ON";
                    Logger.warn(`FPS dropped below threshold to ${FPSCounter.avgFramerate}, low performance mode is ON.`);
                }
            }
        );

        Manager.set(UTILS.initBuildPhase(
            "eyJub2RlcyI6W3sidXVpZCI6IjAiLCJ0eXBlIjoiY3ViZSIsInBvc2l0aW9uIjpbMiwwLDRdLCJfZGF0YSI6e319LHsidXVpZCI6IjEiLCJ0eXBlIjoic2Nhbm5lciIsInBvc2l0aW9uIjpbOSwwLDVdLCJfZGF0YSI6e319LHsidXVpZCI6IjIiLCJ0eXBlIjoiZ2xvYmUiLCJwb3NpdGlvbiI6WzIsMCwtM10sIl9kYXRhIjp7fX0seyJ1dWlkIjoiMyIsInR5cGUiOiJnbG9iZSIsInBvc2l0aW9uIjpbLTMsMCwtMl0sIl9kYXRhIjp7fX0seyJ1dWlkIjoiNCIsInR5cGUiOiJnbG9iZSIsInBvc2l0aW9uIjpbMTIsMCwyXSwiX2RhdGEiOnt9fSx7InV1aWQiOiI1IiwidHlwZSI6Imdsb2JlIiwicG9zaXRpb24iOls4LDAsOV0sIl9kYXRhIjp7fX0seyJ1dWlkIjoiNiIsInR5cGUiOiJnbG9iZSIsInBvc2l0aW9uIjpbMiwwLDExXSwiX2RhdGEiOnt9fSx7InV1aWQiOiI3IiwidHlwZSI6Imdsb2JlIiwicG9zaXRpb24iOlstMywwLDNdLCJfZGF0YSI6e319LHsidXVpZCI6IjgiLCJ0eXBlIjoiY3ViZSIsInBvc2l0aW9uIjpbNSwwLDJdLCJfZGF0YSI6e319LHsidXVpZCI6IjkiLCJ0eXBlIjoiY3ViZSIsInBvc2l0aW9uIjpbNSwwLDddLCJfZGF0YSI6e319LHsidXVpZCI6IjEwIiwidHlwZSI6ImN1YmUiLCJwb3NpdGlvbiI6WzAsMCwxXSwiX2RhdGEiOnt9fSx7InV1aWQiOiIxMSIsInR5cGUiOiJzY2FubmVyIiwicG9zaXRpb24iOls2LDAsLTNdLCJfZGF0YSI6e319LHsidXVpZCI6IjEyIiwidHlwZSI6InNjYW5uZXIiLCJwb3NpdGlvbiI6WzgsMCwwXSwiX2RhdGEiOnt9fSx7InV1aWQiOiIxMyIsInR5cGUiOiJzY2FubmVyIiwicG9zaXRpb24iOlsxMiwwLDddLCJfZGF0YSI6e319XSwibmVpZ2hib3JzIjpbWzAsN10sWzgsMF0sWzExLDhdLFsxMSwyXSxbMTAsM10sWzgsMTBdLFs4LDEyXSxbOCw5XSxbMTIsMV0sWzEsMTNdLFs1LDEzXSxbOSw2XSxbMSw0XV0sImJhY2tncm91bmQiOiIifQ==",
            scene,
            renderer.domElement,
            controls,
            {
                Node: NodeController,
                Overlay: OverlayController,
                Physics: PhysicsController,
                Mouse: MouseController
            }
        ));

        // render the stuff
        function animate() {
            //requestIdleCallback(animate)

            PhysicsController.update();
            Manager.Node.update(UTILS.clamp(clock.getDelta(), 0, 1000));
            Manager.Overlay.update();

            // required if controls.enableDamping or controls.autoRotate are set to true
            controls.camera.update(); // must be called after any manual changes to the camera"s transform
            FPSCounter.update();
            renderer.render(scene, camera);
        }
        FPSCounter.reset();
        renderer.setAnimationLoop(animate);
        setTimeout(() => {
            trackLowPerformace = true;
        }, 2500); // time before we start checking if we need to turn on low performance mode
    });
}

function Framerate (
    framerateUpdateCallback,
    framerateInterval = 1000 // ms
) {
    const self = this;
    this._callback = framerateUpdateCallback;
    this._framesPerMs = framerateInterval;
    this._frame = 0;
    this._framerate = 0;
    this.prev = undefined;
    Object.defineProperty(self, "framerate", {
        get: function() {
            return self._framerate;
        },
        set: function(value) {
            self._framerate = value;
            self._callback(value);
        }
    });
    Object.defineProperty(self, "started", {
        get: function() {
            return self.prev != undefined && self._framerate > 0;
        }
    });
    this.reset = function () {
        self.prev = Date.now();
        self._frame = 0;
        self._framerate = 0;
    }
    this.update = function() {
        if (self.prev) {
            self._frame++;
            const curr = Date.now();
            if (curr > self.prev + self._framesPerMs) {
                self.framerate = Math.round( (self._frame * self._framesPerMs) / (curr - self.prev));
                self.prev = curr;
                self._frame = 0;
            }
        } else {
            self.reset();
        }
    }
    return this;
}
