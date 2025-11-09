import * as UTIL from "./utils.js";

const zoomScaleFormula = (zoom, maxZoom) => {
    return 1/(
        1 + (Math.E**(-0.5*( zoom-(maxZoom/2.5) )))
    );
};

function redrawElement(element) {
    void(element.offsetHeight);
}

const FocusMenu = {
    createMenuElement: function(linkButtonAction, addButtonAction, infoButtonAction) {
        const el = document.createElement("div");
        el.classList.add("nodeMenu", "right", "reveal");
        // hard coded- needs to be updated if file changes.
        el.style.backgroundImage = `url("./source/node-overlay-menu.png")`;
        el.style.minWidth = "516px";
        el.style.minHeight = "545px";
        el.style.width = "516px";
        el.style.height = "545px";

        const linkButton = this.createLinkButton(linkButtonAction);
        el.appendChild(linkButton);
        const infoButton = this.createInfoButton(infoButtonAction);
        el.appendChild(infoButton);
        const addButton = this.createAddButton(addButtonAction);
        el.appendChild(addButton);

        return el;
    },
    createLinkButton: function(linkButtonAction) {
        const el = document.createElement("div");
        el.classList.add("button", "pointer-events");
        el.dataset.buttonType = "link";
        el.style.backgroundImage = `url("./source/link-button.png")`;
        el.style.width = "182px";
        el.style.height = "55px";
        el.style.setProperty("--left", "101px");
        el.style.setProperty("--top", "104px");
        el.addEventListener("click", function (event) {
            linkButtonAction();
        });
        
        return el;
    },
    createInfoButton: function(infoButtonAction) {
        const el = document.createElement("div");
        el.classList.add("button", "pointer-events");
        el.dataset.buttonType = "info";
        el.style.backgroundImage = `url("./source/info-button.png")`;
        el.style.width = "172px";
        el.style.height = "175px";
        el.style.setProperty("--left", "215px");
        el.style.setProperty("--top", "207px");
        el.addEventListener("click", function (event) {
            infoButtonAction();
        });
        
        return el;
    },
    createAddButton: function(addButtonAction) {
        const el = document.createElement("div");
        el.classList.add("button", "pointer-events");
        el.dataset.buttonType = "add";
        el.style.backgroundImage = `url("./source/add-button.png")`;
        el.style.width = "121px";
        el.style.height = "125px";
        el.style.setProperty("--left", "343px");
        el.style.setProperty("--top", "155px");
        el.addEventListener("click", function (event) {
            addButtonAction();
        });
        
        return el;
    }
}

const GenericElement = {
    buttonMenu: function (...elements) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("button-menu");
        elements.forEach(el => wrapper.appendChild(el));
        return wrapper;
    },
    button: function (text, action = () => {}) {
        const el = document.createElement("button");
        el.classList.add("button", "pointer-events");
        el.style.height = "2rem";
        el.style.width = "5rem";
        el.innerText = text;
        el.addEventListener("click", function (event) {
            action();
        });
        return el;
    },
    hideButton: function () {
        const el = document.createElement("button");
        el.classList.add("button", "pointer-events");
        el.style.height = "2rem";
        el.style.width = "2rem";
        el.id = "hideTestButtons";
        el.innerText = "<";
        el.dataset.active = "false";
        el.addEventListener("click", function (event) {
            const hideEl = document.getElementById("hideTestButtons");
            document.querySelectorAll(".button-menu > *:not(#hideTestButtons)").forEach(el => {
                el.style.visibility = hideEl.dataset.active == "false" ? "hidden" : "visible";
            })
            hideEl.dataset.active = hideEl.dataset.active == "false" ? "true" : "false";
            hideEl.innerText = hideEl.dataset.active == "false" ? "<" : ">";
        });
        return el;
    },
    textBox: function () {
        const el = document.createElement("textarea");
        el.classList.add("pointer-events");
        el.id = "textBox";
        el.rows = 5;
        el.cols = 40;
        el.placeholder = "Paste layouts here";
        return el;
    }
};

export function OverlayManager(
    scene,
    renderer,
    camera,
    raycaster,
    overlayContainerElement,
    scaleFormula = zoomScaleFormula,
) {
    let self = this;
    this._scene = scene;
    this._camera = camera;
    this._renderer = renderer;
    this._raycaster = raycaster;
    this._nodeManager = undefined;
    this._mouseManager = undefined;
    this._scaler = scaleFormula;
    this._controls = undefined;
    this.focusedNodeId = undefined;
    this.state = {
        inMenu: false,
        linking: false,
        get keepFocus() {
            return self.state.linking;
        },
        get stopFocusing() {
            return self.state.linking || self.state.inMenu;
        },
        get focusedNode() {
            return self.focusedNodeId != undefined;
        }
    }
    this.element = {
        _overlay: overlayContainerElement,
        focusMenu: undefined, // better to destroy node overlay when unused vs hide it, since rendering everything is gonna take a bunch of memory anyways...
        buttonMenu: undefined // for debug, for now
    };
    this._updateFocusMenu = function (scaleRange = [5, 20], clampScale = [0.25, 0.85]) {
        if (self.state.focusedNode) {
            const positionData = self._nodeManager.getFlatCoordinateFromNode(self.focusedNodeId);
            const scale = UTIL.clamp(self._scaler(
                scaleRange[1] - UTIL.clamp(positionData.distance, scaleRange[0], scaleRange[1]),
                scaleRange[1]
            ), clampScale[0], clampScale[1]);
            // Adjust translation proportionally to scale- compensate for newly empty space
            const x = positionData.x - ((self.element.focusMenu.clientWidth - (self.element.focusMenu.clientWidth * scale)) / 2);
            const y = positionData.y; 
            self.element.focusMenu.style.setProperty("--x", `${x}px`);
            self.element.focusMenu.style.setProperty("--y", `${y}px`);
            self.element.focusMenu.style.setProperty("--scale", scale);
        }
    }
    this._initOverlay = function () { // must be implemented by extending classes

    }
    this._createFocusMenuElement = function () { // must be implemented by extending classes

    }
    this._addOverlayElement = function () {

    }
    this._removeOverlayElement = function () {
        
    }
    this.focusNode = function (nodeid) {
        if (!self.state.stopFocusing) {
            self.unfocusNode();
            self.element.focusMenu = self._createFocusMenuElement();
            self.focusedNodeId = nodeid;
            self._updateFocusMenu();
            self.element._overlay.appendChild(self.element.focusMenu);
            redrawElement(self.element.focusMenu); // force redraw of element i.e. triggers the transition effect we want
            self.element.focusMenu.classList.add("show");
        }
    }
    this.unfocusNode = function () {
        if (self.state.focusedNode && !self.state.keepFocus) {
            const oldElement = self.element.focusMenu;
            self.element.focusMenu = undefined;
            self.focusedNodeId = undefined;
            redrawElement(oldElement);
            oldElement.classList.add("hide");
            oldElement.addEventListener("transitionend", function (event) {
                event.target.remove();
            }, { once: true });
        }
    }
    this.update = function () {
        self._updateFocusMenu();
    }
    this.init = function (controls, managers) {
        self = this;
        self._nodeManager = managers.Node;
        self._mouseManager = managers.Mouse;
        self._controls = controls;
        self._initOverlay();
    }
    this.clear = function () {
        Object.entries(self.element).forEach(([key, element]) => {
            if (key != "_overlay" && element != undefined) {
                self.element._overlay.removeChild(element);
                self.element[key] = undefined;
            }
        });
        Object.entries(Object.getOwnPropertyDescriptors(self.state))
            .filter(([, desc]) => desc.hasOwnProperty('value') && typeof desc.value !== 'function')
            .forEach(([key]) => {
                self.state[key] = false;
            });
        self.focusedNodeId = undefined;
    }
    return this;
}

export function BuildOverlayManager(
    overlayManager
) {
    const self = {...overlayManager}; // shallow copy, avoid making copies of entire nodeManagers
    self._initOverlay = function () {
        const el = GenericElement.buttonMenu(
            GenericElement.hideButton(),
            GenericElement.textBox(),
            GenericElement.button("load", function () {
                const layoutBackup = UTIL.layoutToJson(self._scene, self._nodeManager, false);
                self._nodeManager.clear();
                const textBox = document.getElementById("textBox");
                const result = UTIL.layoutFromJson(textBox.value.trim(), self._scene, self._controls.drag, self._nodeManager);
                textBox.value = "";
                if (!result) {
                    self._nodeManager.clear();
                    UTIL.layoutFromJson(layoutBackup, self._scene, self._controls.drag, self._nodeManager);
                    alert("Failed to load layout. Was the wrong format entered?");
                }
            }),
            GenericElement.button("save", function () {
                const data = UTIL.layoutToJson(self._scene, self._nodeManager);
                navigator.clipboard.writeText(data);
                alert("Layout copied to clipboard");
            }),
            GenericElement.button("SAVE DEBUG FILE FOR DEV", function () {
                const layoutData = UTIL.layoutToJson(self._scene, self._nodeManager, false);
                const domData = document.documentElement.outerHTML;
                Logger.log("Generating debug file for download");
                UTIL.download(
                    (new Date()).toISOString() + ".txt",
                    `===[LAYOUT]===\n${layoutData}\n===[DOM]===\n${domData}\n===[CONSOLE]===\n${Logger.history}\n`
                );
            }),
            GenericElement.button("clear", function () {
                self._nodeManager.clear();
            }),
            GenericElement.button("Attack phase" , function () {
                self.element._overlay.dispatchEvent(UTIL.createEvent(
                    "swapphase",
                    {phase: "attack"}
                ));
            })
        );
        self.element._overlay.appendChild(el);
        self.element.buttonMenu = el;
    }
    self._createFocusMenuElement = function () {
        const maxNodeDistance = 3; // arbitrary
        return FocusMenu.createMenuElement(
            function linkButtonAction() {
                if (!self.state.linking) {
                    self._nodeManager.highlightNode(self.focusedNodeId);
                    self.state.linking = true;
                    self._mouseManager.getNextEvent("clicked").then(event => {
                        const nodeid = self._nodeManager.getNodeFromFlatCoordinate(self._mouseManager.position);
                        // [!] ugly as hell
                        if (nodeid) {
                            if (nodeid == self.focusedNodeId) { // selected self, remove all tethers
                                self._nodeManager.untetherNode(nodeid);
                                Logger.log("detached node");
                            } else {
                                const tetherid = self._nodeManager.isNeighbor(nodeid, self.focusedNodeId);
                                if (tetherid) { // selected neighbor, remove tether
                                    self._nodeManager.removeTether(tetherid);
                                    Logger.log("unlinked nodes");
                                } else { // selected untethered node, create new tether
                                    self._nodeManager.tetherNodes(self.focusedNodeId, nodeid);
                                    Logger.log("interlinked");
                                }
                            }
                        } else { // nothing selected
                            Logger.log("didnt link :(");
                        }
                        self._nodeManager.unhighlightNode(self.focusedNodeId);
                        self.state.linking = false;
                        self.unfocusNode();
                    });
                    Logger.log("looking to link");
                }
            },
            function addButtonAction() {
                const node = self._nodeManager.getNode(self.focusedNodeId);
                self._nodeManager.createNode(node.userData.type, [self.focusedNodeId], [
                    node.position.x + UTIL.random(-maxNodeDistance/1.5, maxNodeDistance/1.5),
                    node.position.y + UTIL.random(-maxNodeDistance/1.5, maxNodeDistance/1.5),
                    node.position.z + UTIL.random(-maxNodeDistance/1.5, maxNodeDistance/1.5)
                ]);
            },
            function infoButtonAction() {
                const node = self._nodeManager.getNode(self.focusedNodeId);
                Logger.log(node);
            }
        );
    }

    return self;
}

export function AttackOverlayManager(
    overlayManager
) {
    const self = {...overlayManager}; // shallow copy, avoid making copies of entire nodeManagers
    self.state = {
        inMenu: false,
        get keepFocus() {
            return false; // will need for later in dev
        },
        get stopFocusing() {
            return self.state.inMenu;
        },
        get focusedNode() {
            return self.focusedNodeId != undefined;
        }
    }
    self._initOverlay = function () {
        const el = GenericElement.buttonMenu(
            GenericElement.hideButton(),
            GenericElement.button("SAVE DEBUG FILE FOR DEV", function () {
                const layoutData = UTIL.layoutToJson(self._scene, self._nodeManager, false);
                const domData = document.documentElement.outerHTML;
                Logger.log("Generating debug file for download");
                UTIL.download(
                    (new Date()).toISOString() + ".txt",
                    `===[LAYOUT]===\n${layoutData}\n===[DOM]===\n${domData}\n===[CONSOLE]===\n${Logger.history}\n`
                );
            }),
            GenericElement.button("Build phase", function () {
                self.element._overlay.dispatchEvent(UTIL.createEvent(
                    "swapphase",
                    {phase: "build"}
                ));
            })
        );
        self.element._overlay.appendChild(el);
        self.element.buttonMenu = el;
    }
    self._createFocusMenuElement = function () {
        return FocusMenu.createMenuElement(
            function linkButtonAction() {
                Logger.log("[AttackOverlayManager] | Link focus menu button clicked");
            },
            function addButtonAction() {
                Logger.log("[AttackOverlayManager] | Add focus menu button clicked");
            },
            function infoButtonAction() {
                Logger.log("[AttackOverlayManager] | info focus menu button clicked");
            }
        );
    }

    return self;
}