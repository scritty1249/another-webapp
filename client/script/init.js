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
import { PhaseManager } from "./phases.js";
import * as UTIL from "./utils.js";
import * as ATTACK from "./attacker.js"; // [!] testing, temporary module- to be redesigned soon
import * as Session from "./session.js";
import { WorldManager } from "./world.js";
import { SelectiveOutlineEffect } from "./renderer.js";
import { Vector3 } from "../lib/three-js/three.core.js"

const tetherForce = 0.2;
const passiveForce = 0.003; // used for elements gravitating towards y=0
const shapeMinProximity = 5.5;
const shapeMaxProximity = 4;
const mouseClickDurationThreshold = 0.4 * 1000; // ms
const maxStepsFromGlobe = 9; // max number of steps from a Globe each node is allowed to be
const TICKSPEED = 0.1; // seconds
const TARGETS_TTL = 300; // seconds, how long we should store targets for before querying again - 5 minutes
const WORLD_TARGET_COUNT = 5;
const DEFAULT_CAM_POS = new THREE.Vector3(0, 5, 10);
const AUTOSAVE_INTERVAL = 150000; // ms, interval for autosaves. Shouldn't overlap with saving when leaving the page

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
camera.position.copy(DEFAULT_CAM_POS);
// rendererererer
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.LinearToneMapping;

// outline effect for select phase
const effect = new SelectiveOutlineEffect(renderer);

// url params
const urlParams = new URLSearchParams(window.location.search);
const DEBUG_MODE = urlParams.has("debug");

if (WebGL.isWebGL2Available()) {
    // Initiate function or other initializations here
    const MenuController = new MenuManager(document.getElementById("overlay"));
    // Login
    if ((!CookieJar.has("session") || !CookieJar.get("session")) || (DEBUG_MODE && urlParams.has("login"))) {
        MenuController.loginScreen();
        MenuController.when("login", ({username, password, elements}) => {
            elements.forEach(el => el.classList.remove("pointer-events"));
            MenuController.when("loadmenu", detail => {
                const statusEl = detail.statusElement;
                statusEl.text = "Logging in...";
                Session.login(username, password)
                    .then(res => {
                        if (res)
                            mainloop(MenuController);
                        else {
                            elements.forEach(el => el.classList.add("pointer-events"));
                            MenuController.loginScreen();
                        }
                    });
            }, false, true);
            MenuController.open(["loading"]);
        });
        MenuController.when("newlogin", ({username, password, elements}) => {
            elements.forEach(el => el.classList.remove("pointer-events"));
            MenuController.when("loadmenu", detail => {
                const statusEl = detail.statusElement;
                statusEl.text = "Contacting server";
                Session.newlogin(username, password, UTIL.BLANK_LAYOUT_OBJ, {cash: 0, crypto: 0})
                    .then(res => {
                        if (res)
                            mainloop(MenuController);
                        else {
                            elements.forEach(el => el.classList.add("pointer-events"));
                            MenuController.loginScreen();
                        }
                    });
            }, false, true);
            MenuController.open(["loading"]);
            
        });
    } else { // remembered login
        mainloop(MenuController);
    }
} else {
    const warning = WebGL.getWebGL2ErrorMessage();
    document.getElementById("container").appendChild(warning);
}

function mainloop(MenuController) {
    MenuController.when("loadmenu", d => {
        const statusEl = d.statusElement;
        statusEl.text = "Loading scene";

        // Clear any session storage
        Storage.remove("localLayout");
        Storage.remove("targets");

        // Loading sequence
        const MouseController = new Mouse(window, renderer.domElement, mouseClickDurationThreshold);
        const NodeController = new NodeManager(scene, renderer, camera, raycaster);
        const OverlayController = new OverlayManager(scene, renderer, camera, raycaster,
            document.getElementById("overlay"), MenuController
        );
        const PhysicsController = new PhysicsManager(NodeController,
            shapeMinProximity, shapeMaxProximity, tetherForce, tetherForce/2, passiveForce
        );
        const clock = new THREE.Clock();
        document.getElementById("container").appendChild(renderer.domElement);

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

        const WorldController = new WorldManager(scene, renderer, camera, raycaster, MouseController, effect, controls.camera);

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

        const PhaseController = new PhaseManager(
            scene,
            renderer.domElement,
            TICKSPEED,
            controls,
            {
                Node: NodeController,
                Overlay: OverlayController,
                Physics: PhysicsController,
                World: WorldController,
                Mouse: MouseController
            }
        );

        { // autosave
            const _autosaveHandler = (event) => {
                if (PhaseController.phase == "build") {
                    const currLayout = UTIL.layoutToJsonObj(scene, PhaseController.Managers.Node);
                    if (PhaseController.Managers.Node.validateLayout(maxStepsFromGlobe)) {
                        if (!UTIL.layoutsEqual(currLayout, Storage.get("localLayout"))) {
                            Logger.log("saved changed layout");
                            Storage.set("localLayout", currLayout);
                        }
                    } else
                        event.returnValue = "You have unsaved changes to your network. Are you sure you want to leave?";

                    if (
                        Storage.has("localLayout") && (
                            !Storage.has("lastSavedLayout", true) ||
                            !UTIL.layoutsEqual(
                                Storage.get("lastSavedLayout", true),
                                Storage.get("localLayout")
                            )
                        )
                    ) {
                        Storage.set("lastSavedLayout", Storage.get("localLayout"), true);
                        Session.savegame(Storage.get("localLayout"))
                            .then(res => {
                                if (res) {
                                    Logger.info("Saved layout.");
                                } else {
                                    Logger.warn("Failed to save.");
                                    Storage.set("lastSavedLayout", undefined, true);
                                }
                            });
                    }
                }
            };
            if (!(DEBUG_MODE && urlParams.has("nosave"))) {
                window.addEventListener("pagehide", _autosaveHandler);
                setTimeout(
                    () => setInterval(_autosaveHandler, AUTOSAVE_INTERVAL),
                    AUTOSAVE_INTERVAL // don't actually start autosaving until after first "interval"
                );
            }
        }

        { // persistent listeners
            MenuController.when("swapphase", function (dt) {
                const phaseType = dt.phase;
                try {
                    if (phaseType == "build") {
                        MenuController.when("loadmenu", detail => {
                            WorldController.clear();
                            if (!Storage.has("localLayout")) {
                                detail.statusElement.text = "Contacting Server";
                                Session.getsave()
                                    .then(res => {
                                        Storage.set("localLayout", res);
                                        Storage.set("lastSavedLayout", res, true);
                                        MenuController._dispatch("swapphase", { phase: "build" });
                                    });
                                } else {
                                    detail.statusElement.text = "Loading profile";
                                    PhaseController.buildPhase(Storage.get("localLayout"));
                                    MenuController.close();
                                }
                        }, false, true);
                    } else if (phaseType == "attack") {
                        WorldController.clear();
                        MenuController.when("loadmenu", detail => {
                            const targetData = Storage.get("targets", true).filter(t => t.id == dt.targetid)?.[0];
                            try {
                                if (targetData) {
                                    detail.statusElement.text = `Tracing Target: ${targetData.username}`;
                                    PhaseController.attackPhase(
                                        { username: targetData.username },
                                        targetData.game,
                                        AttackerData,
                                        AttackTypeData,
                                        NodeTypeData
                                    );
                                    MenuController.close();
                                } else {
                                    Logger.alert("Failed to load data for target!");
                                    MenuController._dispatch("swapphase", { phase: "build" });
                                }
                            } catch (err) {
                                Logger.alert("Failed to load data for target!");
                                Logger.error(`Something went wrong while loading attack phase on target ${dt.targetid}. Data:`, targetData, "\n" + err.message, "\nTrace:\n", err.stack);
                                MenuController._dispatch("swapphase", { phase: "build" });
                            }
                        }, false, true);
                    } else if (phaseType == "select") {
                        if (PhaseController.Managers.Node && !PhaseController.Managers.Node.validateLayout(maxStepsFromGlobe)) {
                            Logger.alert(`You have unsaved changes: All nodes must be connected and within ${maxStepsFromGlobe} steps of a network node!`);
                            MenuController.when("loadmenu", _ => MenuController.close(), false, true);
                        } else {
                            MenuController.when("loadmenu", detail => {
                                Storage.set("localLayout", UTIL.layoutToJsonObj(scene, PhaseController.Managers.Node));
                                detail.statusElement.text = "Discovering targets";
                                if (!Storage.has("targets", true) || UTIL.getNowUTCSeconds() - Storage.updated("targets", true) > TARGETS_TTL) {
                                    Session.getAttackTargets()
                                        .then(targets => {
                                            Storage.set("targets", targets, true);
                                            MenuController._dispatch("swapphase", { phase: "select" });
                                        });
                                } else {
                                    detail.statusElement.text = "Loading global net";
                                    PhaseController.selectPhase(
                                        UTIL.getRandomItems(Storage.get("targets", true), WORLD_TARGET_COUNT),
                                        {
                                            Attack: (userid) => {
                                                MenuController._dispatch("swapphase", {phase: "attack", targetid: userid});
                                            },
                                            Build: () => {
                                                MenuController._dispatch("swapphase", {phase: "build"});
                                            },
                                        }
                                    );
                                    MenuController.close();
                                }
                            }, false, true);
                        }
                    } else {
                        Logger.error(`Unrecognized phase "${phaseType}"`);
                        MenuController.when("loadmenu", _ => MenuController.close(), false, true);
                    }
                    camera.position.copy(DEFAULT_CAM_POS);
                } catch (err) {
                    Logger.error(`Failed to swap phase to "${phaseType}"`);
                    Logger.throw(err);
                    MenuController.when("loadmenu", _ => MenuController.close(), false, true);
                }
                MenuController.open(["loading"]);
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
        }
        statusEl.text = "Loading mesh data";
        const gtlfData = Promise.all([
            THREEUTILS.loadGLTFShape("./source/placeholder-cube.glb"),
            THREEUTILS.loadGLTFShape("./source/not-cube.glb"),
            THREEUTILS.loadGLTFShape("./source/globe.glb"),
            THREEUTILS.loadGLTFShape("./source/scanner.glb"),
            THREEUTILS.loadGLTFShape("./source/accurate-world.glb"),
        ]);
        gtlfData.then(data => {
            const [ placeholderData, cubeData, globeData, eyeData, worldData, ..._] = data;
            Logger.info("Finished loading shape data:", data);        

            NodeController.addMeshData({
                placeholder: () => MESH.Nodes.Placeholder(placeholderData),
                cube: () => MESH.Nodes.Cube(cubeData),
                globe: () => MESH.Nodes.Globe(globeData),
                scanner: () => MESH.Nodes.Scanner(eyeData),
                tether: (o, t) => MESH.Tether(o, t)
            });
            WorldController.addMeshData(
                MESH.SelectionGlobe(worldData, 4)
            );
            
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
            if (DEBUG_MODE && urlParams.has("phase")) {
                const phase = urlParams.get("phase");
                MenuController._dispatch("swapphase", {phase: phase});
            } else
                MenuController._dispatch("swapphase", {phase: "build"});

            { // [!] testing area
                if (DEBUG_MODE && urlParams.has("axes"))
                    if (Number(urlParams.get("axes")))
                        scene.add(new THREE.AxesHelper(Number(urlParams.get("axes"))));
                    else
                        scene.add(new THREE.AxesHelper(controls.camera.maxDistance * 2));
            }
            // render the stuff
            function animate() {
                const delta = UTIL.clamp(clock.getDelta(), 0, 1000);
                //requestIdleCallback(animate)
                PhaseController.update(delta);
                FPSCounter.update();
                effect.render(scene, camera);
            }
            FPSCounter.reset();
            renderer.setAnimationLoop(animate);
            setTimeout(() => {
                trackLowPerformace = true;
            }, 2500); // time before we start checking if we need to turn on low performance mode
        });
    }, false, true);
    MenuController.open(["loading"]);
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

const AttackerData = {
    attacks: [
        {
            type: "particle",
            amount: 99,
        },
    ],
};

const AttackTypeData = {
    particle: {
        mesh: MESH.AttackManagerFactory.Particle,
        damage: 5,
        logic: ATTACK.AttackLogic.ParticleLogicFactory, // don't need to instantite logic controllers for "dumb" attackers- they're stateless!
    },
    cubedefense: {
        mesh: MESH.AttackManagerFactory.CubeDefense,
        damage: 10,
        logic: ATTACK.AttackLogic.BasicLogicFactory,
    },
};

const NodeTypeData = {
    placeholder: {
        health: 50,
        slots: 5,
    },
    cube: {
        health: 100,
        slots: 6,
    },
    scanner: {
        health: 75,
        slots: 4,
    },
    globe: {
        health: 0,
        slots: 3,
    },
};