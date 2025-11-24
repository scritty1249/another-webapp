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
import { MenuManager } from "./menu.js";
import * as UTIL from "./utils.js";
import * as ATTACKERDATA from "./attacker.js"; // [!] testing, temporary module- to be redesigned soon
import * as Session from "./session.js";

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
    const MenuController = new MenuManager(document.getElementById("overlay"));
    MenuController.loginScreen();
    MenuController.when("login", _ => {
        mainloop(MenuController);
    })
} else {
    const warning = WebGL.getWebGL2ErrorMessage();
    document.getElementById("container").appendChild(warning);
}

function mainloop(MenuController) {
    const MouseController = new Mouse(window, renderer.domElement, mouseClickDurationThreshold);
    const NodeController = new NodeManager(scene, renderer, camera, raycaster);
    const OverlayController = new OverlayManager(scene, renderer, camera, raycaster,
        document.getElementById("overlay"), MenuController
    );
    const PhysicsController = new PhysicsManager(NodeController,
        shapeMinProximity, shapeMaxProximity, tetherForce, tetherForce/2, passiveForce
    );
    const Manager = {
        phase: undefined,
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
                document.getElementById("performance").textContent = `Low Performance mode: ${NodeController.lowPerformanceMode ? "ON" : "OFF"}`;
                if (
                    trackLowPerformace &&
                    !NodeController.lowPerformanceMode &&
                    FPSCounter.started &&
                    FPSCounter.fps < 30
                ) {
                    NodeController.lowPerformanceMode = true;
                    Logger.warn(`FPS dropped below threshold to ${FPSCounter.avgFramerate}, low performance mode is ON.`);
                }
            }
        );
        Session.login("hello", "world")
            .then(res => Logger.info(res))
            .then(_ => Session.getsave())
            .then(res => {
                { // persistent listeners
                    MenuController.when("swapphase", function (detail) {
                        MenuController.close();
                        const phaseType = detail.phase;
                        try {
                            if (phaseType == "build") {
                                Manager.set(UTIL.initBuildPhase(
                                    UTIL.layoutToJson(scene, NodeController, false),
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
                                Manager.phase = "build";
                            } else if (phaseType == "attack") {
                                Manager.set(UTIL.initAttackPhase(
                                    {
                                        layout: UTIL.layoutToJson(scene, NodeController, false),
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
                                Manager.phase = "attack";
                            } else {
                                Logger.error(`Unrecognized phase "${phaseType}"`);
                            }
                        } catch (err) {
                            Logger.error(`Failed to swap phase to "${phaseType}"`);
                            Logger.throw(err);
                        }
                    }, true);
                    MenuController.when("lowperformance", function (detail) {
                        const toggleTo = detail.set;
                        NodeController.lowPerformanceMode = toggleTo;
                        MenuController.close();
                    }, true);
                    MenuController.when("_loadlayout", function (_) {
                        if (Manager.phase == "build")
                            UTIL.getClipboardText().then(text => {
                                const layoutBackup = UTIL.layoutToJson(scene, Manager.Node, false);
                                const result = text?.trim()?.length > 0 ? UTIL.layoutFromJson(text.trim(), scene, controls.drag, Manager.Node) : false;
                                if (!result) {
                                    Manager.Node.clear();
                                    UTIL.layoutFromJson(layoutBackup, scene, controls.drag, Manager.Node);
                                    Logger.alert("Failed to load layout- backup restored. Was the wrong format entered?");
                                } else {
                                    MenuController.close();
                                }
                            });
                        else
                            Logger.alert("Cannot load layout outside of build phase!");
                    }, true);
                    MenuController.when("_savelayout", function (_) {
                        if (Manager.phase == "build") {
                            const data = UTIL.layoutToJson(scene, NodeController, true);
                            navigator.clipboard.writeText(data);
                            MenuController.close();
                            Logger.alert("Layout copied to clipboard.");
                        } else
                            Logger.alert("Cannot save layout outside of build phase!");
                    }, true);
                    MenuController.when("_savelog", function (_) {
                        UTIL._DebugTool.exportLogger(scene, NodeController, Logger);
                    }, true);
                    MenuController.when("save", function (_) {
                        Session.savegame(UTIL.layoutToJsonObj(scene, Manager.Node))
                            .then(res => Logger.log(res));
                    }, true);
                }
                // { // [!] testing only
                //     const queryString = window.location.search;
                //     const urlParams = new URLSearchParams(queryString);
                //     if (urlParams.has("preset"))
                //         _defaultLayout = "eyJsYXlvdXQiOnsibm9kZXMiOlt7InV1aWQiOiIwIiwidHlwZSI6InBsYWNlaG9sZGVyIiwicG9zaXRpb24iOlstMiwyLDJdLCJfZGF0YSI6e319LHsidXVpZCI6IjEiLCJ0eXBlIjoiY3ViZSIsInBvc2l0aW9uIjpbLTQsLTEsNF0sIl9kYXRhIjp7fX0seyJ1dWlkIjoiMiIsInR5cGUiOiJzY2FubmVyIiwicG9zaXRpb24iOlsyLC0xLDJdLCJfZGF0YSI6e319LHsidXVpZCI6IjMiLCJ0eXBlIjoiZ2xvYmUiLCJwb3NpdGlvbiI6Wy05LDAsLTRdLCJfZGF0YSI6e319LHsidXVpZCI6IjQiLCJ0eXBlIjoicGxhY2Vob2xkZXIiLCJwb3NpdGlvbiI6Wy02LDAsLTFdLCJfZGF0YSI6e319LHsidXVpZCI6IjUiLCJ0eXBlIjoicGxhY2Vob2xkZXIiLCJwb3NpdGlvbiI6Wy0yLDAsLTJdLCJfZGF0YSI6e319LHsidXVpZCI6IjYiLCJ0eXBlIjoicGxhY2Vob2xkZXIiLCJwb3NpdGlvbiI6WzAsMCw2XSwiX2RhdGEiOnt9fSx7InV1aWQiOiI3IiwidHlwZSI6InBsYWNlaG9sZGVyIiwicG9zaXRpb24iOlstNSwwLDldLCJfZGF0YSI6e319LHsidXVpZCI6IjgiLCJ0eXBlIjoicGxhY2Vob2xkZXIiLCJwb3NpdGlvbiI6Wy00LDAsMTNdLCJfZGF0YSI6e319LHsidXVpZCI6IjkiLCJ0eXBlIjoicGxhY2Vob2xkZXIiLCJwb3NpdGlvbiI6Wy01LDAsLTVdLCJfZGF0YSI6e319LHsidXVpZCI6IjEwIiwidHlwZSI6Imdsb2JlIiwicG9zaXRpb24iOlstNSwwLC05XSwiX2RhdGEiOnt9fSx7InV1aWQiOiIxMSIsInR5cGUiOiJwbGFjZWhvbGRlciIsInBvc2l0aW9uIjpbMCwwLC02XSwiX2RhdGEiOnt9fSx7InV1aWQiOiIxMiIsInR5cGUiOiJwbGFjZWhvbGRlciIsInBvc2l0aW9uIjpbNCwwLC0xMF0sIl9kYXRhIjp7fX0seyJ1dWlkIjoiMTMiLCJ0eXBlIjoiZ2xvYmUiLCJwb3NpdGlvbiI6WzEsMCwtMTNdLCJfZGF0YSI6e319LHsidXVpZCI6IjE0IiwidHlwZSI6Imdsb2JlIiwicG9zaXRpb24iOlsxMCwwLC0zXSwiX2RhdGEiOnt9fSx7InV1aWQiOiIxNSIsInR5cGUiOiJjdWJlIiwicG9zaXRpb24iOls0LDAsNl0sIl9kYXRhIjp7fX0seyJ1dWlkIjoiMTYiLCJ0eXBlIjoicGxhY2Vob2xkZXIiLCJwb3NpdGlvbiI6WzgsMCw0XSwiX2RhdGEiOnt9fSx7InV1aWQiOiIxNyIsInR5cGUiOiJwbGFjZWhvbGRlciIsInBvc2l0aW9uIjpbOSwwLDBdLCJfZGF0YSI6e319XSwibmVpZ2hib3JzIjpbWzQsMF0sWzUsMF0sWzYsMF0sWzUsMV0sWzYsMV0sWzAsMV0sWzcsNl0sWzgsN10sWzUsMl0sWzYsMl0sWzksNF0sWzksM10sWzExLDldLFsxMiwxMV0sWzExLDEwXSxbMTIsMTNdLFsxNiwxNV0sWzIsMTVdLFsxNywxNl0sWzE0LDE3XSxbMiwwXSxbMiwxXV19LCJiYWNrZ3JvdW5kIjoiIn0=";
                // }
                Manager.set(UTIL.initBuildPhase(
                    !res || res === {} ? UTIL.BLANK_LAYOUT : JSON.stringify(res),
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
                Manager.phase = "build";
                MenuController.close();
                // render the stuff
                function animate() {
                    //requestIdleCallback(animate)

                    PhysicsController.update();
                    Manager.Node.update(UTIL.clamp(clock.getDelta(), 0, 1000));
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
