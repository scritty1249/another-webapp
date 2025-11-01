function overlayElement(objectPositionData, parentElement, element, scaleRange = [0, 20]) { // [!] need to rename to something more fitting
    const scale = clamp(scaleRange[1] - objectPositionData.distance, scaleRange[0], scaleRange[1]) / scaleRange[1];
    element.style.setProperty("--x", `${objectPositionData.x}px`);
    element.style.setProperty("--y", `${objectPositionData.y}px`);
    element.style.setProperty("--scale", scale);
    parentElement.appendChild(element);
}
function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
};

export {
    overlayElement
};