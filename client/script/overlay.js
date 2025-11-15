import * as UTIL from "./utils.js";

const zoomScaleFormula = (zoom, maxZoom) => {
    return 1/(
        1 + (Math.E**(-0.5*( zoom-(maxZoom/2.5) )))
    );
};

function redrawElement(element) {
    void(element.offsetHeight);
}

const BuildFocusMenu = {
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

const AttackFocusMenu = {
    createMenuElement: function (...elements) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("attack-focus-menu", "reveal", "pointer-events");
        elements.forEach((el, i) => {
            el.style.setProperty("--index", i);
            wrapper.appendChild(el);
        });
        return wrapper;
    },
    createTileElement: function (attackType = undefined) {
        // hard coded- needs to be updated if file changes.
        const el = document.createElement("div");
        el.classList.add("button", "pointer-events");
        el.dataset.buttonType = "tile";
        if (attackType == "particle") {
            el.style.backgroundImage = `url("./source/particle-attack-icon.png")`;
            el.dataset.attackType = attackType
        } else {
            el.style.backgroundImage = `url("./source/blank-attack-icon.png")`;
            el.dataset.attackType = undefined;
        }
        // actual dims = 500x500 px
        el.style.setProperty("--size-scale", "10rem");

        return el;
    }
};

const AttackBarMenu = {
    createMenuElement: function (...elements) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("attack-bar-menu");
        // hard coded- needs to be updated if tile asset changes.
        wrapper.style.minWidth = "10rem";
        wrapper.style.minHeight = "10rem";
        elements.forEach(el => wrapper.appendChild(el));
        return wrapper;
    }
};

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
        targeting: false,
        get keepFocus() {
            return self.state.targeting;
        },
        get stopFocusing() {
            return self.state.targeting || self.state.inMenu;
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
    this._initOverlay = function () { // must be implemented by extending classes

    }
    this._createFocusMenuElement = function () { // must be implemented by extending classes

    }
    this.update = function () { // must be implemented by extending classes

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
                oldElement.remove();
            }, { once: true});
        }
    }
    this.init = function (controls, managers) {
        self = this;
        this._nodeManager = managers.Node;
        this._mouseManager = managers.Mouse;
        this._controls = controls;
        this._initOverlay();
    }
    this.clear = function () {
        Object.entries(self.element).forEach(([key, element]) => {
            if (key != "_overlay" && element != undefined) {
                self.element._overlay.removeChild(element);
                self.element[key] = undefined;
            }
        });
        Object.entries(Object.getOwnPropertyDescriptors(self.state))
            .filter(([, desc]) => desc.value && typeof desc.value !== 'function')
            .forEach(([key]) => self.state[key] = false);
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
        return BuildFocusMenu.createMenuElement(
            function linkButtonAction() {
                if (!self.state.targeting) {
                    self._nodeManager.highlightNode(self.focusedNodeId);
                    self.state.targeting = true;
                    self._mouseManager.getNextEvent("clicked").then(event => {
                        if (self.state.targeting) {
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
                            self.state.targeting = false;
                            self.unfocusNode();
                        }
                    });
                    Logger.log("looking to link");
                }
            },
            function addButtonAction() {
                const node = self._nodeManager.getNode(self.focusedNodeId);
                const pos = [
                    node.position.x + UTIL.random(-maxNodeDistance/1.5, maxNodeDistance/1.5),
                    node.position.y + UTIL.random(-maxNodeDistance/1.5, maxNodeDistance/1.5),
                    node.position.z + UTIL.random(-maxNodeDistance/1.5, maxNodeDistance/1.5)
                ];
                const newNodeId = self._nodeManager.createNode(node.userData.type, pos);
                self._nodeManager.tetherNodes(node.uuid, newNodeId);
            },
            function infoButtonAction() {
                const node = self._nodeManager.getNode(self.focusedNodeId);
                Logger.log(node);
            }
        );
    }
    self._updateFocusMenu = function (scaleRange = [5, 20], clampScale = [0.25, 0.85]) {
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
    self.update = function () {
        self._updateFocusMenu();
    }

    return self;
}

export function AttackOverlayManager(
    overlayManager,
    attackManager
) {
    const self = {...overlayManager}; // shallow copy, avoid making copies of entire nodeManagers
    self._attackManager = attackManager;
    self.element.attackBarMenu = undefined;

    self._initOverlay = function () {
        // create testing menu
        self.element.buttonMenu = GenericElement.buttonMenu(
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
        
        // create attack bar menu
        const attackTiles = Array.from(self._attackManager.attacks, (attack) => {
            const tile = AttackFocusMenu.createTileElement(attack.type);
            tile.addEventListener("click", (event) => {
                if (self.state.focusedNode && self._nodeManager.getNodeData(self.focusedNodeId)?.isFriendly) {
                    self._nodeManager.addAttackToNode(attack.type, self.focusedNodeId);
                    self._updateFocusMenu();
                }
            });
            return tile;
        });
        self.element.attackBarMenu = AttackBarMenu.createMenuElement(...attackTiles);

        self.element._overlay.appendChild(self.element.buttonMenu);
        self.element._overlay.appendChild(self.element.attackBarMenu);
    }
    self._updateFocusMenu = function () {
        if (self.state.focusedNode) {
            while (self.element.focusMenu.firstChild) {
                self.element.focusMenu.removeChild(self.element.focusMenu.firstChild);
            }
            self._loadTilesForNode().forEach(el => self.element.focusMenu.appendChild(el));
        }
    }
    self._loadTilesForNode = function () {
        const nodeData = self._nodeManager.getNodeData(self.focusedNodeId);
        const attackerTiles = Array.from(
                nodeData.attackers,
                ({type}) => AttackFocusMenu.createTileElement(type)
        )
        attackerTiles.forEach((el, i) => 
            el.addEventListener("click", (e) => {
                nodeData.attackers.pop(i);
                self._updateFocusMenu();
            }, {once: true})
        );
        return attackerTiles;
    }
    self.focusNode = function (nodeid) {
        if (!self.state.stopFocusing) {
            self.unfocusNode();
            self.focusedNodeId = nodeid;
            self.element.focusMenu = self._createFocusMenuElement();
            self.element._overlay.appendChild(self.element.focusMenu);
            redrawElement(self.element.focusMenu); // force redraw of element i.e. triggers the transition effect we want
            self.element.focusMenu.classList.add("show");
        }
    }
    self.unfocusNode = function () {
        if (self.state.focusedNode && !self.state.keepFocus) {
            const oldElement = self.element.focusMenu;
            self.element.focusMenu = undefined;
            self.focusedNodeId = undefined;
            redrawElement(oldElement);
            oldElement.classList.add("hide");
             // animation is staggered, so need to wait for all children to finish
            let countdown = oldElement.children.length;
            oldElement.addEventListener("transitionend", function (event) {
                if (--countdown <= 0)
                    oldElement.remove();
            });
        }
    }
    self.update = function () {
        
    }
    self._createFocusMenuElement = function () {
        return AttackFocusMenu.createMenuElement(...self._loadTilesForNode());
    }
    // Old version
    // self._createFocusMenuElement = function () {
    //     return BuildFocusMenu.createMenuElement(
    //         function linkButtonAction() {
    //             // Logger.log("[AttackOverlayManager] | Link focus menu button clicked");
    //             if (!self.state.targeting && self._nodeManager.isNodeFriendly(self.focusedNodeId)) {
    //                 self.state.targeting = true;
    //                 self._mouseManager.getNextEvent("clicked").then(event => {
    //                     if (self.state.targeting) {
    //                         const nodeid = self._nodeManager.getNodeFromFlatCoordinate(self._mouseManager.position);
    //                         // [!] ugly as hell
    //                         if (
    //                             nodeid &&
    //                             nodeid != self.focusedNodeId &&
    //                             !self._nodeManager.isNodeFriendly(nodeid) &&
    //                             self._nodeManager.isNodeAttackable(nodeid) && 
    //                             self._nodeManager.isNeighbor(self.focusedNodeId, nodeid)
    //                         ) {
    //                             const nodeData = self._nodeManager.getNodeData(nodeid);
    //                             self._nodeManager.attackNode(self.focusedNodeId, nodeid, {
    //                                 type: "particle",
    //                                 damage: 15
    //                             });
    //                             Logger.log(`Attacking node ${nodeid}`);
    //                         } else { // nothing selected
    //                             Logger.log("nothing selected");
    //                         }
    //                         self.state.targeting = false;
    //                         self.unfocusNode();
    //                     }
    //                 });
    //                 Logger.log(`Selecting node to attack from ${self.focusedNodeId}`);
    //             }
    //         },
    //         function addButtonAction() {
    //             // Logger.log("[AttackOverlayManager] | Add focus menu button clicked");
    //             if (!self._nodeManager.isNodeFriendly(self.focusedNodeId)) {
    //                 if (self._nodeManager.isNodeAttackable(self.focusedNodeId)) {
    //                     const nodeData = self._nodeManager.getNodeData(self.focusedNodeId);
    //                     self._nodeManager.damageNode(self.focusedNodeId, nodeData.hp.total);
    //                 } else {
    //                     Logger.alert(`Cannot attack a node with no friendly neighbors!\n(${self.focusedNodeId})`);
    //                 }
    //             } else {
    //                 self._nodeManager.damageNode(self.focusedNodeId, 999);
    //             }   
    //         },
    //         function infoButtonAction() {
    //             // Logger.log("[AttackOverlayManager] | info focus menu button clicked");
    //             Logger.log(
    //                 self._nodeManager.getNodeData(self.focusedNodeId),
    //                 self._nodeManager.getNode(self.focusedNodeId)
    //             );
    //         }
    //     );
    // }

    return self;
}