import * as UTIL from "./utils.js";

const zoomScaleFormula = (zoom, maxZoom) => {
    return 1/(
        1 + (Math.E**(-0.5*( zoom-(maxZoom/2.5) )))
    );
};

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

const OverlayWidgets = {
    createButtonMenu: function (loadLayoutAction, saveLayoutAction, shareLayoutAction, clearLayoutAction) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("button-menu");
        const textBox = this.textBox();
        const layoutButton = this.loadLayoutButton(loadLayoutAction);
        const saveButton = this.saveLayoutButton(saveLayoutAction);
        const shareButton = this.shareLayoutButton(shareLayoutAction);
        const clearButton = this.clearLayoutButton(clearLayoutAction);
        wrapper.appendChild(textBox);
        wrapper.appendChild(layoutButton);
        wrapper.appendChild(saveButton);
        wrapper.appendChild(shareButton);
        wrapper.appendChild(clearButton);
        return wrapper;
    },
    textBox: function () {
        const el = document.createElement("textarea");
        el.classList.add("pointer-events");
        el.id = "textBox";
        el.rows = 5;
        el.cols = 40;
        el.placeholder = "Paste layouts here";
        return el;
    },
    loadLayoutButton: function (loadLayoutAction) {
        const el = document.createElement("button");
        el.classList.add("button", "pointer-events");
        el.style.height = "4rem";
        el.style.width = "10rem";
        el.innerText = "load";
        el.addEventListener("click", function (event) {
            loadLayoutAction();
        });
        return el;
    },
    saveLayoutButton: function (saveLayoutAction) {
        const el = document.createElement("button");
        el.classList.add("button", "pointer-events");
        el.style.height = "4rem";
        el.style.width = "10rem";
        el.innerText = "save";
        el.addEventListener("click", function (event) {
            saveLayoutAction();
        });
        return el;
    },
    shareLayoutButton: function (shareLayoutAction) {
        const el = document.createElement("button");
        el.classList.add("button", "pointer-events");
        el.style.height = "4rem";
        el.style.width = "10rem";
        el.innerText = "SAVE INFO FOR DEV";
        el.addEventListener("click", function (event) {
            shareLayoutAction();
        });
        return el;
    },
    clearLayoutButton: function (clearLayoutAction) {
        const el = document.createElement("button");
        el.classList.add("button", "pointer-events");
        el.style.height = "4rem";
        el.style.width = "10rem";
        el.innerText = "clear";
        el.addEventListener("click", function (event) {
            clearLayoutAction();
        });
        return el;
    }
}

export function OverlayManager(
    scene,
    renderer,
    camera,
    raycaster,
    mouseManager,
    nodeManager,
    overlayContainerElement,
    scaleFormula = zoomScaleFormula,
) {
    const self = this;
    this._scene = scene;
    this._camera = camera;
    this._renderer = renderer;
    this._raycaster = raycaster;
    this._nodeManager = nodeManager;
    this._mouseManager = mouseManager;
    this._scaler = scaleFormula;
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
        focusMenu: undefined // better to destroy node overlay when unused vs hide it, since rendering everything is gonna take a bunch of memory anyways...
    };
    this._initOverlay = function () {
        const el = OverlayWidgets.createButtonMenu(
            function e() {
                const textBox = document.getElementById("textBox");
                const result = UTIL.layoutFromJson(textBox.value.trim(), self._scene, self._nodeManager);
                textBox.value = "";
                if (!result)
                    alert("Failed to load layout. Was the wrong format entered?");
            },
            function e() {
                const data = UTIL.layoutToJson(self._scene, self._nodeManager);
                navigator.clipboard.writeText(data);
                alert("Layout copied to clipboard");
            },
            function e() {
                const layoutData = UTIL.layoutToJson(self._scene, self._nodeManager, false);
                const domData = document.documentElement.outerHTML;
                Logger.log("Generating debug file for download");
                UTIL.download(
                    (new Date()).toISOString() + ".txt",
                    `===[LAYOUT]===\n${layoutData}\n===[DOM]===\n${domData}\n===[CONSOLE]===\n${Logger.history}\n`
                );
            },
            function () {
                window.location.assign(window.location.origin + window.location.pathname);
            }
        );
        this.element._overlay.appendChild(el);
    }
    this._createFocusMenuElement = function () {
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
    this._updateFocusMenu = function (scaleRange = [5, 20], clampScale = [0.25, 0.85]) {
        if (this.focusedNodeId != undefined) {
            const positionData = this._nodeManager.getFlatCoordinateFromNode(this.focusedNodeId);
            const scale = UTIL.clamp(this._scaler(
                scaleRange[1] - UTIL.clamp(positionData.distance, scaleRange[0], scaleRange[1]),
                scaleRange[1]
            ), clampScale[0], clampScale[1]);
            // Adjust translation proportionally to scale- compensate for newly empty space
            const x = positionData.x - ((this.element.focusMenu.clientWidth - (this.element.focusMenu.clientWidth * scale)) / 2);
            const y = positionData.y; 
            this.element.focusMenu.style.setProperty("--x", `${x}px`);
            this.element.focusMenu.style.setProperty("--y", `${y}px`);
            this.element.focusMenu.style.setProperty("--scale", scale);
        }
    }
    this._addOverlayElement = function () {

    }
    this._removeOverlayElement = function () {
        
    }
    this.focusNode = function (nodeid) {
        if (!self.state.stopFocusing) {
            this.unfocusNode();
            this.element.focusMenu = this._createFocusMenuElement();
            this.focusedNodeId = nodeid;
            this._updateFocusMenu();
            this.element._overlay.appendChild(this.element.focusMenu);
            void(this.element.focusMenu.offsetHeight); // force redraw of element i.e. triggers the transition effect we want
            self.element.focusMenu.classList.add("show");
        }
    }
    this.unfocusNode = function () {
        if (self.state.focusedNode && !self.state.keepFocus) {
            const oldElement = self.element.focusMenu;
            self.element.focusMenu = undefined;
            this.focusedNodeId = undefined;
            void(oldElement.offsetHeight);
            oldElement.classList.add("hide");
            void(oldElement.offsetHeight);
            oldElement.addEventListener("transitionend", function (event) {
                event.target.remove();
            }, { once: true });
        }
    }
    this.update = function () {
        this._updateFocusMenu();
    }

    this._initOverlay();
    return this;
}