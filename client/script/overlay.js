import * as UTIL from "./utils.js";
import {
    Sprite,
    SpriteMaterial,
    TextureLoader
} from "three";

const zoomScaleFormula = (zoom, maxZoom) => {
    return 1/(
        1 + (Math.E**(-0.5*( zoom-(maxZoom/2.5) )))
    );
};

const BuildFocusMenu = {
    createMenuElement: function(linkButtonAction, infoButtonAction) {
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
        wrapper.style.maxWidth = "12rem";
        wrapper.dataset.ogWidth = "12rem";
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

const Button = { // unlikke some of the others, this is for buttons making it to prod!
    mainMenu: function (openMenuCallback = () => {}) {
        const el = document.createElement("div");
        el.classList.add("corner-button", "button", "pointer-events");
        el.style.height = "calc(var(--unit) * 10)";
        el.style.width = "calc(var(--unit) * 10)";
        el.style.backgroundImage = `url("./source/menu-corner-button.png")`;
        el.addEventListener("click", function (event) {
            openMenuCallback();
        });
        el.addEventListener("contextmenu", function (event) {
            event.preventDefault();
        });
        return el;
    }
};

export function OverlayManager(
    scene,
    renderer,
    camera,
    raycaster,
    overlayContainerElement,
    menuManager,
    scaleFormula = zoomScaleFormula,
) {
    this._scene = scene;
    this._renderer = renderer;
    this._camera = camera;
    this._raycaster = raycaster;
    this._menuManager = menuManager;
    this._scaler = scaleFormula;
    this.element._overlay = overlayContainerElement;
    Object.getOwnPropertyNames(Object.getPrototypeOf(this)).filter(prop => prop !== "constructor" && typeof this[prop] === "function").forEach(prop => {
        this[prop] = this[prop].bind(this);
    });
    this._initState();
    if (
        Object.getPrototypeOf(this) === OverlayManager.prototype // don't reinitalize these when subclassing
        && this._constructorArgs.some(arg => arg === undefined)
    ) {
        this._menuManager.init();
        this._initOverlay();
    }
}
OverlayManager.prototype = {
    _scene: undefined,
    _camera: undefined,
    _renderer: undefined,
    _raycaster: undefined,
    _menuManager: undefined,
    _nodeManager: undefined,
    _mouseManager: undefined,
    _scaler: undefined,
    _controls: undefined,
    focusedNodeId: undefined,
    get _constructorArgs () {
        return [
            this._scene,
            this._renderer,
            this._camera,
            this._raycaster,
            this.element?._overlay,
            this._menuManager,
        ];
    }
};
OverlayManager.prototype.element =  {
    _overlay: undefined,
    focusMenu: undefined, // better to destroy node overlay when unused vs hide it, since rendering everything is gonna take a bunch of memory anyways...
    buttonMenu: undefined, // for debug, for now
    menuButton: undefined, // the actual menu
};
OverlayManager.prototype.sprite =  {
    focusHighlight: undefined
};
OverlayManager.prototype.init =  function (controls, managers) {
    this._nodeManager = managers.Node;
    this._mouseManager = managers.Mouse;
    this._controls = controls;
};
OverlayManager.prototype._initState = function () {
    const self = this;
    this.state = {
        targeting: false,
        get inMenu() {
            return self._menuManager.state.open;
        },
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
};
OverlayManager.prototype._initOverlay = function () {
    this.sprite.focusHighlight = GenericSprite.createFocusGlow();
    this.sprite.focusHighlight.visible = false;
    this._scene.add(this.sprite.focusHighlight);
    this.element.menuButton = Button.mainMenu(() => this._menuManager.open());
    this.element._overlay.appendChild(
        this.element.menuButton
    );
};
OverlayManager.prototype.update =  function () { // must be implemented by extending classes
    this._updateFocusHighlight();
};
OverlayManager.prototype._updateFocusHighlight = function () {
    if (this.state.focusedNode && !this.state.inMenu) {
        const nodePos = this._nodeManager.getNode(this.focusedNodeId).position;
        const direction = this._nodeManager.getCameraDirection(this.focusedNodeId);
        if (!nodePos.equals(this.sprite.focusHighlight.position)) {
            this.sprite.focusHighlight.position.copy(
                nodePos.clone()
                    .sub(
                        direction
                            // approx radius of object. Since it's fine to overshoot, save on performance by hardcoding the offset, instead of calculating the node's bounding box every time this is called.
                            // at time of writing, most node diameters do not exceed 1. Will need to modify scale proportinally if offset is increased.
                            .multiplyScalar(1.5)
            ));
        }
    }
};
OverlayManager.prototype.focusNode =  function (nodeid) {
    if (!this.state.stopFocusing) {
        this.unfocusNode();
        this.focusedNodeId = nodeid;
        this._updateFocusHighlight();

        const nodeScale = this._nodeManager.getNode(this.focusedNodeId).scale;
        this.sprite.focusHighlight.scale.copy(this.sprite.focusHighlight.userData.ogScale);
        this.sprite.focusHighlight.scale.multiplyScalar(nodeScale.x);

        this.sprite.focusHighlight.visible = true;
    }
};
OverlayManager.prototype.unfocusNode =  function () {
    if (this.state.focusedNode && !this.state.keepFocus) {
        this.focusedNodeId = undefined;
        this.sprite.focusHighlight.visible = false;
    }
};
OverlayManager.prototype.closeMenu =  function () {
    Logger.debug("[OverlayManager] | Closed Menu");
};
OverlayManager.prototype.openMenu =  function () {
    this.unfocusNode();
    Logger.debug("[OverlayManager] | Opened Menu");
};
OverlayManager.prototype.clear =  function () {
    Object.entries(this.element).forEach(([key, element]) => {
        if (!key.startsWith("_") && element != undefined) {
            try {
                this.element._overlay.removeChild(element);
                this.element[key] = undefined;
            } catch (err) {
                Logger.warn(`[OverlayManager] | Failed to remove ${key} element: `, element, "\n\tDetail: ", err);
            }
        }
    });
    Object.entries(this.sprite).forEach(([key, sprite]) => {
        if (!key.startsWith("_") && sprite != undefined) {
            try {
                this._scene.remove(sprite);
                sprite.material.dispose();
                sprite.geometry.dispose();
                this.sprite[key] = undefined;
            } catch (err) {
                Logger.warn(`[OverlayManager] | Failed to remove ${key} sprite: `, sprite);
                Logger.error(err);
            }
        }
    });
    Object.entries(Object.getOwnPropertyDescriptors(this.state))
        .filter(([, desc]) => desc.value && typeof desc.value !== 'function')
        .forEach(([key]) => this.state[key] = false);
    this.focusedNodeId = undefined;
    this._menuManager.loadMenu.clear();
    this._menuManager.clearListeners();
};

export function BuildOverlayManager(...parentArgs) { // laziness
    OverlayManager.call(this, ...parentArgs);
}
BuildOverlayManager.prototype = Object.create(OverlayManager.prototype);
BuildOverlayManager.prototype.constructor = BuildOverlayManager;
BuildOverlayManager.prototype._createFocusMenuElement =  function () {
    return BuildFocusMenu.createMenuElement(
        () => { // link button
            if (!this.state.targeting) {
                this._nodeManager.highlightNode(this.focusedNodeId);
                this.state.targeting = true;
                this._mouseManager.getNextEvent("clicked").then(event => {
                    if (this.state.targeting) {
                        const nodeid = this._nodeManager.getNodeFromFlatCoordinate(this._mouseManager.position);
                        // [!] ugly as hell
                        if (nodeid) {
                            if (nodeid == this.focusedNodeId) { // selected this, remove all tethers
                                this._nodeManager.untetherNode(nodeid);
                                Logger.log("detached node");
                            } else {
                                const tetherid = this._nodeManager.isNeighbor(nodeid, this.focusedNodeId);
                                if (tetherid) { // selected neighbor, remove tether
                                    this._nodeManager.removeTether(tetherid);
                                    Logger.log("unlinked nodes");
                                } else { // selected untethered node, create new tether
                                    this._nodeManager.tetherNodes(this.focusedNodeId, nodeid);
                                    Logger.log("interlinked");
                                }
                            }
                        } else { // nothing selected
                            Logger.log("didnt link :(");
                        }
                        this._nodeManager.unhighlightNode(this.focusedNodeId);
                        this.state.targeting = false;
                        this.unfocusNode();
                    }
                });
                Logger.log("looking to link");
            }
        },
        () => { // info button
            const node = this._nodeManager.getNode(this.focusedNodeId);
            Logger.log(node);
        }
    );
};
BuildOverlayManager.prototype._updateFocusMenu =  function (scaleRange = [5, 20], clampScale = [0.25, 0.85]) {
    if (this.state.focusedNode && !this.state.inMenu) {
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
};
BuildOverlayManager.prototype.focusNode =  function (nodeid) {
    if (!this.state.stopFocusing) {
        this.unfocusNode();
        OverlayManager.prototype.focusNode.call(this, nodeid);
        this.element.focusMenu = this._createFocusMenuElement();
        this._updateFocusMenu();
        this.element._overlay.appendChild(this.element.focusMenu);
        UTIL.redrawElement(this.element.focusMenu); // force redraw of element i.e. triggers the transition effect we want
        this.element.focusMenu.classList.add("show");
    }
};
BuildOverlayManager.prototype.unfocusNode =  function () {
    if (this.state.focusedNode && !this.state.keepFocus) {
        OverlayManager.prototype.unfocusNode.call(this);
        const oldElement = this.element.focusMenu;
        UTIL.redrawElement(oldElement);
        oldElement.classList.add("hide");
        oldElement.addEventListener("transitionend", function (event) {
            oldElement.remove();
        }, { once: true});
    }
};
BuildOverlayManager.prototype.update =  function () {
    OverlayManager.prototype.update.call(this);
    this._updateFocusMenu();
};
BuildOverlayManager.prototype.init =  function (...args) {
    OverlayManager.prototype.init.call(this, ...args);
    this._menuManager.when("addnode", (detail) => {
        this._nodeManager.createNode(detail.nodeType, Array.from({length: 3}, _ => UTIL.random(0.001, 0.002))); // generate random offset so repulsion forces can take effect
        this._menuManager.close();
    });
    this._initOverlay();
};
export function AttackOverlayManager(attackManager, ...parentArgs) {
    OverlayManager.call(this, ...parentArgs);
    this._attackManager = attackManager;
    this.element.attackBarMenu = undefined;
}
AttackOverlayManager.prototype = Object.create(OverlayManager.prototype);
AttackOverlayManager.prototype.constructor = AttackOverlayManager;
AttackOverlayManager.prototype._initOverlay =  function () {
    OverlayManager.prototype._initOverlay.call(this);    
    // create attack bar menu
    const attackTiles = Array.from(this._attackManager.attacks, (attack) => {
        const tile = AttackFocusMenu.createTileElement(attack.type);
        tile.addEventListener("click", (event) => {
            if (this.state.focusedNode && this._nodeManager.getNodeData(this.focusedNodeId)?.isFriendly) {
                this._nodeManager.addAttackToNode(attack.type, this.focusedNodeId);
                this._updateFocusMenu();
            }
        });
        return tile;
    });
    this.element.attackBarMenu = AttackBarMenu.createMenuElement(...attackTiles);

    this.element._overlay.appendChild(this.element.attackBarMenu);
};
AttackOverlayManager.prototype._updateFocusMenu =  function () {
    if (this.state.focusedNode) {
        while (this.element.focusMenu.firstChild) {
            this.element.focusMenu.removeChild(this.element.focusMenu.firstChild);
        }
        this._loadTilesForNode().forEach(el => this.element.focusMenu.appendChild(el));
    }
};
AttackOverlayManager.prototype._loadTilesForNode =  function () {
    const nodeData = this._nodeManager.getNodeData(this.focusedNodeId);
    const attackerTiles = Array.from(
            nodeData.slots,
            ({type}) => AttackFocusMenu.createTileElement(type)
    )
    attackerTiles.forEach((el, i) => 
        el.addEventListener("click", (e) => {
            nodeData.slots.pop(i);
            this._updateFocusMenu();
        }, {once: true})
    );
    return attackerTiles;
};
AttackOverlayManager.prototype.focusNode =  function (nodeid) {
    if (!this.state.stopFocusing) {
        this.unfocusNode();
        OverlayManager.prototype.focusNode.call(this, nodeid);
        this.element.focusMenu = this._createFocusMenuElement();
        this.element._overlay.appendChild(this.element.focusMenu);
        UTIL.redrawElement(this.element.focusMenu); // force redraw of element i.e. triggers the transition effect we want
        setTimeout(() => {
            this.element.focusMenu.classList.add("show")
        }, 0);
    }
};
AttackOverlayManager.prototype.unfocusNode =  function () {
    if (this.state.focusedNode && !this.state.keepFocus) {
        OverlayManager.prototype.unfocusNode.call(this);
        const oldElement = this.element.focusMenu;
        UTIL.redrawElement(oldElement);
        oldElement.classList.add("hide");
            // animation is staggered, so need to wait for all children to finish
        let countdown = oldElement.children.length;
        oldElement.addEventListener("transitionend", function (event) {
            if (--countdown <= 0)
                oldElement.remove();
        });
    }
};
AttackOverlayManager.prototype.update =  function () {
    OverlayManager.prototype.update.call(this);
    if (
        this.state.focusedNode &&
        String(this._nodeManager.getNodeData(this.focusedNodeId).slots[0].type) != this.element.focusMenu.children[0].dataset.attackType
    )
        this._updateFocusMenu();
};
AttackOverlayManager.prototype._createFocusMenuElement =  function () {
    return AttackFocusMenu.createMenuElement(...this._loadTilesForNode());
};
AttackOverlayManager.prototype.init =  function (...args) {
    OverlayManager.prototype.init.call(this, ...args);
    this._menuManager.when("addnode", (detail) => {
        Logger.alert(`Failed to add node (${detail.nodeType}): Cannot add nodes outside of build phase!`);
    });
    this._initOverlay();
};
