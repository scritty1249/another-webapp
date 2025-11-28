import { CookieJar } from "./cookies"

const overlayEl = document.getElementById("overlay");
window.addEventListener("load", function() {
    document.getElementById("version").textContent = "v0.0.5"
});
window.addEventListener("resize", function (event) {
    document.body.height = window.innerHeight;
    document.body.width = window.innerWidth;
    document.documentElement.style.setProperty("--vh", `${String(window.innerHeight / 100)}px`);
    document.documentElement.style.setProperty("--vw", `${String(window.innerWidth / 100)}px`);
});