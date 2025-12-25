import * as UTIL from "./utils.js";
import { DataStore } from "./data.js";

// main pause menu
const SVG_NS = "http://www.w3.org/2000/svg";
const menuPath = "./source/menu/";
const menuButtonName = (type) => `menu-${type}-button.png`;
const stopPropagation = (el) => {
    el.addEventListener("click", function (event) {
        event.stopPropagation();
    });
    return el;
}
const stopContextMenu = (el) => {
    el.addEventListener("contextmenu", function (event) {
        event.preventDefault();
    });
    return el;
}
const backgroundPreviewPath = (bgName) => `./source/bg/${bgName}/py.png`;
const BACKGROUND_TYPES = DEFAULT.WALLPAPER_TYPES;
const NODE_TYPES = DEFAULT.NODE_TYPES;
const NODE_ICONS = DataStore.BuilderData.icons;

export function MenuManager (
    overlayElement
) {
    const self = this;
    this.persistentListeners = [];
    this.backPath = [];
    this.state = {
        get open() {
            return !self.element.wrapper.classList.contains("close");   
        },
        set open(bool) {
            if (bool)
                self.element.wrapper.classList.remove("close");
            else
                self.element.wrapper.classList.add("close");
            self._dispatch(bool ? "open" : "close");
        },
    };
    this.element = {
        wrapper: document.createElement("div"),
        eventTarget: document.createElement("div"),
    };
    this.loadMenu = {
        clear: function () {
            while (self.element.wrapper.firstChild) {
                self.element.wrapper.removeChild(self.element.wrapper.firstChild);
            }
            self.element.wrapper.className = self.state.open ? "" : "close";
            self._dispatch("clear");
        },
        login: function () {
            self.loadMenu.clear();
            self.element.wrapper.classList.add("login");
            const central = document.createElement("div");
            central.classList.add("center", "absolutely-center");

            let elements = [];

            const loginLabel = self.createElement.textBox("Login", false, false);
            const usernameLabel = self.createElement.textBox("Username", false, false);
            const passwordLabel = self.createElement.textBox("Password", false, false);
            const usernameField = self.createElement.textBox("");
            const passwordField = self.createElement.textBox("");

            const getLoginData = () => {
                const values = {
                    username: usernameField.firstChild.firstChild.value.trim(),
                    password: passwordField.firstChild.firstChild.value.trim(),
                    elements: elements
                };
                usernameField.firstChild.firstChild.value = "";
                passwordField.firstChild.firstChild.value = "";
                return values;
            };

            const loginButton = self.createElement.button(90, undefined, "Sign in", { // placeholder
                click: () => {
                    const loginData = getLoginData();
                    if (loginData.username && loginData.password)
                        self._dispatch("login", loginData);
                    else
                        Logger.alert("Field(s) are still blank!");
                },
            }, 1.25);
            const createButton = self.createElement.button(90, undefined, "Create account", {
                click: () => {
                    const loginData = getLoginData();
                    if (loginData.username && loginData.password)
                        self._dispatch("newlogin", loginData);
                    else
                        Logger.alert("Field(s) are still blank!");
                },
            }, 1.25);
            usernameField.style.width = "calc(var(--vw) * 50)";
            usernameField.id = "loginpage-username";
            usernameField.rows = 1;
            usernameField.cols = 50;
            passwordField.style.width = "calc(var(--vw) * 50)";
            passwordField.id = "loginpage-password";
            passwordField.rows = 1;
            passwordField.cols = 50;

            usernameField.addEventListener("keypress", (e) => {
                if (e.which === 13 && !e.shiftKey) { // enter key
                    const loginData = getLoginData();
                    if (loginData.username && loginData.password)
                        self._dispatch("login", loginData);
                    else
                        Logger.alert("Field(s) are still blank!");
                    e.preventDefault();
                }
            });
            usernameField.addEventListener("keydown", (e) => {
                if (e.keyCode === 9) { // tab key
                    passwordField.firstChild.firstChild.focus();
                    e.preventDefault();
                }
            });
            passwordField.addEventListener("keypress", (e) => {
                if (e.which === 13 && !e.shiftKey) {
                    const loginData = getLoginData();
                    if (loginData.username && loginData.password)
                        self._dispatch("login", loginData);
                    else
                        Logger.alert("Field(s) are still blank!");
                    e.preventDefault();
                }
            });
            passwordField.addEventListener("keydown", (e) => {
                if (e.keyCode === 9) { // tab key
                    usernameField.firstChild.firstChild.focus();
                    e.preventDefault();
                }
            });
            
            elements = [
                loginLabel,
                usernameLabel,
                usernameField,
                passwordLabel,
                passwordField,
                loginButton,
                createButton
            ];
            self._appendElement(central, ...elements);
            self._appendMenu(central);
            self._dispatch("loadmenu", { history: ["login"] });
        },
        main: function () {
            self.loadMenu.clear();
            self.element.wrapper.classList.add("main");
            const section = {
                tl: document.createElement("div"),
                tr: document.createElement("div"),
                bl: document.createElement("div"),
                br: document.createElement("div")
            };
            section.tl.classList.add("top-left");
            section.tr.classList.add("top-right");
            section.bl.classList.add("bottom-left");
            section.br.classList.add("bottom-right");
            section.tl.appendChild(stopPropagation(
                self.createElement.button(112.5, "lock", undefined, {}, 2)
            ));
            section.tl.appendChild(stopPropagation(
                self.createElement.button(112.5, "lock", undefined, {}, 2)
            ));
            section.tr.appendChild(stopPropagation(
                self.createElement.button(-112.5, "lock", undefined, {}, 2)
            ));
            section.tr.appendChild(stopPropagation(
                self.createElement.button(-112.5, "lock", undefined, {}, 2)
            ));
            section.bl.appendChild(stopPropagation(
                self.createElement.button(67.5, "add-node", undefined, {
                    click: (event) => {
                        self.loadMenu.addNode.selectType();
                    }
                }, 2)
            ));
            section.bl.appendChild(stopPropagation(
                self.createElement.button(67.5, "cpu", undefined, {
                    click: (event) => {
                        Logger.log("research");
                    }
                }, 2)
            ));
            section.br.appendChild(stopPropagation(
                self.createElement.button(-67.5, "gear", undefined, {
                    click: (event) => {
                        self.loadMenu.settings.main();
                    }
                }, 2)
            ));
            section.br.appendChild(stopPropagation(
                self.createElement.button(-67.5, "target", undefined, {
                    click: (event) => {
                        self._dispatch("swapphase", {phase: "select"});
                    }
                }, 2)
            ));
            self._appendMenu(...Object.values(section));
            self._dispatch("loadmenu", {history: []});
        },
        loading: function () {
            self.loadMenu.clear();
            self.element.wrapper.classList.add("loading");
            const central = document.createElement("div");
            central.classList.add("center", "absolutely-center");
            const loading = self.createElement.statusTextBox(true, false);
            self._appendElement(central, loading.element);
            self._appendMenu(central);
            self._dispatch("loadmenu", { history: ["loading"], statusElement: loading});
        },
        nodeInfo: function () {
            self.loadMenu.clear();
            self.element.wrapper.classList.add("nodeInfo");
            const central = stopContextMenu(document.createElement("div"));
            central.classList.add("center", "absolutely-center", "scrollview");
            const infoWindow = self.createElement.statusTextBox(true, false);
            infoWindow.element.classList.add("info-window");
            const buttonEl = self.createElement.button(90, undefined, "Upgrade Tier", {}, 2);
            self._appendElement(central, infoWindow.element, buttonEl);
            self._appendMenu(central);
            self._dispatch("loadmenu", { history: [], infoElement: infoWindow, upgradeButton: buttonEl });
        },
        targetInfo: function () {
            self.loadMenu.clear();
            self.element.wrapper.classList.add("targetInfo");
            const central = document.createElement("div");
            central.classList.add("center", "absolutely-center");
            const infoWindow = self.createElement.statusTextBox(true, false);
            const buttonEl = self.createElement.button(90, undefined, "Start Attack", {}, 2);
            infoWindow.element.classList.add("target-description");
            self._appendElement(central, infoWindow.element, buttonEl);
            self._appendMenu(central);
            self._dispatch("loadmenu", { history: [], infoElement: infoWindow, buttonElement: buttonEl });
        },
        nodeMenus: { // called externally
            upgrade: function (node, coreTier) {
                self.state.open = true;
                self.loadMenu.clear();
                self.element.wrapper.classList.add("nodeMenus", "upgrade");

                const nodeid = node.uuid;
                const nodeType = node.userData.type;
                const currentTier = node.userData.exportData?.level;
                const nodeTypeData = CONFIG.NODES[nodeType];
                const nodeThumb = NODE_ICONS[nodeType];
                const nextTier = currentTier + 1;
                const nextTierData = nodeTypeData.build.upgrade[`${nextTier}`];
                const upgradeInfo = [];

                {
                    const append = (text) => upgradeInfo[upgradeInfo.length - 1] = upgradeInfo[upgradeInfo.length - 1].concat(text);
                    upgradeInfo.push(
                        `${nodeTypeData.name} Tier: ${currentTier + 1}`
                    );
                    if (nextTierData)
                        append(` > ${nextTier + 1}`);

                    if (node.userData.isCurrencyNode) {
                        upgradeInfo.push(
                            `Collection Rate: ${node.userData.exportData?.data.rate}/hour`
                        );
                        if (nextTierData)
                            append(` + ${nodeTypeData.settings?.increase?.rate}`);
                    }
                    if (node.userData.isStorageNode || node.userData.isCurrencyNode || nodeType == "barracks") {
                        upgradeInfo.push(
                            `Capacity: ${node.userData.exportData?.data.max}`
                        );
                        if (nextTierData)
                            append(` + ${nodeTypeData.settings?.increase?.max}`);
                    }
                    if (node.userData.isCore) {
                        upgradeInfo.push(
                            `Download buffer: ${node.userData.exportData?.data.download.max}`
                        );
                        if (nextTierData)
                            append(` + ${nodeTypeData.settings?.increase?.max}`);
                    }
                    if (nodeType == "botnet") {
                        upgradeInfo.push(
                            `Compiling slots: ${Object.keys(node.userData.exportData?.data.active).length}`
                        );
                        if (nextTierData)
                            append(` + ${nodeTypeData.settings?.increase?.active}`);
                        upgradeInfo.push(
                            `Queue size: ${node.userData.exportData?.data.max}`
                        );
                        if (nextTierData)
                            append(` + ${nodeTypeData.settings?.increase?.max}`);
                    }
                    if (nextTierData)
                        upgradeInfo.push(`Upgrade cost:\n${nextTierData.cost}`.replace(",", "\n"));
                    else
                        upgradeInfo.push("Max Tier Reached");
                }


                const central = stopContextMenu(document.createElement("div"));
                const titleEl = self.createElement.textBox(nodeTypeData.name, false, false, false);
                const descriptionWindow = self.createElement.textBox(upgradeInfo.join("\n\n"), true, false);
                const previewTile = self.createElement.tileSvg(1, 0, [ self.createElement.svgImage(nodeThumb) ]);
                const buyButton = nextTierData
                    ? nextTierData.level <= coreTier
                        ? self.createElement.button(90, undefined, `Upgrade Node`, {
                                click: () => self._dispatch("upgradenode", {nodeid: nodeid}),
                            }, 3.5)
                        : self.createElement.button(90, undefined, `Core Tier ${nextTierData.level + 1} required`, {}, 3.5)
                    : self.createElement.button(90, "lock", undefined, {}, 3.5);
                

                central.classList.add("center", "absolutely-center", "fade-edges-vertical", "scrollview");
                titleEl.classList.add("title");
                descriptionWindow.classList.add("description");
                descriptionWindow.firstChild.firstChild.classList.add("align-left");
                buyButton.classList.add("buy");
                previewTile.classList.add("preview");

                self._appendElement(central, titleEl, previewTile, descriptionWindow, buyButton);
                self._appendMenu(central);
                central.scrollTo = 0;
                self._dispatch("loadmenu", { history: [] });
            },
            botnet: function (nodeid, data) { // expects {icons: {}, attackDetails: {}, nodeData: botnetData, removeAttackCallback: (nodeid, index, isCompiling)()}
                self.state.open = true;
                self.loadMenu.clear();
                self.element.wrapper.classList.add("nodeMenus", "botnet");
                const central = document.createElement("div");
                const compilingBar = document.createElement("div");
                const carousel = self.createElement.scrollCarousel(
                    Array.from(Object.entries(data.icons).filter(([[key]]) => !key.startsWith("_")), ([type, src]) => {
                        const img = stopContextMenu(document.createElement("div"));
                        img.style.backgroundImage = `url("${src}")`;
                        img.dataset.attackType = type;
                        img.classList.add("tile", "pointer-events");
                        return img;
                    }), 2
                );
                const _getFocusedType = () => carousel.children
                    [Number(carousel.dataset.focusedElementIdx)]
                        .dataset.attackType;
                const infoWindow = self.createElement.statusTextBox(false, false);
                infoWindow.element.classList.add("description");
                infoWindow.align("left");
                const compileButton = self.createElement.button(90, undefined, "Compile", {
                        click: () => self._dispatch("compileattack", { nodeid: nodeid, attackType: _getFocusedType() }),
                    }, 2);
                compileButton.classList.add("compile");
                { // create elements for compiler menu based on given nodeData
                    compilingBar.classList.add("pointer-events", "tile-grid", "horizontal", "fade-edges-horizontal", "compiling-bar");

                    const slots = Object.keys(data.nodeData.active).length;
                    const capacity = data.nodeData.max;
                    for (let i = 0; i < capacity + slots; i++) {
                        const tileEl = stopContextMenu(document.createElement("div"));
                        tileEl.style.backgroundImage = `url("${data.icons._empty}")`;
                        tileEl.classList.add("tile", "pointer-events");
                        if (i >= slots) {
                            tileEl.classList.add("queued");
                            tileEl.addEventListener("click", function () {
                                 data.removeAttackCallback(nodeid, i - slots, false);
                            });
                        } else {
                            tileEl.addEventListener("click", function () {
                                 data.removeAttackCallback(nodeid, String(i), true);
                            });
                        }
                        compilingBar.appendChild(tileEl);
                    }
                }
                const updateCallback = (activeSlots, enqueued) => {
                    const now = UTIL.getNowUTCSeconds();
                    const focusedType = _getFocusedType();
                    const entriesArr = Object.entries(activeSlots);
                    infoWindow.text = `\t${data?.attackDetails[focusedType].name}\n${data?.attackDetails[focusedType].description}\n\nCosts: ${data?.attackDetails[focusedType].cost}`;
                    entriesArr.forEach(([idx, slot]) => {
                        const el = compilingBar.children[Number(idx)];
                        if (!slot?.type) {
                            el.style.backgroundImage = `url("${data.icons._empty}")`;
                            el.textContent = "";
                            return;
                        }
                        const remaining =  (slot.started + slot.duration) - now;
                        el.style.backgroundImage = `url("${data.icons[slot.type]}")`;
                        el.textContent = `${Math.floor(remaining / 60)}`.padStart(2, "0") + ":" + `${Math.floor(remaining % 60)}`.padStart(2, "0");
                    });
                    for (let i = 0; i < data.nodeData.max; i++) {
                        const el = compilingBar.children[i + entriesArr.length];
                        el.style.backgroundImage = `url("${(i > enqueued.length - 1
                                ? data.icons._empty
                                : data.icons[enqueued[i]?.type]
                            )}")`;
                    }
                };
                self._appendElement(central, compilingBar, carousel, infoWindow.element, compileButton);
                self._appendMenu(central);
                carousel.dispatchEvent(new CustomEvent("update"));
                self._dispatch("loadmenu", { history: [], update: updateCallback });
            },
            barracks: function (data) {  // expects {icons: {}, attackDetails: {}, removeAttackCallback: (attackType)()}
                self.state.open = true;
                self.loadMenu.clear();
                self.element.wrapper.classList.add("nodeMenus", "barracks");
                const central = document.createElement("div");
                const carousel = self.createElement.scrollCarousel(
                    Array.from(Object.entries(data.icons).filter(([[key]]) => !key.startsWith("_")), ([type, src]) => {
                        const img = stopContextMenu(document.createElement("div"));
                        img.style.backgroundImage = `url("${src}")`;
                        img.dataset.attackType = type;
                        img.dataset.attackCount = 0;
                        img.classList.add("tile");
                        img.addEventListener("click", function () {
                            if (!barracks) return; // barracks data uninitialized, nothing to do
                            if (img.dataset.attackCount && Number(img.dataset.attackCount)) {
                                img.dataset.attackCount = Number(img.dataset.attackCount) - 1;
                                data.removeAttackCallback(type);
                            }
                        });
                        return img;
                    }), 2
                );
                const _getFocusedData = () => carousel.children
                    [Number(carousel.dataset.focusedElementIdx)]
                        .dataset;
                const infoWindow = self.createElement.statusTextBox(false, false);
                infoWindow.element.classList.add("description");
                infoWindow.align("left");
                const updateCallback = (barracksData) => {
                    [...carousel.children].forEach((tileEl) => {
                        const bd = barracksData[tileEl.dataset?.attackType];
                        tileEl.dataset.attackCount = (bd) ? bd : 0;
                    });
                };
                const carouselCallback = () => {
                    const {attackType, attackCount} = _getFocusedData();
                    infoWindow.text = `\t${data?.attackDetails[attackType].name}\n${data?.attackDetails[attackType].description}\n\nStored: ${attackCount}`;
                };
                self._appendElement(central, carousel, infoWindow.element);
                self._appendMenu(central);
                carousel.dispatchEvent(new CustomEvent("update"));
                self._dispatch("loadmenu", { history: [], updateCarousel: carouselCallback, updateMenu: updateCallback });
            },
        },
        settings: {
            main: function () {
                self.loadMenu.clear();
                self.element.wrapper.classList.add("settings", "main-settings");
                const central = document.createElement("div");
                central.classList.add("center", "absolutely-center");
                const buttons = [ // placeholders
                    self.createElement.button(90, "gear", "Change background", {
                        click: () => self.loadMenu.settings.changeBackground(),
                    }, 4),
                    self.createElement.button(90, "gear", "Low performance on", {
                        click: () => self._dispatch("lowperformance", {set: true}),
                    }, 4),
                    self.createElement.button(90, "gear", "Low performance off", {
                        click: () => self._dispatch("lowperformance", {set: false}),
                    }, 4),
                    self.createElement.button(90, "gear", "Sign out", {
                        click: () => self._dispatch("logout"),
                    }, 4),
                    self.createElement.button(90, "cpu", "Save log file", {
                        click: () => self._dispatch("_savelog"),
                    }, 4),
                    self.createElement.button(90, "cpu", "Save game", {
                        click: () => self._dispatch("savegame"),
                    }, 4),
                ];
                self._appendElement(central, ...buttons);
                self._appendMenu(central);
                self._dispatch("loadmenu", { history: ["main"] });
            },
            changeBackground: function () {
                self.loadMenu.clear();
                self.element.wrapper.classList.add("settings", "changeBackground");
                const central = stopContextMenu(document.createElement("div"));
                central.classList.add("center", "absolutely-center", "scrollview", "fade-edges-vertical", "pointer-events");
                const buttons = Array.from(BACKGROUND_TYPES, bg => 
                    self.createElement.tileImg(backgroundPreviewPath(bg), {
                        click: () => self._dispatch("backgroundchange", {background: bg}),
                    }, true, true)
                );
                self._appendElement(central, ...buttons);
                self._appendMenu(central);
                central.scrollTop = 0; // scroll to top if overflowing
                self._dispatch("loadmenu", {history: ["settings", "main"]});
            },
        },
        addNode: {
            selectType: function () {
                self.loadMenu.clear();
                self.element.wrapper.classList.add("addNode", "selectType");
                const central = document.createElement("div");
                central.classList.add("center", "absolutely-center");

                const baseBtn = self.createElement.button(0, undefined, "base\nnodes", {
                    click: (event) => {
                        self.loadMenu.addNode.baseType();
                    }
                }, 1);
                const defenseBtn = self.createElement.button(0, undefined, "defense\nnodes", {
                    click: (event) => {
                        self.loadMenu.addNode.defenseType();
                    }
                }, 1);
                const econBtn = self.createElement.button(0, undefined, "money\nnodes", {
                    click: (event) => {
                        self.loadMenu.addNode.econType();
                    }
                }, 1);

                self._appendElement(central, baseBtn, defenseBtn, econBtn);
                self._appendMenu(central);
                self._dispatch("loadmenu", {history: ["main"]});
            },
            baseType: function () {
                self.loadMenu.clear();
                self.element.wrapper.classList.add("addNode", "baseType");
                const central = document.createElement("div");
                central.classList.add("center", "absolutely-center", "fade-edges-vertical", "scrollview");
                const buttons = Array.from(NODE_TYPES.BASE, ({name, id}) =>
                    self.createElement.button(90, 
                        ...(!name || !id
                            ? ["lock", undefined, {}]
                            : ["add-node", name, {click: () => self._dispatch("shopdisplay", {shop: "addnode", nodeType: id, typeMenu: "baseType"})}]
                        ), 4
                    )
                );
                self._appendElement(central, ...buttons);
                self._appendMenu(central);
                self._dispatch("loadmenu", {history: ["addNode", "selectType"]});
            },
            defenseType: function () {
                self.loadMenu.clear();
                self.element.wrapper.classList.add("addNode", "defenseType");
                const central = document.createElement("div");
                central.classList.add("center", "absolutely-center", "fade-edges-vertical", "scrollview");
                const buttons = Array.from(NODE_TYPES.DEF, ({name, id}) =>
                    self.createElement.button(90, 
                        ...(!name || !id
                            ? ["lock", undefined, {}]
                            : ["add-node", name, {click: () => self._dispatch("shopdisplay", {shop: "addnode", nodeType: id, typeMenu: "defenseType"})}]
                        ), 4
                    )
                );
                self._appendElement(central, ...buttons);
                self._appendMenu(central);
                self._dispatch("loadmenu", {history: ["addNode", "selectType"]});
            },
            econType: function () {
                self.loadMenu.clear();
                self.element.wrapper.classList.add("addNode", "econType");
                const central = document.createElement("div");
                central.classList.add("center", "absolutely-center", "fade-edges-vertical", "scrollview");
                const buttons = Array.from(NODE_TYPES.ECON, ({name, id}) =>
                    self.createElement.button(90, 
                        ...(!name || !id
                            ? ["lock", undefined, {}]
                            : ["add-node", name, {click: () => self._dispatch("shopdisplay", {shop: "addnode", nodeType: id, typeMenu: "econType"})}]
                        ), 4
                    )
                );
                self._appendElement(central, ...buttons);
                self._appendMenu(central);
                self._dispatch("loadmenu", {history: ["addNode", "selectType"]});
            },
            nodeDetail: function (
                details, // expects {_type, description, cost(str), name}
                lastMenu
            ) { // called externally
                self.loadMenu.clear();
                self.element.wrapper.classList.add("addNode", "nodeDetail");
                const central = stopContextMenu(document.createElement("div"));
                central.classList.add("center", "absolutely-center", "fade-edges-vertical", "scrollview");
                const titleEl = self.createElement.textBox(details.name, false, false, false);
                titleEl.classList.add("title");
                const descriptionWindow = self.createElement.textBox(details.description, true, false);
                descriptionWindow.classList.add("description");
                descriptionWindow.firstChild.firstChild.classList.add("align-left");
                const previewTile = self.createElement.tileSvg(1, 0, [
                    self.createElement.svgImage(NODE_ICONS[details._type])
                ]);
                previewTile.classList.add("preview");
                const buyButton = details?.free
                    ? self.createElement.button(90, undefined, "Free", {
                        click: () => self._dispatch("addnode", {nodeType: details._type, free: true}),
                    }, 2)
                    : details.cost
                        ? self.createElement.button(90, undefined, details.cost, {
                            click: () => self._dispatch("addnode", {nodeType: details._type}),
                        }, 2)
                        : self.createElement.button(90, "lock", "unavailable", {}, 2);  // if cost string is undefined, node is unpurchasable
                buyButton.classList.add("buy");
                self._appendElement(central, titleEl, previewTile, descriptionWindow, buyButton);
                self._appendMenu(central);
                central.scrollTo = 0;
                self._dispatch("loadmenu", {history: ["addNode", lastMenu]});
            },
        },
    };
    this.createElement = {
        button: function (angle = 0, buttonType = undefined, text = undefined, events = {}, buttonLength = 2) {
            const children = [];
            if (buttonType)
                children.push(self.createElement.svgImage(menuPath + buttonType + "-icon.png"));
            if (text)
                children.push(self.createElement.svgText(text.split("\n")));
            const el = self.createElement.tileSvg(buttonLength, angle, children)
            el.classList.add("pointer-events", "button");
            el.style.setProperty("--length", buttonLength)
            Object.entries(events).forEach(([eventType, handler]) => el.addEventListener(eventType, handler));

            return el;
        },
        tileSvg: function (scaleLength = 1, rotation = 0, children = [], size = 100, fill = "#ff5757") {
            const outerPathData = {
                offset: [
                    [ 41, -30 ],
                    [ -39 ],
                    [ -17, -11 ],
                    [ -2, ],
                    [ -24, -16 ],
                    [ -41, 28 ],
                    [ 21, ],
                    [ 2, 3 ],
                    [ 18.5 ],
                    [ 39, 25 ],
                    [ ],
                    [ -41, 30 ],
                    [ -43, -28 ],
                    [ -43 ],
                    [ 43, -29 ],
                    [ 43, 29 ],
                    [ 42 ],
                    [ ]
                ],
                type: [
                    "m",
                    "v",
                    "l",
                    "v",
                    "l",
                    "l",
                    "v",
                    "l",
                    "v",
                    "l",
                    "z",
                    "m",
                    "l",
                    "v",
                    "l",
                    "l",
                    "v",
                    "z"
                ]
            };
            const innerPathData = {
                offset: [
                    [ 41, -30 ],
                    [ -39 ],
                    [ -17, -11 ],
                    [ -2, ],
                    [ -24, -16 ],
                    [ -41, 28 ],
                    [ 21, ],
                    [ 2, 3 ],
                    [ 18.5 ],
                    [ 39, 25 ],
                    [ ],
                ],
                type: [
                    "m",
                    "v",
                    "l",
                    "v",
                    "l",
                    "l",
                    "v",
                    "l",
                    "v",
                    "l",
                    "z",
                ]
            }
            const outerPathScalable = {
                idx: [
                    1, 6, 13, 16 // should all be single-axis, since they're all v commands
                ],
                multiplier: [
                    -1, 1, -1, 1
                ]
            };
            const innerPathScalable = {
                idx: [
                    1, 6 // should all be single-axis, since they're all v commands
                ],
                multiplier: [
                    -1, 1
                ]
            };
            const ogHeight = 100;
            const newLengthOffset = (ogHeight * scaleLength) - ogHeight;
            const newViewBoxData = {
                origin: {
                    x: -50 * scaleLength,
                    y: -100 - newLengthOffset
                },
                size: {
                    x: 100 + newLengthOffset,
                    y: 100 + newLengthOffset
                }
            };
            const newViewBox = `${String(newViewBoxData.origin.x)} ${String(newViewBoxData.origin.y)} ${String(newViewBoxData.size.x)} ${String(newViewBoxData.size.y)}`;
            outerPathScalable.idx.forEach((idx, scaleIdx) => {
                outerPathData.offset[idx][0] += newLengthOffset * outerPathScalable.multiplier[scaleIdx];
            });
            innerPathScalable.idx.forEach((idx, scaleIdx) => {
                innerPathData.offset[idx][0] += newLengthOffset * innerPathScalable.multiplier[scaleIdx];
            });
            const newOuterPathData = Array.from({ length: outerPathData.type.length}, (_, idx) => 
                    outerPathData.type[idx] + " " + outerPathData.offset[idx].join(" ")
                ).join(" ");
            const newInnerPathData = Array.from({ length: innerPathData.type.length}, (_, idx) => 
                    innerPathData.type[idx] + " " + innerPathData.offset[idx].join(" ")
                ).join(" ");
            const svg = document.createElementNS(SVG_NS, "svg");
            const outerPath = document.createElementNS(SVG_NS, "path");
            const innerPath = document.createElementNS(SVG_NS, "path");
            outerPath.setAttribute("fill", fill);
            outerPath.setAttribute("d", newOuterPathData);
            outerPath.setAttribute("transform", `rotate(${String(rotation)} ${newViewBoxData.origin.x + newViewBoxData.size.x / 2} ${newViewBoxData.origin.y + newViewBoxData.size.y / 2})`);
            innerPath.setAttribute("fill", fill);
            innerPath.setAttribute("fill-opacity", "0.5");
            innerPath.setAttribute("d", newInnerPathData);
            innerPath.setAttribute("transform", `rotate(${String(rotation)} ${newViewBoxData.origin.x + newViewBoxData.size.x / 2} ${newViewBoxData.origin.y + newViewBoxData.size.y / 2})`);
            svg.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
            svg.setAttribute("width", String(size * scaleLength));
            svg.setAttribute("height", String(size * scaleLength));
            svg.setAttribute("viewBox", newViewBox);
            svg.appendChild(outerPath);
            svg.appendChild(innerPath);
            if (children?.length)
                children.forEach(child => svg.appendChild(child));

            return svg;
        },
        svgImage: function (imgPath) {
            const el = document.createElementNS(SVG_NS,"image");
            el.setAttributeNS("http://www.w3.org/1999/xlink","href", imgPath);
            return el;
        },
        svgText: function (textlines) {
            const el = document.createElementNS(SVG_NS,"text");
            // these values are ignored in css, must be defined inline
            el.setAttributeNS(null,"height","100%");
            el.setAttributeNS(null,"width","100%");
            el.setAttributeNS(null,"y","-50%");

            // centering text
            const firstLineOffset = `${-.6 * (textlines.length - 1)}em`;

            textlines.forEach((textline, i) => {
                const line = document.createElementNS(SVG_NS, "tspan");
                line.setAttributeNS(null, "x", "0");
                line.setAttributeNS(null, "dy", i ? "1.2em" : firstLineOffset);
                line.textContent = textline;
                el.appendChild(line);
            });
            return el;
        },
        statusTextBox: function (background = true, interactive = true, fontColor = "#ff5757", highlightBg = "#ffa2a2", highlightFg = "#fff") { // wraps textbox, comes with functions to update the value
            const el = self.createElement.textBox("", background, interactive, false, fontColor, highlightBg, highlightFg);
            const wrapper = {
                _display: el.style.display,
                element: el,
                textElement: el.firstChild.firstChild,
                set text (value) {
                    wrapper.textElement.value = value;
                },
                get text () {
                    return wrapper.textElement.value;
                },
                hide: () => {
                    el.style.display = "none";
                },
                show: () => {
                    el.style.display = wrapper._display;
                },
                align: (side) => {
                    wrapper.textElement.classList.remove("align-left", "align-right");
                    if (side == "left")
                        wrapper.textElement.classList.add("align-left");
                    if (side == "right")
                        wrapper.textElement.classList.add("align-right");
                },
            };
            return wrapper;
        },
        textBox: function (text, background = true, interactive = true, editable = true, fontColor = "#ff5757", highlightBg = "#ffa2a2", highlightFg = "#fff") {
            const wrapper = document.createElement("div");
            const filterEl = document.createElement("div");
            const el = document.createElement("textarea");
            wrapper.classList.add("textbox");
            wrapper.classList.add("hide-scroll");
            el.classList.add("hide-scroll");
            el.readOnly = !editable;
            if (interactive)
                el.classList.add("pointer-events");                
            if (!background)
                wrapper.classList.add("naked");
            el.style.color = fontColor;
            el.style.setProperty("--highlight-bg", highlightBg);
            el.style.setProperty("--highlight-fg", highlightFg);
            el.spellcheck = false;
            el.innerHTML = text;
            filterEl.appendChild(el);
            wrapper.appendChild(filterEl);
            return wrapper;
        },
        tileImg: function (src, events = {}, alternate = false, interactive = false, outline = false) {
            const wrapper = document.createElement("div");
            const img = document.createElement("img");
            img.src = src;
            wrapper.classList.add("hexagon");
            img.classList.add("hexagon");
            if (interactive) {
                wrapper.classList.add("button");
                img.classList.add("pointer-events");
            }
            if (outline) {
                wrapper.classList.add("outline");
            }
            if (alternate) {
                wrapper.classList.add("alt");
            }
            wrapper.appendChild(img);
            Object.entries(events).forEach(([eventType, handler]) => wrapper.addEventListener(eventType, handler));
            return wrapper;
        },
        scrollCarousel: function (children = [], curve = 1, minScale = 0.5, maxScale = 1) {
            const wrap = document.createElement("div");
            wrap.classList.add("carousel-scroll", "fade-edges", "pointer-events");
            const _distanceFromCenter = (el) => {
                const viewCenter = window.innerWidth / 2;
                const rect = el.getBoundingClientRect();
                const elCenter = rect.left + rect.width / 2;
                const diff = elCenter - viewCenter;
                const distance = Math.abs(diff);
                return {dist: distance, el: el};
            };
            const _curved = (c) => 1 - Math.sqrt(1 - c**2);
            const _updateEl = () => {
                const parsed = Array.from(wrap.children, _distanceFromCenter);
                parsed.sort((a, b) => a.dist - b.dist);
                const min = parsed[0].dist;
                const max = parsed.at(-1).dist;
                parsed.forEach(({dist, el}) => {
                    const grow = (1 - ((dist - min) / (max - min)));
                    const clamped = Math.max(Math.min(grow, maxScale / 2), minScale / 2);
                    
                    el.style.transform = `scale(${2 * clamped}) translateY(${100 * (_curved(1 - grow) * curve)}%)`;
                });
                wrap.dataset.focusedElementIdx = parsed.at(0)?.el.dataset?.carouselIndex;
            };
            let dragging = false;
            const _disableDragging = (e) => {
                dragging = false;
            };
            const _enableDragging = (e) => {
                dragging = true;
            };
            const _loopCarousel = () => { // call AFTER applying calculated scroll and BEFORE applying scale updates
                if (wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth)
                    wrap.scrollLeft = 0;
                else if (wrap.scrollLeft <= 0)
                    wrap.scrollLeft = wrap.scrollWidth - wrap.clientWidth;
            };
            wrap.addEventListener("wheel", (e) => {
                wrap.scrollLeft -= (e.wheelDeltaX + e.wheelDeltaY) / 2;
                _loopCarousel();
                _updateEl();
                e.preventDefault();
            }, { passive: false });
            wrap.addEventListener("pointermove", (e) => {
                if (!dragging) return;
                wrap.scrollLeft -= e.movementX * 1.3;
                _loopCarousel();
                _updateEl();
            });
            wrap.addEventListener("pointerdown", _enableDragging);
            wrap.addEventListener("pointerup", _disableDragging);
            wrap.addEventListener("pointerleave", _disableDragging);
            wrap.addEventListener("update", _updateEl);
            children.forEach((child, idx) => {
                child.dataset.carouselIndex = idx;
                wrap.appendChild(child);
            });
            return wrap;
        },
    };
    this.loginScreen = function () {
        self.open(["login"]);
    };
    this.open = function (menuPath = ["main"]) {
        self.state.open = true;
        menuPath.reduce((currentObj, key) => {
            return currentObj?.[key] ? currentObj[key] : undefined;
        }, self.loadMenu)?.();
    }
    this.close = function (clear = true) {
        if (clear)
            self.loadMenu.clear();
        self.state.open = false;
    }
    this.when = function (eventName, handler, persist = false, once = false) {
        self.element.eventTarget.addEventListener(eventName, (e) => { handler(e.detail) }, {once: once});
        if (persist)
            self.persistentListeners.push({name: eventName, handler: handler});
    }
    this.clearListeners = function (keepPersistent = true) {
        self.element.eventTarget.remove(); // should do nothing since it has no parent (never in DOM), but just in case...
        delete self.element.eventTarget;
        self.element.eventTarget = document.createElement("div");
        if (keepPersistent)
            self.persistentListeners.forEach(({name, handler}) => self.when(name, handler));
    }
    this._appendElement = function (parent, ...children) {
        children.forEach(child => parent.appendChild(child));
    }
    this._appendMenu = function (...elements) {
        self._appendElement(self.element.wrapper, ...elements);
    }
    this._svgDataUri = function (svgEl) {
        return  "data:image/svg+xml;base64," + btoa((new XMLSerializer()).serializeToString(svgEl));
    }
    this._dispatch = function (name = "", detail = {}) {
        if (detail.log && detail.log === true)
            Logger.debug(`[MenuManager] | Dispatched "${name}". Details: `, detail);
        self.element.eventTarget.dispatchEvent(UTIL.createEvent(name, detail));
    }
    // init elements
    this.element.wrapper.id = "menu";
    this.element.wrapper.addEventListener("click", function (event) {
        const clickedSomething = event.target !== self.element.wrapper;
        self._dispatch("click", {target: clickedSomething ? undefined: event.target});
        // [!] may remove later
        if (!clickedSomething && self.backPath?.[0] != "loading")
            if (self.backPath?.length > 0)
                self.open(self.backPath);
            else
                self.close();

        event.preventDefault();
    });
    this.init = function () {
        this.when("loadmenu", (details) => {
            self.backPath = details.history;
        }, true);
        this.state.open = false;
    }
    this.init();
    overlayElement.appendChild(self.element.wrapper);
    return this;
}