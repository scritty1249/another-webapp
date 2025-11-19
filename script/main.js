const overlayEl = document.getElementById("overlay");
window.addEventListener("load", function() {
    document.getElementById("version").textContent = "v0.0.45"
});
window.addEventListener("resize", function (event) {
    document.body.height = window.innerHeight;
    document.body.width = window.innerWidth;
});