import * as UTIL from "./utils.js";
import {
    Sprite,
    SpriteMaterial,
    TextureLoader
} from "three";
import Menu from "./menu.js";

const zoomScaleFormula = (zoom, maxZoom) => {
    return 1/(
        1 + (Math.E**(-0.5*( zoom-(maxZoom/2.5) )))
    );
};

function redrawElement(element) {
    void(element.offsetWidth);
}
function redrawElementChildren(element) {
    redrawElement(element);
    [...element.children].forEach(el => redrawElement(el));
}

const BuildFocusMenu = {
    createMenuElement: function(linkButtonAction, addButtonAction, infoButtonAction) {
        const el = document.createElement("div");
        el.classList.add("nodeMenu", "right", "reveal");
        // hard coded- needs to be updated if file changes.
        el.style.backgroundImage = `url("./source/node-overlay-menu.png")`;
        el.style.minWidth = "calc(var(--unit) * 32)";
        el.style.minHeight = "calc(var(--unit) * 32.5)";
        //el.style.maxWidth = "50vw";
        //el.style.maxHeight = "50vh";
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
        wrapper.classList.add("attack-focus-menu", "reveal");
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
        el.dataset.attackType = attackType
        if (attackType == "particle") {
            el.style.backgroundImage = `url("./source/particle-attack-icon.png")`;
            
        } else {
            el.style.backgroundImage = `url("./source/blank-attack-icon.png")`;
        }
        el.style.maxWidth = "25vw";
        el.style.maxHeight = "25vw";
        // actual dims = 500x500 px
        el.style.width = "calc(var(--unit) * 10)";
        el.style.height = "calc(var(--unit) * 10)";

        return el;
    }
};

const AttackBarMenu = {
    createMenuElement: function (...elements) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("attack-bar-menu");
        // hard coded- needs to be updated if tile asset changes.
        wrapper.style.minWidth = "calc(var(--unit) * 10)";
        wrapper.style.minHeight = "calc(var(--unit) * 10)";
        elements.forEach(el => wrapper.appendChild(el));
        return wrapper;
    }
};

const GenericElement = {
    buttonMenu: function (...elements) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("button-menu", "pointer-events");
        elements.forEach(el => wrapper.appendChild(el));
        wrapper.style.maxWidth = "6rem";
        wrapper.dataset.ogWidth = "6rem";
        wrapper.dataset.ogHeight = "auto";
        return wrapper;
    },
    button: function (text, action = () => {}) {
        const el = document.createElement("button");
        el.classList.add("button", "pointer-events");
        el.style.height = "3rem";
        el.style.width = "6rem";
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
            const menuEl = document.querySelector(".button-menu");
            const isActive = hideEl.dataset.active == "false";
            menuEl.querySelectorAll(":scope > *:not(#hideTestButtons)").forEach(el => {
                el.style.visibility = isActive ? "hidden" : "visible";
            })
            menuEl.style.width = isActive ? el.style.width : menuEl.dataset.ogWidth;
            menuEl.style.height = isActive ? el.style.height : menuEl.dataset.ogHeight;
            hideEl.dataset.active = isActive ? "true" : "false";
            hideEl.innerText = isActive ? "<" : ">";
        });
        return el;
    },
    textBox: function () {
        const el = document.createElement("textarea");
        el.classList.add("pointer-events");
        el.id = "textBox";
        el.rows = 5;
        el.cols = 40;
        el.style.height = "3rem";
        el.style.width = "6rem";
        el.placeholder = "Paste layouts here";
        return el;
    }
};

const GenericSprite = {
    createFocusGlow: function () {
        const map = new TextureLoader().load('./source/selection-glow.png');
        const spriteMaterial = new SpriteMaterial({
            map: map,
            transparent: true,
            depthTest: true, // compare against depth buffer
            depthWrite: false
        });
        const sprite = new Sprite(spriteMaterial);
        sprite.renderOrder = -1;
        sprite.scale.set(3.5, 3.5, 3.5);
        sprite.userData.ogScale = sprite.scale.clone();
        return sprite;
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
        buttonMenu: undefined, // for debug, for now
        menu: undefined // the actual menu
    };
    this.sprite = {
        focusHighlight: undefined
    };
    this._initOverlay = function () { // must be implemented by extending classes
        self.sprite.focusHighlight = GenericSprite.createFocusGlow();
        self.sprite.focusHighlight.visible = false;
        self._scene.add(self.sprite.focusHighlight);
    }
    this._createFocusMenuElement = function () { // must be implemented by extending classes

    }
    this.update = function () { // must be implemented by extending classes
        self._updateFocusHighlight();
    }
    this._updateFocusHighlight = function (scaleRange = [5, 20], clampScale = [0.25, 0.85]) {
        if (self.state.focusedNode && !self.state.inMenu) {
            const nodePos = self._nodeManager.getNode(self.focusedNodeId).position;
            const direction = self._nodeManager.getCameraDirection(self.focusedNodeId);
            if (!nodePos.equals(self.sprite.focusHighlight.position)) {
                self.sprite.focusHighlight.position.copy(
                    nodePos.clone()
                        .sub(
                            direction
                                // approx radius of object. Since it's fine to overshoot, save on performance by hardcoding the offset, instead of calculating the node's bounding box every time this is called.
                                // at time of writing, most node diameters do not exceed 1. Will need to modify scale proportinally if offset is increased.
                                .multiplyScalar(1.5)
                ));
            }
        }
    }
    this._destroyMenu = function () {
        self.element._overlay.removeChild(self.element.menu);
        self.element.menu = undefined;
    }
    this._createMenu = function () {
        return Menu.createMenu(self.closeMenu,
            [
                Menu.createButton("locked-flipped", {
                    click: (event) => {
                        Logger.log("clicked");
                    }
                }),
                Menu.createButton("locked-flipped", {
                    click: (event) => {
                        Logger.log("clicked");
                    }
                }),
            ],
            [
                Menu.createButton("blank-flipped", {
                    click: (event) => {
                        Logger.log("clicked");
                    }
                }),
                Menu.createButton("blank-flipped", {
                    click: (event) => {
                        Logger.log("clicked");
                    }
                }),
            ],
            [
                Menu.createButton("blank", {
                    click: (event) => {
                        Logger.log("clicked");
                    }
                }),
                Menu.createButton("locked", {
                    click: (event) => {
                        Logger.log("clicked");
                    }
                }),
            ],
            [
                Menu.createButton("locked", {
                    click: (event) => {
                        Logger.log("clicked");
                    }
                }),
                Menu.createButton("blank", {
                    click: (event) => {
                        Logger.log("clicked");
                    }
                }),
            ],
        );
    }
    this.closeMenu = function () {
        self.state.inMenu = false;
        self._destroyMenu();
        Logger.debug("[OverlayManager] | Closed Menu");
    }
    this.openMenu = function () {
        self.state.inMenu = true;
        self.element.menu = self._createMenu();
        self.element._overlay.appendChild(self.element.menu);
        Logger.debug("[OverlayManager] | Opened Menu");
    }
    this._addOverlayElement = function () {

    }
    this._removeOverlayElement = function () {

    }
    this.focusNode = function (nodeid) {
        if (!self.state.stopFocusing) {
            self.unfocusNode();
            self.focusedNodeId = nodeid;
            self._updateFocusHighlight();

            const nodeScale = self._nodeManager.getNode(self.focusedNodeId).scale;
            self.sprite.focusHighlight.scale.copy(self.sprite.focusHighlight.userData.ogScale);
            self.sprite.focusHighlight.scale.multiplyScalar(nodeScale.x);

            self.sprite.focusHighlight.visible = true;
        }
    }
    this.unfocusNode = function () {
        if (self.state.focusedNode && !self.state.keepFocus) {
            self.focusedNodeId = undefined;
            self.sprite.focusHighlight.visible = false;
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
            if (!key.startsWith("_") && element != undefined) {
                self.element._overlay.removeChild(element);
                self.element[key] = undefined;
            }
        });
        Object.entries(self.sprite).forEach(([key, sprite]) => {
            if (!key.startsWith("_") && sprite != undefined) {
                self._scene.remove(sprite);
                sprite.material.dispose();
                sprite.geometry.dispose();
                self.sprite[key] = undefined;
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
    const Overloaded = {
        update: self.update,
        focusNode: self.focusNode,
        unfocusNode: self.unfocusNode,
        initOverlay: self._initOverlay
    };
    self._initOverlay = function () {
        Overloaded.initOverlay();
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
            }),
            GenericElement.button("Dump Node Info", function () {
                Logger.log(self._nodeManager);
            }),
            GenericElement.button("Dump Overlay Info", function () {
                Logger.log(self);
            }),
            GenericElement.button("Dump Mouse Info", function () {
                Logger.log(self._mouseManager);
            }),
            GenericElement.button("Open Menu", function () {
                self.openMenu();
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
        if (self.state.focusedNode && !self.state.inMenu) {
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
    self.focusNode = function (nodeid) {
        if (!self.state.stopFocusing) {
            Overloaded.focusNode(nodeid);
            self.element.focusMenu = self._createFocusMenuElement();
            self._updateFocusMenu();
            self.element._overlay.appendChild(self.element.focusMenu);
            redrawElement(self.element.focusMenu); // force redraw of element i.e. triggers the transition effect we want
            self.element.focusMenu.classList.add("show");
        }
    }
    self.unfocusNode = function () {
        if (self.state.focusedNode && !self.state.keepFocus) {
            Overloaded.unfocusNode();
            const oldElement = self.element.focusMenu;
            self.element.focusMenu = undefined;
            redrawElement(oldElement);
            oldElement.classList.add("hide");
            oldElement.addEventListener("transitionend", function (event) {
                oldElement.remove();
            }, { once: true});
        }
    }
    self.update = function () {
        Overloaded.update();
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
    const Overloaded = {
        update: self.update,
        focusNode: self.focusNode,
        unfocusNode: self.unfocusNode,
        initOverlay: self._initOverlay
    };
    self._initOverlay = function () {
        Overloaded.initOverlay();
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
            }),
            GenericElement.button("Dump Node Info", function () {
                Logger.log(self._nodeManager);
            }),
            GenericElement.button("Dump Overlay Info", function () {
                Logger.log(self);
            }),
            GenericElement.button("Dump Mouse Info", function () {
                Logger.log(self._mouseManager);
            }),
            GenericElement.button("Open Menu", function () {
                self.openMenu();
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
            Overloaded.focusNode(nodeid);
            self.element.focusMenu = self._createFocusMenuElement();
            self.element._overlay.appendChild(self.element.focusMenu);
            redrawElementChildren(self.element.focusMenu); // force redraw of element i.e. triggers the transition effect we want
            setTimeout(() => {
                self.element.focusMenu.classList.add("show")
                //redrawElementChildren(self.element.focusMenu);
            }, 0);
        }
    }
    self.unfocusNode = function () {
        if (self.state.focusedNode && !self.state.keepFocus) {
            Overloaded.unfocusNode();
            const oldElement = self.element.focusMenu;
            self.element.focusMenu = undefined;
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
        Overloaded.update();
        if (
            self.state.focusedNode &&
            String(self._nodeManager.getNodeData(self.focusedNodeId).attackers[0].type) != self.element.focusMenu.children[0].dataset.attackType
        )
            self._updateFocusMenu();
    }
    self._createFocusMenuElement = function () {
        return AttackFocusMenu.createMenuElement(...self._loadTilesForNode());
    }

    return self;
}