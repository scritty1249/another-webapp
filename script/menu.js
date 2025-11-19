// main pause menu
const menuPath = "./source/menu/"
const menuButtonName = (type) => `menu-${type}-button.png`;
const stopPropagation = (el) => el.addEventListener("click", function (event) {
    event.stopPropagation();
});

const Menu = {
    createMenu: function (
        destroyMenuCallback = () => {},
        topLeft = [],
        topRight = [],
        bottomLeft = [],
        bottomRight = []
    ) {
        const wrapper = document.createElement("div");
        wrapper.id = "menu";
        wrapper.addEventListener("click", function (event) {
            event.preventDefault();
            destroyMenuCallback();
        });
        
        const sections = {
            tl: document.createElement("div"),
            tr: document.createElement("div"),
            bl: document.createElement("div"),
            br: document.createElement("div")
        };
        sections.tl.classList.add("top-left");
        sections.tr.classList.add("top-right");
        sections.bl.classList.add("bottom-left");
        sections.br.classList.add("bottom-right");
        wrapper.appendChild(sections.tl);
        wrapper.appendChild(sections.tr);
        wrapper.appendChild(sections.bl);
        wrapper.appendChild(sections.br);
        topLeft.forEach(el => {
            stopPropagation(el);
            sections.tl.appendChild(el);
        });
        topRight.forEach(el => {
            stopPropagation(el);
            sections.tr.appendChild(el);
        });
        bottomLeft.forEach(el => {
            stopPropagation(el);
            sections.bl.appendChild(el);
        });
        bottomRight.forEach(el => {
            stopPropagation(el);
            sections.br.appendChild(el);
        });
        return wrapper;
    },
    createButton: function (direction = "ne", buttonType = undefined, events = {}) {
        const el = document.createElement("div");
        el.classList.add("pointer-events", "button", "no-bg");
        // original dimensions 500x500 px
        //el.style.backgroundImage = `url("${menuPath + direction + "-button.png"}")`

        const svgUri = "data:image/svg+xml;base64," + btoa((new XMLSerializer()).serializeToString(this.configurableTile(100, 2, 45)))
        el.style.backgroundImage = `url("${svgUri}")`;

        if (buttonType)
            el.style.backgroundImage += `, url("${menuPath + buttonType + "-icon.png"}")`;
        el.style.width = "calc(var(--unit) * 20)";
        el.style.height = "calc(var(--unit) * 20)";
        Object.entries(events).forEach(([eventType, handler]) => el.addEventListener(eventType, handler));

        return el;
    },
    configurableTile: function (size = 100, scaleLength = 1, rotation = 0, fill = "#ff5757") {
        /*
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -100 100 100">
        */
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
        const newViewBox = `${String(-50 *scaleLength)} ${String(-100 - newLengthOffset)} ${String(100 + newLengthOffset)} ${String(100 + newLengthOffset)}`;
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
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const outerPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const innerPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        outerPath.setAttribute("fill", fill);
        outerPath.setAttribute("d", newOuterPathData);
        innerPath.setAttribute("fill", fill);
        innerPath.setAttribute("fill-opacity", "0.5");
        innerPath.setAttribute("d", newInnerPathData);
        svg.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
        svg.setAttribute("width", String(size * scaleLength));
        svg.setAttribute("height", String(size * scaleLength));
        svg.setAttribute("viewBox", newViewBox);
        svg.setAttribute("transform", `rotate(${String(rotation)})`);
        svg.appendChild(outerPath);
        svg.appendChild(innerPath);
        return svg;
    },
};

export default Menu;