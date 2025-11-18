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
            stopPropagation(el)
            sections.tl.appendChild(el)
        });
        topRight.forEach(el => {
            stopPropagation(el)
            sections.tr.appendChild(el)
        });
        bottomLeft.forEach(el => {
            stopPropagation(el)
            sections.bl.appendChild(el)
        });
        bottomRight.forEach(el => {
            stopPropagation(el)
            sections.br.appendChild(el)
        });
        return wrapper;
    },
    createButton: function (buttonType = "blank", events = {}) {
        const el = document.createElement("div");
        el.classList.add("pointer-events", "button", "no-bg");
        // original dimensions 500x500 px
        el.style.backgroundImage = `url("${menuPath + menuButtonName(buttonType)}")`
        el.style.width = "calc(var(--unit) * 20)";
        el.style.height = "calc(var(--unit) * 20)";
        Object.entries(events).forEach(([eventType, handler]) => el.addEventListener(eventType, handler));

        return el;
    },
};

export default Menu;