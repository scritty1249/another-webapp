// World/Earth/Globe Manager
import * as UTIL from "./utils.js";
import { Box3, Vector3 } from "three";

export function WorldManager(
    scene,
    renderer,
    camera,
    raycaster,
    tickspeed,
    mouseManager
) {
    const self = this;
    this._renderer = renderer;
    this._raycaster = raycaster;
    this._camera = camera;
    this._scene = scene;
    this._mouseManager = mouseManager;
    this.eventTarget = document.createElement("div");
    this.tick.delta = 0;

    if (
        Object.getPrototypeOf(this) === WorldManager.prototype // don't reinitalize these when subclassing
    ) {
        this.tick.interval = tickspeed;
    }
    
    this._initState();
    return this;
}
WorldManager.prototype = {
    _raycaster: undefined,
    _camera: undefined,
    _mesh: undefined,
    _mouseManager: undefined,
    focusedCountryId: undefined,
    eventTarget: undefined,
    bounds: {},
    country: {}, // never meant to be updated, so additions/deletions are not reflected in set
    countries: [], // never meant to be updated, so additions/deletions are not reflected in dict
    tick: {
        delta: undefined,
        interval: undefined,
    }
};
WorldManager.prototype._initState = function () {
    const self = this;
    this.state = {
        get focusedCountry() {
            return self.focusedCountryId != undefined;
        }
    }
};
WorldManager.prototype._clickListener = function (e) {
    const clickPosition = this._mouseManager.position;
    const clickedCountryId =
        this.getCountryFromFlatCoordinate(
            clickPosition
        );
    if ((clickedCountryId || this.focusedCountryId) && clickedCountryId != this.focusedCountryId) {
        this._dispatch("click", {
            current: clickedCountryId,
            previous: this.focusedCountryId
        });
        this.focusedCountryId = (this.focusedCountryId == clickedCountryId) ? undefined : clickedCountryId;
    } else if (clickedCountryId && this.focusedCountryId == clickedCountryId) {
        const clickedChildId = this.getChildFromFlatCoordinate(clickPosition, clickedCountryId);
        if (clickedChildId)
            this._dispatch("click", {
                child: clickedChildId
            });
    }
}
WorldManager.prototype.gpsToWorld = function (lat, long) {
    const globeRadius = this._mesh.userData.radius * 1.0375;

    // stupid radians
    const latRad = (lat * 0.8) * (Math.PI / 180); // the mesh is squished
    const lonRad = long * (Math.PI / 180);

    // cartesian coords
    return new Vector3(
        globeRadius * Math.cos(latRad) * Math.cos(lonRad),
        globeRadius * Math.sin(latRad),
        globeRadius * Math.cos(latRad) * Math.sin(lonRad)
    );
}
WorldManager.prototype.addMeshData = function (worldMesh) {
    this._mesh = worldMesh;
    this._mesh.userData.children.forEach(country => {
        this.country[country.uuid] = country; // [!] would prefer to go by country name, but for now just uuid...
        this.bounds[country.uuid] = new Box3().setFromObject(country);
        this.countries.push(country);
    });
}
WorldManager.prototype.getClosestCountry = function (coord) {
    const distances = Array.from(Object.entries(this.bounds), ([uuid, bbox]) => { return {
        uuid: uuid,
        distance: bbox.distanceToPoint(coord)
    };});
    distances.sort((a, b) => a.distance - b.distance);
    return distances?.[0].uuid;
}
WorldManager.prototype.getChildFromFlatCoordinate = function (coordinate, countryid) {
    // [!] this modifies the raycaster
    this._raycaster.setFromCamera(coordinate, this._camera);
    const country = this.getCountry(countryid);
    const intersects = this._raycaster.intersectObjects([...country.children, this._mesh.userData.core], false);
    return intersects.length > 0
        && this._mesh.userData.core.uuid != intersects[0].object.uuid
        ? intersects[0].object.uuid
        : undefined;
}
WorldManager.prototype.getCountryFromFlatCoordinate = function (coordinate) {
    // [!] this modifies the raycaster
    this._raycaster.setFromCamera(coordinate, this._camera);
    const intersects = this._raycaster.intersectObjects([...this.countries, this._mesh.userData.core], false);
    return intersects.length > 0
        && this._mesh.userData.core.uuid != intersects[0].object.uuid
        ? intersects[0].object.uuid
        : undefined;
}
WorldManager.prototype.getCountry = function (countryid) {
    const country = this.country[countryid];
    if (!country)
        Logger.throw(
            new Error(
                `[WorldManager] | Country with ID "${countryid}" does not exist.`
            )
        );
    return country;
}
WorldManager.prototype.clear = function () {
    this._scene.remove(this._mesh);
    this.eventTarget = undefined;
    this._renderer.domElement.removeEventListener("clicked", this._clickListener);
}
WorldManager.prototype._dispatch = function (name = "", detail = {}) {
    if (detail.log && detail.log === true)
        Logger.debug(`[WorldManager] | Dispatched "${name}". Details: `, detail);
    if (this.eventTarget)
        this.eventTarget.dispatchEvent(UTIL.createEvent(name, detail));
}
WorldManager.prototype.when = function (eventName, handler, once = false) {
    this.eventTarget.addEventListener(eventName, (e) => { handler(e.detail) }, {once: once});
}
WorldManager.prototype.clearWhen = function (eventName, handler) {
    this.eventTarget.removeEventListener(eventName, handler);
}
WorldManager.prototype._applyIdleAnimations = function (ambientMoveVariance = 0.035) {
    this.countries
        .filter(country => !country.userData.position.needsUpdate && country.uuid != this.focusedCountryId)
        .forEach(country => {
            country.userData.moveTo(
                country.userData.position.origin.clone()
                    .multiplyScalar(
                        1 + (ambientMoveVariance * Math.random())
                    ),
                .0065
            )
        });
}
WorldManager.prototype._updateTick = function (timedelta) {
    this.tick.delta += timedelta;
    for (let t = 0; t <= Math.floor(this.tick.delta / this.tick.interval); t++) {
        // do things within a tick here
        this._applyIdleAnimations();
        this._updateAnimations();
    }    
    if (this.tick.delta >= this.tick.interval)
        this.tick.delta = this.tick.delta % this.tick.interval;
};
WorldManager.prototype._updateAnimations = function () {
    this.countries.forEach(country => {
        country.userData.update();
    });
}
WorldManager.prototype.update = function (timedelta) {
    this._updateTick(timedelta);
}
WorldManager.prototype.init = function () {
    this.eventTarget = document.createElement("div");
    this._scene.add(this._mesh);
    // adding listeners
    this._renderer.domElement.addEventListener("clicked", (e) => {this._clickListener(e)}); // used in conjuction with MouseManager
}