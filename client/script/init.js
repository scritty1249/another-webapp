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
import { MenuManager } from "./menu.js";
import { PhaseManager } from "./phases.js";
import * as UTIL from "./utils.js";
import * as ATTACK from "./attacker.js"; // [!] testing, temporary module- to be redesigned soon
import * as Session from "./session.js";
import { WorldManager } from "./world.js";
import { SelectiveOutlineEffect } from "./renderer.js";
import { DataStore } from "./data.js";

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
camera.position.copy(CONFIG.DEFAULT_CAM_POS);
// rendererererer
const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
    alpha: true,
});
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
    if (
        !Session.isLoggedIn() ||
        (DEBUG_MODE && urlParams.has("login"))
    ) {
        MenuController.loginScreen();
        MenuController.when("login", ({ username, password, elements }) => {
            elements.forEach((el) => el.classList.remove("pointer-events"));
            MenuController.when(
                "loadmenu",
                (detail) => {
                    const statusEl = detail.statusElement;
                    statusEl.text = "Logging in...";
                    Session.login(username, password).then((res) => {
                        if (res) mainloop(MenuController);
                        else {
                            elements.forEach((el) =>
                                el.classList.add("pointer-events")
                            );
                            MenuController.loginScreen();
                        }
                    });
                },
                false,
                true
            );
            MenuController.open(["loading"]);
        });
        MenuController.when("newlogin", ({ username, password, elements }) => {
            elements.forEach((el) => el.classList.remove("pointer-events"));
            MenuController.when(
                "loadmenu",
                (detail) => {
                    const statusEl = detail.statusElement;
                    statusEl.text = "Contacting server";
                    Session.newlogin(
                        username,
                        password,
                        UTIL.BLANK_LAYOUT_OBJ,
                        UTIL.BLANK_BANK
                    ).then((res) => {
                        if (res) mainloop(MenuController);
                        else {
                            elements.forEach((el) =>
                                el.classList.add("pointer-events")
                            );
                            MenuController.loginScreen();
                        }
                    });
                },
                false,
                true
            );
            MenuController.open(["loading"]);
        });
    } else {
        // remembered login
        mainloop(MenuController);
    }
} else {
    const warning = WebGL.getWebGL2ErrorMessage();
    document.getElementById("container").appendChild(warning);
}

function mainloop(MenuController) {
    MenuController.when(
        "loadmenu",
        (d) => {
            const statusEl = d.statusElement;
            statusEl.text = "Loading scene";

            // Clear any session storage
            Storage.remove("localLayout");
            Storage.remove("targets");

            // Loading sequence
            const MouseController = new Mouse(
                window,
                renderer.domElement,
                CONFIG.mouseClickDurationThreshold
            );
            const NodeController = new NodeManager(
                scene,
                renderer,
                camera,
                raycaster
            );
            const OverlayController = new OverlayManager(
                scene,
                renderer,
                camera,
                raycaster,
                document.getElementById("overlay"),
                MenuController
            );
            const PhysicsController = new PhysicsManager(
                NodeController,
                CONFIG.shapeMinProximity,
                CONFIG.shapeMaxProximity,
                CONFIG.tetherForce,
                CONFIG.tetherForce / 2,
                CONFIG.passiveForce
            );
            const clock = new THREE.Clock();
            document
                .getElementById("container")
                .appendChild(renderer.domElement);

            // Setup external (yawn) library controls
            const controls = {
                drag: new DragControls(
                    NodeController.nodelist,
                    camera,
                    renderer.domElement
                ), // drag n" drop
                camera: new OrbitControls(camera, renderer.domElement), // camera
            };

            controls.camera.enablePan = false;
            controls.camera.maxDistance = 25;
            controls.camera.enableDamping = true;
            controls.camera.dampingFactor = 0.12;
            controls.drag.transformGroup = true;
            controls.drag.rotateSpeed = 0;

            const WorldController = new WorldManager(
                scene,
                renderer,
                camera,
                raycaster,
                MouseController,
                effect,
                controls.camera
            );

            // release right click
            controls.drag.domElement.removeEventListener(
                "contextmenu",
                controls.drag._onContextMenu
            );
            controls.camera.domElement.removeEventListener(
                "contextmenu",
                controls.camera._onContextMenu
            );

            const backgroundTextureCube =
                THREEUTILS.loadTextureCube("./source/bg/");
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
                CONFIG.TICKSPEED,
                controls,
                {
                    Node: NodeController,
                    Overlay: OverlayController,
                    Physics: PhysicsController,
                    World: WorldController,
                    Mouse: MouseController,
                }
            );

            {
                // autosave
                const _autosaveHandler = (event) => {
                    if (PhaseController.phase == "build") {
                        const currLayout = UTIL.layoutToJsonObj(
                            scene,
                            PhaseController.Managers.Node
                        );
                        if (
                            PhaseController.Managers.Node.validateLayout(
                                CONFIG.maxStepsFromGlobe
                            )
                        ) {
                            if (
                                !UTIL.layoutsEqual(
                                    currLayout,
                                    Storage.get("localLayout")
                                )
                            ) {
                                Logger.log("saved changed layout");
                                Storage.set("localLayout", currLayout);
                            }
                        } else
                            event.returnValue =
                                "You have unsaved changes to your network. Are you sure you want to leave?";

                        if (
                            Storage.has("localLayout") &&
                            (!Storage.has("lastSavedLayout", true) ||
                                !UTIL.layoutsEqual(
                                    Storage.get("lastSavedLayout", true),
                                    Storage.get("localLayout")
                                ))
                        ) {
                            Session.savegame(Storage.get("localLayout")).then(
                                (res) => {
                                    if (res) {
                                        Logger.info("Saved layout.");
                                    } else {
                                        Logger.warn("Failed to save.");
                                        Storage.set(
                                            "lastSavedLayout",
                                            undefined,
                                            true
                                        );
                                    }
                                }
                            );
                        }
                    }
                };
                if (!(DEBUG_MODE && urlParams.has("nosave"))) {
                    window.addEventListener("pagehide", _autosaveHandler);
                    setTimeout(
                        () => setInterval(_autosaveHandler, CONFIG.AUTOSAVE_INTERVAL),
                        CONFIG.AUTOSAVE_INTERVAL // don't actually start autosaving until after first "interval"
                    );
                }
            }

            {
                // persistent listeners
                MenuController.when(
                    "swapphase",
                    function (dt) {
                        const phaseType = dt.phase;
                        try {
                            if (phaseType == "build") {
                                MenuController.when(
                                    "loadmenu",
                                    (detail) => {
                                        WorldController.clear();
                                        if (!Storage.has("localLayout")) {
                                            detail.statusElement.text =
                                                "Contacting Server";
                                            Session.getsave()
                                                .then((res) => {
                                                    if (!res) {
                                                        // Session token expired
                                                        CookieJar.remove("session");
                                                        Logger.alert(
                                                            "Session expired, please log in again."
                                                        );
                                                        window.location.reload();
                                                    }
                                                    Storage.set(
                                                        "localLayout",
                                                        res.game
                                                    );
                                                    Storage.set(
                                                        "lastSavedLayout",
                                                        res.game,
                                                        true
                                                    );
                                                    MenuController._dispatch(
                                                        "swapphase",
                                                        { phase: "build" }
                                                    );
                                                });
                                        } else {
                                            detail.statusElement.text =
                                                "Loading profile";
                                            PhaseController.buildPhase(
                                                Storage.get("localLayout"),
                                                DataStore.NodeOverlayData,
                                                DataStore.NodeDetailedInfo,
                                                dt?.metadata ? dt.metadata : {}
                                            );
                                            { // process attack results
                                                setTimeout(() => {
                                                    Logger.info("Fetching defense history");
                                                    Session.getDefenseHistory()
                                                        .then((res) => {
                                                            const _blankDeuctions = {
                                                                currency: {
                                                                    cash: 0,
                                                                    crypto: 0
                                                                },
                                                                attackers: []
                                                            };
                                                            if (res) {
                                                                const _deduct = Storage.has("deductions")
                                                                ? Storage.get("deductions")
                                                                : Object.create(_blankDeuctions);
                                                                const newAttackers = new Set();
                                                                const newHistory = res.filter(ar => ar?.processed == false);
                                                                newHistory.forEach(attackResult =>
                                                                        attackResult.losses.forEach(_loss => {
                                                                            const [[ _lossType, _lossAmount]] = Object.entries(_loss);
                                                                            _deduct.currency[_lossType] += _lossAmount;
                                                                            newAttackers.add(attackResult.username);
                                                                        })
                                                                    );
                                                                _deduct.attackers = [...new Set([..._deduct.attackers, ...newAttackers])];
                                                                Storage.set("deductions", _deduct); // throw it in storage, deal with it at a better time
                                                                Logger.info("Loaded debt from attacks");

                                                                // [!] temp solution: store history
                                                                const oldHistory = Storage.has("defenseHistory", true) ? Storage.get("defenseHistory", true) : [];
                                                                Storage.set("defenseHistory", [...oldHistory, ...newHistory], true);
                                                            }
                                                            if (PhaseController.phase == "build" && Storage.has("deductions")) {
                                                                const _deduct = Storage.get("deductions");
                                                                if (Object.values(_deduct.currency).some(a => a > 0)) {
                                                                    let text = [];
                                                                    Object.entries(_deduct).forEach(([currencyType, amount]) => {
                                                                        const _leftover = PhaseController.Managers.Node.removeCurrency(currencyType, amount);
                                                                        text.push(`${amount - _leftover} ${currencyType}`);
                                                                    });
                                                                    Storage.set("deductions", _blankDeuctions);
                                                                    const message = `Funds stolen by ${[..._deduct.attackers].map(e => e.username).join(", ")}! Lost ` + (text.length > 1
                                                                        ? text.slice(0, text.length - 1)
                                                                            .join(", ") +
                                                                            " and " + text.at(-1)
                                                                        : text[0]);
                                                                    PhaseController.Managers.Overlay.messagePopup(message, 4500);
                                                                }
                                                            }
                                                        });
                                                }, 0);
                                            }
                                            MenuController.close();
                                        }
                                    },
                                    false,
                                    true
                                );
                            } else if (phaseType == "attack") {
                                WorldController.clear();
                                MenuController.when(
                                    "loadmenu",
                                    (detail) => {
                                        const targetData = Storage.get(
                                            "targets",
                                            true
                                        ).filter(
                                            (t) => t.id == dt.targetid
                                        )?.[0];
                                        try {
                                            if (targetData) {
                                                detail.statusElement.text = `Tracing Target: ${targetData.username}`;
                                                PhaseController.attackPhase(
                                                    {
                                                        overlayData: {
                                                            username:
                                                                targetData.username,
                                                        },
                                                        resultHandler: (rewards) => {
                                                            const attackResultPayload = {
                                                                username: CookieJar.get("username"),
                                                                timestamp: UTIL.getNowUTCSeconds(),
                                                                id: CookieJar.get("userid"),
                                                                processed: false,
                                                                losses: rewards
                                                            };
                                                            Session.sendAttackResult(targetData.id, attackResultPayload)
                                                                .then(res => {if (res) Logger.info("Successfully sent attack result data.")});
                                                        },
                                                    },
                                                    targetData.game,
                                                    DataStore.AttackerData,
                                                    DataStore.AttackTypeData(camera),
                                                    DataStore.NodeTypeData
                                                );
                                                MenuController.close();
                                            } else {
                                                Logger.alert(
                                                    "Failed to load data for target!"
                                                );
                                                MenuController._dispatch(
                                                    "swapphase",
                                                    { phase: "build" }
                                                );
                                            }
                                        } catch (err) {
                                            Logger.alert(
                                                "Failed to load data for target!"
                                            );
                                            Logger.error(
                                                `Something went wrong while loading attack phase on target ${dt.targetid}. Data:`,
                                                targetData,
                                                "\n" + err.message,
                                                "\nTrace:\n",
                                                err.stack
                                            );
                                            MenuController._dispatch(
                                                "swapphase",
                                                { phase: "build" }
                                            );
                                        }
                                    },
                                    false,
                                    true
                                );
                            } else if (phaseType == "select") {
                                if ((
                                    PhaseController.Managers.Node &&
                                    !PhaseController.Managers.Node.validateLayout(
                                        CONFIG.maxStepsFromGlobe
                                    )) && !dt?.refresh
                                ) {
                                    Logger.alert(
                                        `You have unsaved changes: All nodes must be connected and within ${CONFIG.maxStepsFromGlobe} steps of a network node!`
                                    );
                                    MenuController.when(
                                        "loadmenu",
                                        (_) => MenuController.close(),
                                        false,
                                        true
                                    );
                                } else {
                                    MenuController.when(
                                        "loadmenu",
                                        (detail) => {
                                            if (!dt?.refresh)
                                                Storage.set(
                                                    "localLayout",
                                                    UTIL.layoutToJsonObj(
                                                        scene,
                                                        PhaseController.Managers
                                                            .Node
                                                    )
                                                );
                                            detail.statusElement.text =
                                                "Discovering targets";
                                            if (
                                                !Storage.has("targets", true) ||
                                                UTIL.getNowUTCSeconds() -
                                                    Storage.updated(
                                                        "targets",
                                                        true
                                                    ) >
                                                    CONFIG.TARGETS_TTL
                                            ) {
                                                Session.getAttackTargets().then(
                                                    (targets) => {
                                                        if (!targets) {
                                                            // Session token expired
                                                            CookieJar.remove(
                                                                "session"
                                                            );
                                                            Logger.alert(
                                                                "Session expired, please log in again."
                                                            );
                                                            window.location.reload();
                                                        }
                                                        Storage.set(
                                                            "targets",
                                                            targets,
                                                            true
                                                        );
                                                        MenuController._dispatch(
                                                            "swapphase",
                                                            { phase: "select" }
                                                        );
                                                    }
                                                );
                                            } else {
                                                detail.statusElement.text =
                                                    "Loading global net";
                                                if (!Storage.has("currentTargets"))
                                                    Storage.set("currentTargets", UTIL.getRandomItems(Storage.get("targets", true), CONFIG.WORLD_TARGET_COUNT));
                                                PhaseController.selectPhase(
                                                    Storage.get("currentTargets"),
                                                    {
                                                        Refresh: () => {
                                                            Storage.set("currentTargets", UTIL.getRandomItems(Storage.get("targets", true), CONFIG.WORLD_TARGET_COUNT))
                                                            MenuController._dispatch(
                                                                "swapphase",
                                                                {
                                                                    phase: "select",
                                                                    refresh: true
                                                                }
                                                            );
                                                        },
                                                        Attack: (userid) => {
                                                            MenuController._dispatch(
                                                                "swapphase",
                                                                {
                                                                    phase: "attack",
                                                                    targetid:
                                                                        userid,
                                                                }
                                                            );
                                                        },
                                                        Build: () => {
                                                            MenuController._dispatch(
                                                                "swapphase",
                                                                {
                                                                    phase: "build",
                                                                }
                                                            );
                                                        },
                                                    }
                                                );
                                                MenuController.close();
                                            }
                                        },
                                        false,
                                        true
                                    );
                                }
                            } else {
                                Logger.error(
                                    `Unrecognized phase "${phaseType}"`
                                );
                                MenuController.when(
                                    "loadmenu",
                                    (_) => MenuController.close(),
                                    false,
                                    true
                                );
                            }
                            camera.position.copy(CONFIG.DEFAULT_CAM_POS);
                        } catch (err) {
                            Logger.error(
                                `Failed to swap phase to "${phaseType}"`
                            );
                            Logger.throw(err);
                            MenuController.when(
                                "loadmenu",
                                (_) => MenuController.close(),
                                false,
                                true
                            );
                        }
                        MenuController.open(["loading"]);
                    },
                    true
                );
                MenuController.when(
                    "lowperformance",
                    function (detail) {
                        const toggleTo = detail.set;
                        NodeController.lowPerformanceMode = toggleTo;
                        MenuController.close();
                    },
                    true
                );
                MenuController.when(
                    "logout",
                    function (_) {
                        Session.clearSession();
                        window.location.reload();
                    },
                    true
                );
                MenuController.when(
                    "_savelog",
                    function (_) {
                        UTIL._DebugTool.exportLogger(
                            scene,
                            NodeController,
                            Logger
                        );
                        MenuController.close();
                    },
                    true
                );
            }
            statusEl.text = "Loading mesh data";
            const gtlfData = Promise.all([
                THREEUTILS.loadGLTFShape("./source/placeholder-cube.glb"),
                THREEUTILS.loadGLTFShape("./source/not-cube.glb"),
                THREEUTILS.loadGLTFShape("./source/globe.glb"),
                THREEUTILS.loadGLTFShape("./source/scanner.glb"),
                THREEUTILS.loadGLTFShape("./source/accurate-world.glb"),
                THREEUTILS.loadGLTFShape("./source/squarestack.glb"),
                THREEUTILS.loadGLTFShape("./source/circlestack.glb"),
            ]);
            gtlfData.then((data) => {
                const [
                    placeholderData,
                    cubeData,
                    globeData,
                    eyeData,
                    worldData,
                    squareStackData,
                    cricleStackData,
                    ..._
                ] = data;
                Logger.info("Finished loading shape data:", data);

                NodeController.addMeshData({
                    placeholder: () => MESH.Nodes.Placeholder(placeholderData),
                    cube: () => MESH.Nodes.Cube(cubeData),
                    globe: () => MESH.Nodes.Globe(globeData),
                    scanner: () => MESH.Nodes.Scanner(eyeData),
                    tether: (o, t) => MESH.Tether(o, t),
                    cashfarm: () => MESH.Nodes.CashFarm(squareStackData),
                    cryptofarm: () => MESH.Nodes.CryptoFarm(squareStackData),
                    cashstore: () => MESH.Nodes.CashStore(cricleStackData),
                    cryptostore: () => MESH.Nodes.CryptoStore(cricleStackData),
                });
                WorldController.addMeshData(MESH.SelectionGlobe(worldData, 4));

                let trackLowPerformace = false;
                document.getElementById("performance").textContent =
                    "Low Performance mode: OFF";
                const FPSCounter = new Framerate((fps) => {
                    document.getElementById(
                        "framerate"
                    ).textContent = `FPS: ${fps}`;
                    document.getElementById(
                        "performance"
                    ).textContent = `Low Performance mode: ${
                        NodeController.lowPerformanceMode ? "ON" : "OFF"
                    }`;
                    if (
                        trackLowPerformace &&
                        !NodeController.lowPerformanceMode &&
                        FPSCounter.started &&
                        FPSCounter.fps < 30
                    ) {
                        NodeController.lowPerformanceMode = true;
                        Logger.warn(
                            `FPS dropped below threshold to ${FPSCounter.avgFramerate}, low performance mode is ON.`
                        );
                    }
                });
                if (DEBUG_MODE && urlParams.has("phase")) {
                    const phase = urlParams.get("phase");
                    MenuController._dispatch("swapphase", { phase: phase });
                } else
                    MenuController._dispatch("swapphase", { phase: "build" });

                {
                    // [!] testing area
                    if (DEBUG_MODE && urlParams.has("axes"))
                        if (Number(urlParams.get("axes")))
                            scene.add(
                                new THREE.AxesHelper(
                                    Number(urlParams.get("axes"))
                                )
                            );
                        else
                            scene.add(
                                new THREE.AxesHelper(
                                    controls.camera.maxDistance * 2
                                )
                            );
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
        },
        false,
        true
    );
    MenuController.open(["loading"]);
}

function Framerate(
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
        get: function () {
            return self._framerate;
        },
        set: function (value) {
            self._framerate = value;
            self._callback(value);
        },
    });
    Object.defineProperty(self, "started", {
        get: function () {
            return self.prev != undefined && self._framerate > 0;
        },
    });
    this.reset = function () {
        self.prev = Date.now();
        self._frame = 0;
        self._framerate = 0;
    };
    this.update = function () {
        if (self.prev) {
            self._frame++;
            const curr = Date.now();
            if (curr > self.prev + self._framesPerMs) {
                self.framerate = Math.round(
                    (self._frame * self._framesPerMs) / (curr - self.prev)
                );
                self.prev = curr;
                self._frame = 0;
            }
        } else {
            self.reset();
        }
    };
    return this;
}
