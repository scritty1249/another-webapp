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
import * as ATTACKERDATA from "./attacker.js"; // [!] testing, temporary module- to be redesigned soon

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
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", alpha: true });
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
        THREEUTILS.loadGLTFShape("./source/placeholder-cube.glb"),
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
                    {
                        layout: UTILS.layoutToJson(scene, NodeController, false),
                        nodeTypes: ATTACKERDATA.NodeTypeData,
                        attackTypes: ATTACKERDATA.AttackTypeData,
                        attacks: ATTACKERDATA.AttackerData
                    },
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

    gtlfData.then(data => {
        const [ placeholderData, cubeData, globeData, eyeData, ..._] = data;
        Logger.info("Finished loading shape data:", data);        

        NodeController.addMeshData({
            placeholder: () => MESH.Nodes.Placeholder(placeholderData),
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

        let _defaultLayout = "eyJub2RlcyI6W3sidXVpZCI6IjAiLCJ0eXBlIjoicGxhY2Vob2xkZXIiLCJwb3NpdGlvbiI6WzMsMCwzXSwiX2RhdGEiOnt9fSx7InV1aWQiOiIxIiwidHlwZSI6ImN1YmUiLCJwb3NpdGlvbiI6Wy0zLDAsM10sIl9kYXRhIjp7fX0seyJ1dWlkIjoiMiIsInR5cGUiOiJzY2FubmVyIiwicG9zaXRpb24iOlszLDAsLTNdLCJfZGF0YSI6e319LHsidXVpZCI6IjMiLCJ0eXBlIjoiZ2xvYmUiLCJwb3NpdGlvbiI6Wy0zLDAsLTNdLCJfZGF0YSI6e319XSwibmVpZ2hib3JzIjpbXSwiYmFja2dyb3VuZCI6IiJ9";

        { // [!] testing only
            const queryString = window.location.search;
            const urlParams = new URLSearchParams(queryString);
            if (urlParams.has("preset"))
                _defaultLayout = "eyJub2RlcyI6W3sidXVpZCI6IjAiLCJ0eXBlIjoicGxhY2Vob2xkZXIiLCJwb3NpdGlvbiI6Wy0yLDIsMl0sIl9kYXRhIjp7fX0seyJ1dWlkIjoiMSIsInR5cGUiOiJjdWJlIiwicG9zaXRpb24iOlstNCwtMSw0XSwiX2RhdGEiOnt9fSx7InV1aWQiOiIyIiwidHlwZSI6InNjYW5uZXIiLCJwb3NpdGlvbiI6WzIsLTEsMl0sIl9kYXRhIjp7fX0seyJ1dWlkIjoiMyIsInR5cGUiOiJnbG9iZSIsInBvc2l0aW9uIjpbLTksMCwtNF0sIl9kYXRhIjp7fX0seyJ1dWlkIjoiNCIsInR5cGUiOiJwbGFjZWhvbGRlciIsInBvc2l0aW9uIjpbLTYsMCwtMV0sIl9kYXRhIjp7fX0seyJ1dWlkIjoiNSIsInR5cGUiOiJwbGFjZWhvbGRlciIsInBvc2l0aW9uIjpbLTIsMCwtMl0sIl9kYXRhIjp7fX0seyJ1dWlkIjoiNiIsInR5cGUiOiJwbGFjZWhvbGRlciIsInBvc2l0aW9uIjpbMCwwLDZdLCJfZGF0YSI6e319LHsidXVpZCI6IjciLCJ0eXBlIjoicGxhY2Vob2xkZXIiLCJwb3NpdGlvbiI6Wy01LDAsOV0sIl9kYXRhIjp7fX0seyJ1dWlkIjoiOCIsInR5cGUiOiJwbGFjZWhvbGRlciIsInBvc2l0aW9uIjpbLTQsMCwxM10sIl9kYXRhIjp7fX0seyJ1dWlkIjoiOSIsInR5cGUiOiJwbGFjZWhvbGRlciIsInBvc2l0aW9uIjpbLTUsMCwtNV0sIl9kYXRhIjp7fX0seyJ1dWlkIjoiMTAiLCJ0eXBlIjoiZ2xvYmUiLCJwb3NpdGlvbiI6Wy01LDAsLTldLCJfZGF0YSI6e319LHsidXVpZCI6IjExIiwidHlwZSI6InBsYWNlaG9sZGVyIiwicG9zaXRpb24iOlswLDAsLTZdLCJfZGF0YSI6e319LHsidXVpZCI6IjEyIiwidHlwZSI6InBsYWNlaG9sZGVyIiwicG9zaXRpb24iOls0LDAsLTEwXSwiX2RhdGEiOnt9fSx7InV1aWQiOiIxMyIsInR5cGUiOiJnbG9iZSIsInBvc2l0aW9uIjpbMSwwLC0xM10sIl9kYXRhIjp7fX0seyJ1dWlkIjoiMTQiLCJ0eXBlIjoiZ2xvYmUiLCJwb3NpdGlvbiI6WzEwLDAsLTNdLCJfZGF0YSI6e319LHsidXVpZCI6IjE1IiwidHlwZSI6ImN1YmUiLCJwb3NpdGlvbiI6WzQsMCw2XSwiX2RhdGEiOnt9fSx7InV1aWQiOiIxNiIsInR5cGUiOiJwbGFjZWhvbGRlciIsInBvc2l0aW9uIjpbOCwwLDRdLCJfZGF0YSI6e319LHsidXVpZCI6IjE3IiwidHlwZSI6InBsYWNlaG9sZGVyIiwicG9zaXRpb24iOls5LDAsMF0sIl9kYXRhIjp7fX1dLCJuZWlnaGJvcnMiOltbNCwwXSxbNSwwXSxbNiwwXSxbNSwxXSxbNiwxXSxbMCwxXSxbNyw2XSxbOCw3XSxbNSwyXSxbNiwyXSxbOSw0XSxbOSwzXSxbMTEsOV0sWzEyLDExXSxbMTEsMTBdLFsxMiwxM10sWzE2LDE1XSxbMiwxNV0sWzE3LDE2XSxbMTQsMTddLFsyLDBdLFsyLDFdXSwiYmFja2dyb3VuZCI6IiJ9";
        }
        
        Manager.set(UTILS.initBuildPhase(
            _defaultLayout,
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
