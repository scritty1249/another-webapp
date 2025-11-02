const overlayZoomFormula = (zoom, maxZoom) => {
    return 1/(
        1 + (Math.E**(-0.5*( zoom-(maxZoom/1.75) )))
    );
};

function overlayElementOnScene(objectPositionData, parentElement, element, scaleRange = [5, 20]) {
    updateOverlayElementOnScene(objectPositionData, element, scaleRange);
    parentElement.appendChild(element);
}
function updateOverlayElementOnScene(objectPositionData, element, scaleRange = [5, 20], clampScale = [0.25, 0.7]) {
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
        const elWrapper = document.createElement("div");
        elWrapper.classList.add("button", "right", "reveal", "pointer-events");
        const el = document.createElement("img");
        el.src = "../source/node-overlay-menu.png";
        elWrapper.appendChild(el);
        return elWrapper;
    }
}

export {
    overlayElementOnScene,
    updateOverlayElementOnScene,
    OverlayElement
};