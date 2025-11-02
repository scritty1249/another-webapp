const overlayZoomFormula = (zoom, maxZoom) => {
    return 1/(
        1 + (Math.E**(-0.5*( zoom-(maxZoom/2.5) )))
    );
};
function overlayElementOnScene(objectPositionData, parentElement, element, scaleRange = [5, 20]) {
    updateOverlayElementOnScene(objectPositionData, element, scaleRange);
    parentElement.appendChild(element);
}
function updateOverlayElementOnScene(objectPositionData, element, scaleRange = [5, 20], clampScale = [0.25, 0.5]) {
    const scale = clamp(overlayZoomFormula(
        scaleRange[1] - clamp(objectPositionData.distance, scaleRange[0], scaleRange[1]),
        scaleRange[1]
    ), clampScale[0], clampScale[1]);
    // Adjust translation proportionally to scale- compensate for newly empty space
    const x = objectPositionData.x - ((element.clientWidth - (element.clientWidth * scale)) / 2);
    const y = objectPositionData.y; 
    element.style.setProperty("--x", `${x}px`);
    element.style.setProperty("--y", `${y}px`);
    element.style.setProperty("--scale", scale);
}
function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
};
const OverlayElement = {
    createNodeMenu: function() {
        const el = document.createElement("div");
        el.classList.add("nodeMenu", "right", "reveal");
        // hard coded- needs to be updated if file changes.
        el.style.backgroundImage = `url("../source/node-overlay-menu.png")`;
        el.style.minWidth = "516px";
        el.style.minHeight = "545px";
        el.style.width = "516px";
        el.style.height = "545px";

        const linkButton = this.createLinkButton();
        el.appendChild(linkButton);
        
        return el;
    },
    createLinkButton: function() {
        const el = document.createElement("div");
        el.classList.add("button", "pointer-events");
        el.dataset.buttonType = "link";
        el.style.backgroundImage = `url("../source/link-button.png")`;
        el.style.width = "182px";
        el.style.height = "55px";
        el.style.setProperty("--left", "101px");
        el.style.setProperty("--top", "104px");
        
        return el;
    }
}
function isDifferenceZero(num, num2) {
    return Math.abs(num) - Math.abs(num2) < Number.EPSILON;
}
export {
    overlayElementOnScene,
    updateOverlayElementOnScene,
    OverlayElement
};