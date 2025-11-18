// main pause menu
const menuPath = "../source/menu/"
const menuButtonName = (type) => `menu-${type}-button.png`;

const Menu = {
    createMenu: function (
        destroyMenuCallback = () => {}, ...elements
    ) {
        const wrapper = document.createElement("div");
        wrapper.id = "menu";
        wrapper.addEventListener("click", function (event) {
            event.preventDefault();
            destroyMenuCallback();
        });

        elements.forEach(el => {
            el.addEventListener("click", function (event) {
                event.stopPropagation();
            });
            wrapper.appendChild(el)
        });
        return wrapper;
    },
    createButton: function (buttonType = "blank", classes = [], events = {}) {
        const el = document.createElement("div");
        el.classList.add("pointer-events", "button", "no-bg", ...classes);
        // original dimensions 500x500 px
        el.style.backgroundImage = `url("${menuPath + menuButtonName(buttonType)}")`
        el.style.width = "calc(var(--unit) * 20)";
        el.style.height = "calc(var(--unit) * 20)";
        Object.entries(events).forEach(([eventType, handler]) => el.addEventListener(eventType, handler));

        return el;
    },
};

export default Menu;