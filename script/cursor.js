import * as UTIL from "./utils.js";
import { Vector2 } from "three";

// Doesn't interact with scroll wheel since it's easier to go off of the camera controller events
export function Mouse(
    window,
    canvasDomElement, // will be the renderer DOM element
    clickThresholdMs = 400,
    clickThresholdPx = 10
) {
    const self = this;
    this._clickTime = clickThresholdMs; // milliseconds
    this._clickDistance = clickThresholdPx; // pixels
    this._window = window;
    this.canvasElement = canvasDomElement;
    this.up = {
        time: undefined,
        event: undefined,
        set: function (time, event) {
            this.time = time;
            this.event = event;
            return this;
        },
        unset: function () {
            this.time = undefined;
            this.event = undefined;
            return this;
        },
        get bool() {
            return this.time != undefined && this.event != undefined;
        }
    };
    this.down = {
        time: undefined,
        event: undefined,
        set: function (time, event) {
            this.time = time;
            this.event = event;
            return this;
        },
        unset: function () {
            this.time = undefined;
            this.event = undefined;
            return this;
        },
        get bool() {
            return this.time != undefined && this.event != undefined;
        }
    };
    this.position = { // everything in this module is for the mouse only. So this is only for 2D coords on the window, and never anything else.
        x: undefined,
        y: undefined,
        set: function(x, y) {
            this.x = x;
            this.y = y;
            return this;
        },
        unset: function() {
            this.x = undefined;
            this.y = undefined;
            return this;
        },
        vector: function() {
            return new Vector2(this.x, this.y);
        }
    };
    this._initListeners = function () {
        this._window.addEventListener('mousemove', function (event) {
            self.position.set(
                (event.clientX / self._window.innerWidth) * 2 - 1,
                -(event.clientY / self._window.innerHeight) * 2 + 1
            );
        }, false);
        this.canvasElement.addEventListener("mousedown", function(event) {
            self.up.unset();
            self.down.set(Date.now(), event);
        });
        this.canvasElement.addEventListener("mouseup", function(event) {
            self.up.set(Date.now(), event);
            if (
                self.down.bool &&
                self.up.time - self.down.time < self._clickTime && 
                self.distanceTraveledSquared() < self._clickDistance ** 2
            )
                self.canvasElement.dispatchEvent(
                    UTIL.createEvent("clicked", { button: self.up.event.button })
                );
        });
        this.canvasElement.addEventListener("contextmenu", function(event) {
            event.preventDefault();
        });
    }
    this.getNextEvent = function (eventName) {
        return new Promise(function (resolve) {
            self.canvasElement.addEventListener(eventName, function (event) {
                //call any handler you want here, if needed
                resolve(event);
            }, { once: true });
        });
    }
    this.distanceTraveled = function () {
        if (self.down.bool && self.up.bool)
            return (new Vector2(self.down.event.clientX, self.down.event.clientY))
                .distanceTo(new Vector2(self.up.event.clientX, self.up.event.clientY));
        return 0;
    }
    this.distanceTraveledSquared = function () {  // supposedly more efficient to use for comparison, according to threejs docs
        if (self.down.bool && self.up.bool)
            return (new Vector2(self.down.event.clientX, self.down.event.clientY))
                .distanceToSquared(new Vector2(self.up.event.clientX, self.up.event.clientY));
        return 0;
    }

    this._initListeners();
    return this;
}

// [!] low priority, incomplete
export function Touch(
    canvasDomElement, // will be the renderer DOM element
) {
    this.canvasElement = canvasDomElement;
    return this;
}