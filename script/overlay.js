import * as UTIL from "./utils.js";
import { Sprite, SpriteMaterial, TextureLoader } from "three";

const zoomScaleFormula = (zoom, maxZoom) => {
    return 1 / (1 + Math.E ** (-0.5 * (zoom - maxZoom / 2.5)));
};

const SelectHud = {
    createHud: function () {
        const wrapper = document.createElement("div");
        wrapper.classList.add("hud", "select");
        return wrapper;
    }
};

const BuildHud = {
    createHud: function () {
        const wrapper = document.createElement("div");
        wrapper.classList.add("hud", "build");

        const walletEl = document.createElement("div");
        walletEl.classList.add("wallet");
        const cashEl = this.createCashEl();
        const cryptoEl = this.createCryptoEl();
        walletEl.appendChild(cashEl);
        walletEl.appendChild(cryptoEl);

        wrapper.appendChild(walletEl);
        return wrapper;
    },
    createCashEl: function () {
        const el = document.createElement("div");
        el.innerText = "Cash: ---";
        el.dataset.currencyType = "cash";
        return el;
    },
    createCryptoEl: function () {
        const el = document.createElement("div");
        el.innerText = "Credit: ---";
        el.dataset.currencyType = "crypto";
        return el;
    },
};

const BuildFocusMenu = {
    createMenuElement: function (
        linkButtonAction,
        infoButtonAction,
        removeButtonAction
    ) {
        const el = document.createElement("div");
        el.classList.add("nodeMenu", "right", "reveal");
        // hard coded- needs to be updated if file changes.
        el.style.backgroundImage = `url("./source/node-overlay/focus/node-overlay-menu.png")`;
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
        const removeButton = this.createRemoveButton(removeButtonAction);
        el.appendChild(removeButton);

        return el;
    },
    createLinkButton: function (linkButtonAction) {
        const el = document.createElement("div");
        el.classList.add("button", "pointer-events");
        el.dataset.buttonType = "link";
        el.style.backgroundImage = `url("./source/node-overlay/focus/link-button.png")`;
        el.style.width = "182px";
        el.style.height = "55px";
        el.style.setProperty("--left", "101px");
        el.style.setProperty("--top", "104px");
        el.addEventListener("click", function (event) {
            linkButtonAction();
        });

        return el;
    },
    createInfoButton: function (infoButtonAction) {
        const el = document.createElement("div");
        el.classList.add("button", "pointer-events");
        el.dataset.buttonType = "info";
        el.style.backgroundImage = `url("./source/node-overlay/focus/info-button.png")`;
        el.style.width = "172px";
        el.style.height = "175px";
        el.style.setProperty("--left", "215px");
        el.style.setProperty("--top", "207px");
        el.addEventListener("click", function (event) {
            infoButtonAction();
        });

        return el;
    },
    createRemoveButton: function (removeButtonAction) {
        const el = document.createElement("div");
        el.classList.add("button", "pointer-events");
        el.dataset.buttonType = "remove";
        el.style.backgroundImage = `url("./source/node-overlay/focus/remove-button.png")`;
        el.style.width = "121px";
        el.style.height = "125px";
        el.style.setProperty("--left", "343px");
        el.style.setProperty("--top", "155px");
        el.addEventListener("click", function (event) {
            removeButtonAction();
        });

        return el;
    },
};

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
        el.dataset.attackType = attackType;
        if (attackType == "particle") {
            el.style.backgroundImage = `url("./source/particle-attack-icon.png")`;
        } else if (attackType !== undefined) {
            el.style.backgroundImage = `url("./source/unknown-attack-icon.png")`;
        } else {
            el.style.backgroundImage = `url("./source/blank-attack-icon.png")`;
        }
        el.style.maxWidth = "25vw";
        el.style.maxHeight = "25vw";
        // actual dims = 500x500 px
        el.style.width = "calc(var(--unit) * 10)";
        el.style.height = "calc(var(--unit) * 10)";

        return el;
    },
};

const AttackHud = {
    createHud: function (targetName, attackBarTiles) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("hud", "attack");
        const bar = this.createBar(...attackBarTiles);
        const nametag = this.createTargetNameTag(targetName);

        wrapper.appendChild(nametag);
        wrapper.appendChild(bar);
        return wrapper;
    },
    createBar: function (...tileElements) {
        const bar = document.createElement("div");
        bar.classList.add("bar");
        // hard coded- needs to be updated if tile asset changes.
        bar.style.minWidth = "calc(var(--unit) * 10)";
        bar.style.minHeight = "calc(var(--unit) * 10)";
        tileElements.forEach((el) => bar.appendChild(el));
        return bar;
    },
    createTargetNameTag: function (targetName) {
        const el = document.createElement("div");
        el.classList.add("target-name");
        el.innerText = `Target: ${targetName}`;
        return el;
    },
};

const GenericElement = {
    buttonMenu: function (...elements) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("button-menu", "pointer-events");
        elements.forEach((el) => wrapper.appendChild(el));
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
            menuEl
                .querySelectorAll(":scope > *:not(#hideTestButtons)")
                .forEach((el) => {
                    el.style.visibility = isActive ? "hidden" : "visible";
                });
            menuEl.style.width = isActive
                ? el.style.width
                : menuEl.dataset.ogWidth;
            menuEl.style.height = isActive
                ? el.style.height
                : menuEl.dataset.ogHeight;
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
    },
};

const GenericSprite = {
    createFocusGlow: function () {
        const map = new TextureLoader().load("./source/selection-glow.png");
        const spriteMaterial = new SpriteMaterial({
            map: map,
            transparent: true,
            depthTest: true, // compare against depth buffer
            depthWrite: false,
        });
        const sprite = new Sprite(spriteMaterial);
        sprite.renderOrder = -1;
        sprite.scale.set(3.5, 3.5, 3.5);
        sprite.userData.ogScale = sprite.scale.clone();
        return sprite;
    },
};

const Button = {
    // unlikke some of the others, this is for buttons making it to prod!
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
    },
};

export function OverlayManager(
    scene,
    renderer,
    camera,
    raycaster,
    overlayContainerElement,
    menuManager,
    scaleFormula = zoomScaleFormula
) {
    this._scene = scene;
    this._renderer = renderer;
    this._camera = camera;
    this._raycaster = raycaster;
    this._menuManager = menuManager;
    this._scaler = scaleFormula;
    this.element._overlay = overlayContainerElement;
    Object.getOwnPropertyNames(Object.getPrototypeOf(this))
        .filter(
            (prop) => prop !== "constructor" && typeof this[prop] === "function"
        )
        .forEach((prop) => {
            this[prop] = this[prop].bind(this);
        });
    this._initState();
    if (
        Object.getPrototypeOf(this) === OverlayManager.prototype && // don't reinitalize these when subclassing
        this._constructorArgs.some((arg) => arg === undefined)
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
    get _constructorArgs() {
        return [
            this._scene,
            this._renderer,
            this._camera,
            this._raycaster,
            this.element?._overlay,
            this._menuManager,
        ];
    },
};
OverlayManager.prototype.element = {
    _overlay: undefined,
    focusMenu: undefined, // better to destroy node overlay when unused vs hide it, since rendering everything is gonna take a bunch of memory anyways...
    buttonMenu: undefined, // for debug, for now
    menuButton: undefined, // the actual menu
    hud: undefined, // phase specific, should always be implemented
};
OverlayManager.prototype.sprite = {
    focusHighlight: undefined,
};
OverlayManager.prototype.init = function (controls, managers) {
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
        },
    };
};
OverlayManager.prototype._initOverlay = function () {
    this.sprite.focusHighlight = GenericSprite.createFocusGlow();
    this.sprite.focusHighlight.visible = false;
    this._scene.add(this.sprite.focusHighlight);
    this.element.menuButton = Button.mainMenu(() => this._menuManager.open());
    this.element._overlay.appendChild(this.element.menuButton);
};
OverlayManager.prototype.messagePopup = function (message, expiresMs = 3000) {
    if (this.element.hud) {
        const popup = this._menuManager.createElement.textBox(message, true, true, false);
        popup.classList.add("notification");
        this.element.hud.appendChild(popup);
        const timer = setTimeout(() => {
            popup.remove();
        }, expiresMs);
        popup.addEventListener("click", (e) => {
            clearTimeout(timer);
            popup.remove();
            Logger.info(`[OverlayManager] | Click-removed notification: "${message}"`);
        }, { once: true });
        Logger.log(`[OverlayManager] | Notification: "${message}"`);
        return popup;
    } else {
        Logger.warn("[OverlayManager] | Failed to create message popup. HUD not initialized.");
        return undefined;
    }
};
OverlayManager.prototype.update = function () {
    // must be implemented by extending classes
    this._updateFocusHighlight();
};
OverlayManager.prototype._updateFocusHighlight = function () {
    if (this.state.focusedNode && !this.state.inMenu) {
        const nodePos = this._nodeManager.getNode(this.focusedNodeId).position;
        const direction = this._nodeManager.getCameraDirection(
            this.focusedNodeId
        );
        if (!nodePos.equals(this.sprite.focusHighlight.position)) {
            this.sprite.focusHighlight.position.copy(
                nodePos.clone().sub(
                    direction
                        // approx radius of object. Since it's fine to overshoot, save on performance by hardcoding the offset, instead of calculating the node's bounding box every time this is called.
                        // at time of writing, most node diameters do not exceed 1. Will need to modify scale proportinally if offset is increased.
                        .multiplyScalar(1.5)
                )
            );
        }
    }
};
OverlayManager.prototype.focusNode = function (nodeid) {
    if (!this.state.stopFocusing) {
        this.unfocusNode();
        this.focusedNodeId = nodeid;
        this._updateFocusHighlight();

        const nodeScale = this._nodeManager.getNode(this.focusedNodeId).scale;
        this.sprite.focusHighlight.scale.copy(
            this.sprite.focusHighlight.userData.ogScale
        );
        this.sprite.focusHighlight.scale.multiplyScalar(nodeScale.x);

        this.sprite.focusHighlight.visible = true;
    }
};
OverlayManager.prototype.unfocusNode = function () {
    if (this.state.focusedNode && !this.state.keepFocus) {
        this.focusedNodeId = undefined;
        this.sprite.focusHighlight.visible = false;
    }
};
OverlayManager.prototype.closeMenu = function () {
    Logger.debug("[OverlayManager] | Closed Menu");
};
OverlayManager.prototype.openMenu = function () {
    this.unfocusNode();
    Logger.debug("[OverlayManager] | Opened Menu");
};
OverlayManager.prototype.clear = function () {
    Object.entries(this.element).forEach(([key, element]) => {
        if (!key.startsWith("_") && element != undefined) {
            try {
                element.remove();
                this.element[key] = undefined;
            } catch (err) {
                Logger.warn(
                    `[OverlayManager] | Failed to remove ${key} element: `,
                    element,
                    "\n\tDetail: ",
                    err
                );
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
                Logger.warn(
                    `[OverlayManager] | Failed to remove ${key} sprite: `,
                    sprite
                );
                Logger.error(err);
            }
        }
    });
    Object.entries(Object.getOwnPropertyDescriptors(this.state))
        .filter(([, desc]) => desc.value && typeof desc.value !== "function")
        .forEach(([key]) => (this.state[key] = false));
    this.focusedNodeId = undefined;
    this._menuManager.loadMenu.clear();
    this._menuManager.clearListeners();
};

export function BuildOverlayManager(nodeMenuCallbacks, ...parentArgs) {
    // laziness
    OverlayManager.call(this, ...parentArgs);
    this._nodeMenuCallbacks = nodeMenuCallbacks;
}
BuildOverlayManager.prototype = Object.create(OverlayManager.prototype);
BuildOverlayManager.prototype.constructor = BuildOverlayManager;
BuildOverlayManager.prototype._createFocusMenuElement = function () {
    return BuildFocusMenu.createMenuElement(
        () => {
            // link button
            if (!this.state.targeting) {
                this.state.targeting = true;
                this._mouseManager.getNextEvent("clicked").then((event) => {
                    if (this.state.targeting) {
                        const nodeid =
                            this._nodeManager.getNodeFromFlatCoordinate(
                                this._mouseManager.position
                            );
                        // [!] ugly as hell
                        if (nodeid) {
                            if (nodeid == this.focusedNodeId) {
                                // selected this, remove all tethers
                                this._nodeManager.untetherNode(nodeid);
                                Logger.log("detached node");
                            } else {
                                const tetherid = this._nodeManager.isNeighbor(
                                    nodeid,
                                    this.focusedNodeId
                                );
                                if (tetherid) {
                                    // selected neighbor, remove tether
                                    this._nodeManager.removeTether(tetherid);
                                    Logger.log("unlinked nodes");
                                } else {
                                    // selected untethered node, create new tether
                                    const tethered = this._nodeManager.tetherNodes(
                                        this.focusedNodeId,
                                        nodeid
                                    );
                                    if (tethered)
                                        Logger.log("interlinked");
                                    else
                                        this.messagePopup("Node connection limit reached.", 1500);
                                }
                            }
                        } else {
                            // nothing selected
                            Logger.log("didnt link :(");
                        }
                        // this._nodeManager.unhighlightNode(this.focusedNodeId);
                        this.state.targeting = false;
                        this.unfocusNode();
                    }
                });
                Logger.log("looking to link");
                this._hideNodeMenu();
            }
        },
        () => {
            // info button
            if (!this.state.stopFocusing) {
                const node = this._nodeManager.getNode(this.focusedNodeId);
                Logger.info(node);
                this._nodeMenuCallbacks.nodeInfo(this.focusedNodeId);
            }
        },
        () => {
            // remove button
            if (!this.state.stopFocusing) {
                const nodeid = this.focusedNodeId;
                this.unfocusNode();
                this._nodeManager.removeNode(nodeid);
            }
        }
    );
};
BuildOverlayManager.prototype._updateFocusMenu = function (
    scaleRange = [5, 20],
    clampScale = [0.25, 0.85]
) {
    if (
        this.state.focusedNode &&
        !this.state.inMenu &&
        this.element?.focusMenu
    ) {
        const positionData = this._nodeManager.getFlatCoordinateFromNode(
            this.focusedNodeId
        );
        const scale = UTIL.clamp(
            this._scaler(
                scaleRange[1] -
                    UTIL.clamp(
                        positionData.distance,
                        scaleRange[0],
                        scaleRange[1]
                    ),
                scaleRange[1]
            ),
            clampScale[0],
            clampScale[1]
        );
        // Adjust translation proportionally to scale- compensate for newly empty space
        const x =
            positionData.x -
            (this.element.focusMenu.clientWidth -
                this.element.focusMenu.clientWidth * scale) /
                2;
        const y = positionData.y;
        this.element.focusMenu.style.setProperty("--x", `${x}px`);
        this.element.focusMenu.style.setProperty("--y", `${y}px`);
        this.element.focusMenu.style.setProperty("--scale", scale);
    }
};
BuildOverlayManager.prototype._showNodeMenu = function () {
    if (!this.state.focusedNode) return;
    this.element.focusMenu = this._createFocusMenuElement();
    this._updateFocusMenu();
    this.element._overlay.appendChild(this.element.focusMenu);
    UTIL.redrawElement(this.element.focusMenu); // force redraw of element i.e. triggers the transition effect we want
    this.element.focusMenu.classList.add("show");
};
BuildOverlayManager.prototype._hideNodeMenu = function () {
    if (!this.element?.focusMenu) return;
    const oldElement = this.element.focusMenu;
    UTIL.redrawElement(oldElement);
    oldElement.classList.add("hide");
    oldElement.addEventListener(
        "transitionend",
        (event) => {
            oldElement.remove();
            if (oldElement?.isSameNode(this.element.focusMenu))
                this.element.focusMenu = undefined;
        },
        { once: true }
    );
};
BuildOverlayManager.prototype.focusNode = function (nodeid) {
    if (!this.state.stopFocusing) {
        this.unfocusNode();
        OverlayManager.prototype.focusNode.call(this, nodeid);
        this._showNodeMenu();
    }
};
BuildOverlayManager.prototype.unfocusNode = function () {
    if (this.state.focusedNode && !this.state.keepFocus) {
        OverlayManager.prototype.unfocusNode.call(this);
        this._hideNodeMenu();
    }
};
BuildOverlayManager.prototype._initOverlay = function () {
    OverlayManager.prototype._initOverlay.call(this);
    // add hud/menu stuff
    this.element.hud = BuildHud.createHud();
    this.element._overlay.appendChild(this.element.hud);
};
BuildOverlayManager.prototype.updateWallet = function (bankData) {
    const walletEls = {};
    this.element.hud
        .querySelectorAll(":scope > .wallet > [data-currency-type]")
        .forEach((el) => {
            walletEls[el.dataset.currencyType] = el;
        });
    Object.entries(bankData).forEach(([currencyType, currencyData]) => {
        if (walletEls.hasOwnProperty(currencyType))
            walletEls[currencyType].innerText =
                walletEls[currencyType].innerText.split(":", 2)[0] +
                `: ${Math.floor(currencyData.amount)} / ${currencyData.max}`;
        else
            Logger.warn(
                `[BuildOverlayManager] | Failed to update currency display for type "${currencyType}": Corrosponding element does not exist in wallet.`
            );
    });
};
BuildOverlayManager.prototype.getWallet = function () {
    // only serves to check what's displayed. Get wallet data from Storage for meaningful values
    const walletData = {};
    this.element.hud
        .querySelectorAll(":scope > .wallet > [data-currency-type]")
        .forEach((el) => {
            const value = el.innerText.split(": ", 2)[1];
            if (/^\d+$/.test(value)) {
                const [amount, total] = value.split(" / ", 2);
                walletData[el.dataset.currencyType] = {
                    amount: parseInt(amount),
                    max: parseInt(amount)
                }
            } else {
                walletData[el.dataset.currencyType] = {
                    amount: undefined,
                    max: undefined
                }
            }
        });
    return walletData;
};
BuildOverlayManager.prototype.update = function () {
    OverlayManager.prototype.update.call(this);
    this._updateFocusMenu();
};
BuildOverlayManager.prototype.init = function (...args) {
    OverlayManager.prototype.init.call(this, ...args);
    this._initOverlay();
};
export function AttackOverlayManager(targetData, attackManager, ...parentArgs) {
    OverlayManager.call(this, ...parentArgs);
    this._targetData = targetData;
    this._attackManager = attackManager;
    this.element.hud = undefined;
}
AttackOverlayManager.prototype = Object.create(OverlayManager.prototype);
AttackOverlayManager.prototype.constructor = AttackOverlayManager;
AttackOverlayManager.prototype._initOverlay = function () {
    OverlayManager.prototype._initOverlay.call(this);
    // create attack bar menu
    const attackTiles = Array.from(this._attackManager.attacks, (attack) => {
        const tile = AttackFocusMenu.createTileElement(attack.type);
        tile.addEventListener("click", (event) => {
            if (
                this.state.focusedNode &&
                this._nodeManager.getNodeData(this.focusedNodeId)?.isFriendly
            ) {
                if (this._nodeManager.addAttackToNode(
                    attack.type,
                    this.focusedNodeId
                )) this._updateFocusMenu();
                else this.messagePopup("Cannot add Attack to Node.");
            }
        });
        return tile;
    });
    this.element.hud = AttackHud.createHud(this._targetData.username, attackTiles);
    this.element._overlay.appendChild(this.element.hud);
};
AttackOverlayManager.prototype._updateFocusMenu = function () {
    if (this.state.focusedNode) {
        while (this.element.focusMenu.firstChild) {
            this.element.focusMenu.removeChild(
                this.element.focusMenu.firstChild
            );
        }
        this._loadTilesForNode().forEach((el) =>
            this.element.focusMenu.appendChild(el)
        );
    }
};
AttackOverlayManager.prototype._loadTilesForNode = function () {
    const nodeData = this._nodeManager.getNodeData(this.focusedNodeId);
    const attackerTiles = Array.from(
        nodeData.isFriendly ? nodeData.slots : new Array(nodeData.slots.length).fill({type: undefined}),
        ({ type }) =>
            AttackFocusMenu.createTileElement(type)
    );
    if (nodeData.isFriendly)
        attackerTiles.forEach((el, i) =>
            el.addEventListener(
                "click",
                (e) => {
                    nodeData.slots.pop(i);
                    this._updateFocusMenu();
                },
                { once: true }
            )
        );
    return attackerTiles;
};
AttackOverlayManager.prototype.focusNode = function (nodeid) {
    if (!this.state.stopFocusing) {
        this.unfocusNode();
        OverlayManager.prototype.focusNode.call(this, nodeid);
        this.element.focusMenu = this._createFocusMenuElement();
        this.element._overlay.appendChild(this.element.focusMenu);
        UTIL.redrawElement(this.element.focusMenu); // force redraw of element i.e. triggers the transition effect we want
        setTimeout(() => {
            this.element.focusMenu.classList.add("show");
        }, 0);
    }
};
AttackOverlayManager.prototype.unfocusNode = function () {
    if (this.state.focusedNode && !this.state.keepFocus) {
        OverlayManager.prototype.unfocusNode.call(this);
        const oldElement = this.element.focusMenu;
        UTIL.redrawElement(oldElement);
        oldElement.classList.add("hide");
        // animation is staggered, so need to wait for all children to finish
        let countdown = oldElement.children.length;
        oldElement.addEventListener("transitionend", function (event) {
            if (--countdown <= 0) oldElement.remove();
        });
    }
};
AttackOverlayManager.prototype.update = function () {
    OverlayManager.prototype.update.call(this);
    if (
        this.state.focusedNode &&
        String(
            this._nodeManager.getNodeData(this.focusedNodeId).slots[0].type
        ) != this.element.focusMenu.children[0].dataset.attackType
    )
        this._updateFocusMenu();
};
AttackOverlayManager.prototype._createFocusMenuElement = function () {
    return AttackFocusMenu.createMenuElement(...this._loadTilesForNode());
};
AttackOverlayManager.prototype.init = function (...args) {
    OverlayManager.prototype.init.call(this, ...args);
    this._menuManager.when("addnode", (detail) => {
        Logger.alert(
            `Failed to add node (${detail.nodeType}): Cannot add nodes outside of build phase!`
        );
    });
    this._initOverlay();
    this.element.menuButton.remove();
    this.element.menuButton = Button.mainMenu(() =>
        this._menuManager._dispatch("swapphase", { phase: "build" })
    );
    this.element._overlay.appendChild(this.element.menuButton);
};

export function SelectOverlayManager(...parentArgs) {
    // laziness
    OverlayManager.call(this, ...parentArgs);
}
SelectOverlayManager.prototype = Object.create(OverlayManager.prototype);
SelectOverlayManager.prototype.constructor = SelectOverlayManager;
SelectOverlayManager.prototype.init = function (...args) {
    OverlayManager.prototype.init.call(this, ...args);
    this._initOverlay();
    this.element.menuButton.remove();
    this.element.menuButton = Button.mainMenu(() =>
        this._menuManager._dispatch("swapphase", { phase: "build" })
    );
    this.element._overlay.appendChild(this.element.menuButton);
};

SelectOverlayManager.prototype._initOverlay = function () {
    OverlayManager.prototype._initOverlay.call(this);
    // init hud
    this.element.hud = SelectHud.createHud();
    this.element._overlay.appendChild(this.element.hud);
    // Add refresh targets button
    this.element.refreshButton = this._menuManager.createElement.button(90, undefined, "Refresh Targets", {}, 2);
    this.element.refreshButton.classList.add("refresh");
    this.element.hud.appendChild(this.element.refreshButton);
};

SelectOverlayManager.prototype.update = function () {
    // do nothing
};
