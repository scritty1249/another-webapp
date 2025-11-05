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

        const linkButton = this.createLinkButton();
        el.appendChild(linkButton);
        const infoButton = this.createInfoButton();
        el.appendChild(infoButton);
        const addButton = this.createAddButton();
        el.appendChild(addButton);

        // make buttons work
        linkButton.addEventListener("click", function (event) {
            linkButtonAction();
        });
        addButton.addEventListener("click", function (event) {
            addButtonAction();
        });
        infoButton.addEventListener("click", function (event) {
            infoButtonAction();
        });

        return el;
    },
    createLinkButton: function() {
        const el = document.createElement("div");
        el.classList.add("button", "pointer-events");
        el.dataset.buttonType = "link";
        el.style.backgroundImage = `url("./source/link-button.png")`;
        el.style.width = "182px";
        el.style.height = "55px";
        el.style.setProperty("--left", "101px");
        el.style.setProperty("--top", "104px");
        
        return el;
    },
    createInfoButton: function() {
        const el = document.createElement("div");
        el.classList.add("button", "pointer-events");
        el.dataset.buttonType = "info";
        el.style.backgroundImage = `url("./source/info-button.png")`;
        el.style.width = "172px";
        el.style.height = "175px";
        el.style.setProperty("--left", "215px");
        el.style.setProperty("--top", "207px");
        
        return el;
    },
    createAddButton: function() {
        const el = document.createElement("div");
        el.classList.add("button", "pointer-events");
        el.dataset.buttonType = "add";
        el.style.backgroundImage = `url("./source/add-button.png")`;
        el.style.width = "121px";
        el.style.height = "125px";
        el.style.setProperty("--left", "343px");
        el.style.setProperty("--top", "155px");
        
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
    this._createFocusMenuElement = function () {
        const maxNodeDistance = 3; // arbitrary
        return FocusMenu.createMenuElement(
            function linkButtonAction() {
                if (!self.state.linking) {
                    self._nodeManager.highlightNode(self.focusedNodeId);
                    self.state.linking = true;
                    self._mouseManager.getNextEvent("clicked").then(event => {
                        const nodeid = self._nodeManager.getNodeFromFlatCoordinate(self._mouseManager.position);
                        if (nodeid) {
                            self._nodeManager.tetherNodes(self.focusedNodeId, nodeid);
                            console.log("interlinked");
                        } else {
                            console.log("didnt link :(");
                        }
                        self._nodeManager.unhighlightNode(self.focusedNodeId);
                        self.state.linking = false;
                    });
                    console.log("looking to link");
                }
            },
            function addButtonAction() {
                const node = self._nodeManager.getNode(self.focusedNodeId);
                self._nodeManager.createNode("cube", [self.focusedNodeId], [
                    node.position.x + UTIL.random(-maxNodeDistance/1.5, maxNodeDistance/1.5),
                    node.position.y + UTIL.random(-maxNodeDistance/1.5, maxNodeDistance/1.5),
                    node.position.z + UTIL.random(-maxNodeDistance/1.5, maxNodeDistance/1.5)
                ]);
            },
            function infoButtonAction() {
                const node = self._nodeManager.getNode(self.focusedNodeId);
                console.log(node);
                console.log(self._nodeManager);
                console.log(UTIL.layoutToJson(self._nodeManager.nodelist));
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
    this.focusNode = function (nodeid) {
        if (!self.state.stopFocusing) {
            this.unfocusNode();
            this.element.focusMenu = this._createFocusMenuElement();
            this.focusedNodeId = nodeid;
            this._updateFocusMenu();
            this.element._overlay.appendChild(this.element.focusMenu);
        }
    }
    this.unfocusNode = function () {
        if (self.state.focusedNode) {
            this.element.focusMenu.remove();
            this.element.focusMenu = undefined; // release- idk how js garbage collection works? or if it even exists for this bum language?
            this.focusedNodeId = undefined;
        }
    }
    this.update = function () {
        this._updateFocusMenu();
    }
    return this;
}