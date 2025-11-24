import * as UTIL from "./utils.js";

// main pause menu
const SVG_NS = "http://www.w3.org/2000/svg";
const menuPath = "./source/menu/"
const menuButtonName = (type) => `menu-${type}-button.png`;
const stopPropagation = (el) => {
    el.addEventListener("click", function (event) {
        event.stopPropagation();
    });
    return el;
}

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
            const buttons = [ // placeholders
                self.createElement.button(90, undefined, "Sign in", { // placeholder
                    click: () => self._dispatch("login", {}),
                }, 4),
                self.createElement.button(90, undefined, "Create account", {
                    click: () => self._dispatch("newlogin", {}),
                }, 4),
            ];
            self._appendElement(central, ...buttons);
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
                self.createElement.button(-67.5, undefined, "swap phases", {
                    click: (event) => {
                        self.loadMenu.pickTarget();
                    }
                }, 2)
            ));
            self._appendMenu(...Object.values(section));
            self._dispatch("loadmenu", {history: []});
        },
        pickTarget: function () { // [!] For now swaps between build and attack phases, but in prod should actually be used for selecting a target
            self.loadMenu.clear();
            self.element.wrapper.classList.add("pickTarget");
            const central = document.createElement("div");
            central.classList.add("center", "absolutely-center");

            const attackBtn = self.createElement.button(0, undefined, "attack", {
                click: (event) => {
                    self._dispatch("swapphase", { phase: "attack", log: true });
                }
            }, 5);
            const buildBtn = self.createElement.button(0, undefined, "build", {
                click: (event) => {
                    self._dispatch("swapphase", { phase: "build", log: true });
                }
            }, 5);

            self._appendElement(central, attackBtn, buildBtn);
            self._appendMenu(central);
            self._dispatch("loadmenu", { history: ["main"] });
        },
        settings: {
            main: function () {
                self.loadMenu.clear();
                self.element.wrapper.classList.add("settings", "main-settings");
                const central = document.createElement("div");
                central.classList.add("center", "absolutely-center");
                const buttons = [ // placeholders
                    self.createElement.button(90, "gear", "Low performance on", { // placeholder
                        click: () => self._dispatch("lowperformance", {set: true}),
                    }, 4),
                    self.createElement.button(90, "gear", "Low performance off", {
                        click: () => self._dispatch("lowperformance", {set: false}),
                    }, 4),
                    self.createElement.button(90, "add-node", "Load layout\nfrom clipboard", {
                        click: () => self._dispatch("_loadlayout"),
                    }, 4),
                    self.createElement.button(90, "gear", "Copy layout\nto clipboard", {
                        click: () => self._dispatch("_savelayout"),
                    }, 4),
                    self.createElement.button(90, "cpu", "Save debug file", {
                        click: () => self._dispatch("_savelog"),
                    }, 4),
                    self.createElement.button(90, "gear", "Save layout", {
                        click: () => self._dispatch("save"),
                    }, 4),
                ];
                self._appendElement(central, ...buttons);
                self._appendMenu(central);
                self._dispatch("loadmenu", { history: ["main"] });
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
                central.classList.add("center", "absolutely-center");
                const buttons = [ // placeholders
                    self.createElement.button(90, "add-node", "Add placeholder", { // placeholder
                        click: () => self._dispatch("addnode", {nodeType: "placeholder"}),
                    }, 4),
                    self.createElement.button(90, "add-node", "Add globe", { // globe
                        click: () => self._dispatch("addnode", {nodeType: "globe"}),
                    }, 4),
                    self.createElement.button(90, undefined, undefined, {

                    }, 4),
                    self.createElement.button(90, "lock", undefined, {

                    }, 4),
                ];
                self._appendElement(central, ...buttons);
                self._appendMenu(central);
                self._dispatch("loadmenu", {history: ["addNode", "selectType"]});
            },
            defenseType: function () {
                self.loadMenu.clear();
                self.element.wrapper.classList.add("addNode", "defenseType");
                const central = document.createElement("div");
                central.classList.add("center", "absolutely-center");
                const buttons = [ // placeholders
                    self.createElement.button(90, "add-node", "Add cube", { // cube
                        click: () => self._dispatch("addnode", {nodeType: "cube"}),
                    }, 4),
                    self.createElement.button(90, "add-node", "Add scanner", { // scanner
                        click: () => self._dispatch("addnode", {nodeType: "scanner"}),
                    }, 4),
                    self.createElement.button(90, "lock", undefined, {

                    }, 4),
                    self.createElement.button(90, "lock", undefined, {

                    }, 4),
                ];
                self._appendElement(central, ...buttons);
                self._appendMenu(central);
                self._dispatch("loadmenu", {history: ["addNode", "selectType"]});
            },
            econType: function () {
                self.loadMenu.clear();
                self.element.wrapper.classList.add("addNode", "econType");
                const central = document.createElement("div");
                central.classList.add("center", "absolutely-center");
                const buttons = [ // placeholders
                    self.createElement.button(90, undefined, undefined, {

                    }, 4),
                    self.createElement.button(90, "lock", undefined, {

                    }, 4),
                    self.createElement.button(90, "lock", undefined, {

                    }, 4),
                    self.createElement.button(90, "lock", undefined, {

                    }, 4),
                ];
                self._appendElement(central, ...buttons);
                self._appendMenu(central);
                self._dispatch("loadmenu", {history: ["addNode", "selectType"]});
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
            if (buttonType && text) {
                children[0].setAttributeNS(null,"x","-80%");
                children[0].setAttributeNS(null,"width","100%");
                children[1].setAttributeNS(null,"x","10%");
            }
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
            // original dimensions should be 500x500 px
            var el = document.createElementNS(SVG_NS,"image");
            el.setAttributeNS(null,"height","100%");
            el.setAttributeNS(null,"width","100%");
            el.setAttributeNS("http://www.w3.org/1999/xlink","href", imgPath);
            el.setAttributeNS(null,"x","-50%");
            el.setAttributeNS(null,"y","-100%");
            el.setAttributeNS(null, "visibility", "visible");
            return el;
        },
        svgText: function (textlines, scale = 0.75, fontColor = "#ff5757", fontPath = undefined) {
            var el = document.createElementNS(SVG_NS,"text");
            el.setAttributeNS(null,"height","100%");
            el.setAttributeNS(null,"width","100%");
            el.setAttributeNS(null,"y","-50%");
            el.setAttributeNS(null, "fill", fontColor);
            el.setAttributeNS(null, "visibility", "visible");
            el.setAttributeNS(null, "dominant-baseline", "middle");
            el.setAttributeNS(null, "text-anchor", "middle");
            textlines.forEach(textline => {
                const line = document.createElementNS(SVG_NS, "tspan");
                line.setAttributeNS(null, "x", "0");
                if (el.firstChild)
                    line.setAttributeNS(null, "dy", "1.2rem");
                line.textContent = textline;
                el.appendChild(line);
            });
            return el;
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
    this.when = function (eventName, handler, persist = false) {
        self.element.eventTarget.addEventListener(eventName, (e) => { handler(e.detail) });
        if (persist)
            self.persistentListeners.push({name: eventName, handler: handler});
    }
    this.clearListeners = function (keepPersistent = true) {
        self.element.eventTarget.remove(); // should do noting since it has no parent (never in DOM), but just in case...
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
        if (!clickedSomething)
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