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
const maxStepsFromGlobe = 9; // max number of steps from a Globe each node is allowed to be

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
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const MenuController = new MenuManager(document.getElementById("overlay"));
    if (!CookieJar.has("session") || urlParams.has("debug")) {
        MenuController.loginScreen();
        MenuController.when("login", ({username, password, elements}) => {
            elements.forEach(el => el.classList.remove("pointer-events"));
            UTIL.unfocusDom();
            Session.login(username, password)
                .then(res => {
                    if (res)
                        mainloop(MenuController);
                    else
                        elements.forEach(el => el.classList.add("pointer-events"));
                });
        });
        MenuController.when("newlogin", ({username, password, elements}) => {
            elements.forEach(el => el.classList.remove("pointer-events"));
            UTIL.unfocusDom();
            Session.newlogin(username, password, UTIL.BLANK_LAYOUT_OBJ, {cash: 0, crypto: 0})
                .then(res => {
                    if (res)
                        mainloop(MenuController);
                    else
                        elements.forEach(el => el.classList.add("pointer-events"));
                });
        });
    } else { // auto login
        mainloop(MenuController);
    }
} else {
    const warning = WebGL.getWebGL2ErrorMessage();
    document.getElementById("container").appendChild(warning);
}

function mainloop(MenuController) {
    MenuController.open(["loading"]);
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
        Session.getsave()
            .then(res => {
                { // persistent listeners
                    MenuController.when("swapphase", function (detail) {
                        MenuController.close();
                        const phaseType = detail.phase;
                        try {
                            const layout = UTIL.layoutToJsonObj(scene, NodeController, false);
                            if (phaseType == "build") {
                                Manager.set(UTIL.initBuildPhase(
                                    layout,
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
                                        layout: layout,
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
                    MenuController.when("logout", function (_) {
                        CookieJar.remove("session");
                        window.location.reload();
                    }, true);
                    MenuController.when("_savelog", function (_) {
                        UTIL._DebugTool.exportLogger(scene, NodeController, Logger);
                        MenuController.close();
                    }, true);
                    MenuController.when("save", function (_) {
                        MenuController.close();
                        if (Manager.Node.validateLayout(maxStepsFromGlobe))
                            Session.savegame(UTIL.layoutToJsonObj(scene, Manager.Node))
                                .then(res => Logger.alert(res ? "Saved successfully" : "Failed to save"));
                        else
                            Logger.alert(`Cannot save layout: All nodes must be connected and within ${maxStepsFromGlobe} steps of a Globe!`);
                    }, true);
                }
                Manager.set(UTIL.initBuildPhase(
                    !res || res === {} ? UTIL.BLANK_LAYOUT_OBJ : res,
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
