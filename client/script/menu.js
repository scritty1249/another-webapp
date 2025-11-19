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
    createButton: function (direction = "ne", buttonType = undefined, events = {}, buttonLength = 2) {
        const angle = direction == "ne"
            ? 67.5
            : direction == "nw"
            ? -67.5
            : direction == "se"
            ? 112.5
            : direction == "sw"
            ? -112.5
            : 0;
        const el = this.configurableTileSvg(buttonLength, angle, (
            buttonType ? [this.iconSvgImg(menuPath + buttonType + "-icon.png")] : []
        ))
        el.classList.add("pointer-events", "button", "no-bg");
        el.style.setProperty("--size", buttonLength * 12.5)
        Object.entries(events).forEach(([eventType, handler]) => el.addEventListener(eventType, handler));

        return el;
    },
    svgToDataUri: function (svg) {
        return  "data:image/svg+xml;base64," + btoa((new XMLSerializer()).serializeToString(svg));
    },
    iconSvgImg: function (imgPath) {
        // original dimensions should be 500x500 px
        var el = document.createElementNS("http://www.w3.org/2000/svg","image");
        el.setAttributeNS(null,"height","100%");
        el.setAttributeNS(null,"width","100%");
        el.setAttributeNS("http://www.w3.org/1999/xlink","href", imgPath);
        el.setAttributeNS(null,"x","-50%");
        el.setAttributeNS(null,"y","-100%");
        el.setAttributeNS(null, "visibility", "visible");
        return el;
    },
    configurableTileSvg: function (scaleLength = 1, rotation = 0, children = [], size = 100, fill = "#ff5757") {
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
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const outerPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const innerPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
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
        children.forEach(child => svg.appendChild(child));

        return svg;
    },
};

export default Menu;