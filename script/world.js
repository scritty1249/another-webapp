// World/Earth/Globe Manager
import * as UTIL from "./utils.js";
import { Vector3, Quaternion } from "three";
import { Outline } from "./mesh.js";

export function WorldManager(
    scene,
    renderer,
    camera,
    raycaster,
    tickspeed,
    mouseManager,
    effectRenderer,
    orbitControls,
) {
    const self = this;
    this._orbitControls = orbitControls;
    this._fxRenderer = effectRenderer;
    this._renderer = renderer;
    this._raycaster = raycaster;
    this._camera = camera;
    this._scene = scene;
    this._mouseManager = mouseManager;
    this.eventTarget = document.createElement("div");
    this.tick.delta = 0;
    this.cameraTween.target = new Vector3();

    if (
        Object.getPrototypeOf(this) === WorldManager.prototype // don't reinitalize these when subclassing
    ) {
        this.tick.interval = tickspeed;
    }
    
    this._initState();
    return this;
}
WorldManager.prototype = {
    _orbitControls: undefined,
    _fxRenderer: undefined,
    _raycaster: undefined,
    _camera: undefined,
    _mesh: undefined,
    _mouseManager: undefined,
    focusedCountryId: undefined,
    focusedCountryOutline: undefined,
    eventTarget: undefined,
    markers: {}, // keep track of markers/objects placed on each country
    country: {}, // never meant to be updated, so additions/deletions are not reflected in set
    countries: [], // never meant to be updated, so additions/deletions are not reflected in dict
    tick: {
        delta: undefined,
        interval: undefined,
    },
    cameraTween: {
        target: undefined,
        speed: 0.1, // configurable
    },
};
WorldManager.prototype._initState = function () {
    const self = this;
    this.state = {
        tweeningCamera: false,
        get focusedCountry() {
            return self.focusedCountryId != undefined;
        },
    }
};
WorldManager.prototype._insertMarker = function (marker, country) {
    this.markers[marker.uuid] = {
        mesh: marker,
        country: country.userData.id
    };
    country.userData.revert(1);
    country.attach(marker);
}
WorldManager.prototype.placeOnWorld = function (lat, long, object, offsetScalar = 1.035) {
    try {
        const worldPos = this.gpsToWorld(lat, long, offsetScalar);
        const closestCountryId = this.getClosestCountry(worldPos);
        object.position.copy(worldPos);
        this._insertMarker(object, this.getCountry(closestCountryId));
        return closestCountryId;
    } catch (err) {
        Logger.error(`[WorldManager] | Failed to add object to world: ${err.message}`)
        return undefined;
    }
}
WorldManager.prototype.removeFromWorld = function (objectid) { // [!] fully disposes of material and geometry. This may interfere with shared geometries and materials.
    const mesh = this.markers[objectid].mesh
    this.getCountry(this.markers[objectid].country)
        .remove(mesh);
    mesh.geometry.dispose();
    if (mesh.material)
        if (Array.isArray(mesh.material))
            mesh.material.forEach(mat => mat.dispose());
        else
            mesh.material.dispose();
    delete this.markers[objectid];
};
WorldManager.prototype._clickListener = function (e) {
    const clickPosition = this._mouseManager.position;
    const clickedCountryId =
        this.getCountryFromFlatCoordinate(
            clickPosition
        );
    if (this.state.focusedCountry) { // select a target within country
        const clickedChildId = this.getChildFromFlatCoordinate(clickPosition, this.focusedCountryId);
        if (clickedChildId)
            this._dispatch("click", {
                child: clickedChildId,
            });
        else if (clickedCountryId && clickedCountryId != this.focusedCountryId)
            this.focusCountry(clickedCountryId);
        else if (!clickedCountryId)
            this.unfocusCountry();
    } else if (clickedCountryId)
        this.focusCountry(clickedCountryId);
}
WorldManager.prototype.focusCountry = function (countryid, dispatch = true) {
    if (countryid == this.focusedCountryId) return;
    const previousCountryId = this.focusedCountryId;
    this.unfocusCountry(false);
    const country = this.getCountry(countryid);
    this._orbitControls.autoRotate = false;
    country.userData.moveTo(country.position.clone().multiplyScalar(1.1), .12);
    country.userData.scaleTo(2, .12);
    this._fxRenderer.addOutline(country, {recursive: false});
    this.focusedCountryId = countryid;
    this.faceCameraTo(countryid);
    Logger.debug(`[WorldManager] | Selected ${countryid}`)
    if (dispatch) // meant to be overridden during internal calls
        this._dispatch("focuschange", {
            current: countryid,
            previous: previousCountryId
        });
}
WorldManager.prototype.unfocusCountry = function (dispatch = true) {
    if (!this.state.focusedCountry) return;
    const country = this.getCountry(this.focusedCountryId);
    country.userData.revert(.12);
    this._fxRenderer.removeOutline(country);
    this.focusedCountryId = undefined;
    this._orbitControls.autoRotate = true;
    if (dispatch) // meant to be overridden during internal calls
        this._dispatch("focuschange", {
            current: undefined,
            previous: this.focusedCountryId
        });
}
WorldManager.prototype.gpsToWorld = function (lat, long, offsetScalar = 1) { // [!] caused some confusion here with JS Geolocation API. Lat N = +, Lat S = -..... Long W = +, Long E = -
    const globeRadius = this._mesh.userData.radius * offsetScalar;

    // stupid radians
    const latRad = (lat * 1.1) * (Math.PI / 180);
    const lonRad = (long * 0.95) * (Math.PI / 180);
    const [x, y, z] = [
        globeRadius * Math.cos(latRad) * Math.cos(lonRad),
        globeRadius * Math.sin(latRad),
        globeRadius * Math.cos(latRad) * Math.sin(lonRad)
    ];
    // cartesian coords
    return new Vector3(x, y, z);
}
WorldManager.prototype.getCountryDirection = function (countryid) { // [!] returns vector not normalized
    const origin = this._mesh.position;
    const target = this.getCountry(countryid)?.userData.position.origin;
    const direction = new Vector3().subVectors(origin, target);
    return direction;
}
WorldManager.prototype.faceCameraTo = function (countryid) { // need to pause orbitControls if used, before calling this function
    const pos = new Vector3();
    this.getCountry(countryid)?.getWorldPosition(pos);
    pos.normalize().multiplyScalar(this._mesh.userData.radius * 2);
    this.tweenCameraTo(pos);
}
WorldManager.prototype.addMeshData = function (worldMesh) {
    this._mesh = worldMesh;
    this._mesh.userData.children.forEach(country => {
        this.country[country.userData.id] = country;
        this.countries.push(country);
    });
}
WorldManager.prototype.getClosestCountry = function (coord) {
    // [!] this modifies the raycaster
    const pos = coord.clone()
            .multiplyScalar(this._orbitControls.maxDistance);
    const direction = new Vector3();
    this._mesh.getWorldPosition(direction);
    direction.sub(pos).normalize();
    this._raycaster.set(
        pos,
        direction
    );
    const intersects = this._raycaster.intersectObjects([...this.countries, this._mesh.userData.core], false);
    return intersects.length > 0
        && this._mesh.userData.core.uuid != intersects[0].object.uuid
        ? intersects[0].object.userData.id
        : undefined;
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
        ? intersects[0].object.userData.id
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
    this.countries.forEach(country => {
        country.userData.revert(1);
        country.children.forEach(child =>
            country.remove(child)
        )
    });
    this.unfocusCountry();
    Object.keys(this.markers).forEach(markerid => this.removeFromWorld(markerid));
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
WorldManager.prototype.tweenCameraTo = function (position, speed = undefined) {
    this.state.tweeningCamera = true;
    this.cameraTween.target.copy(position);
    if (speed)
        this.cameraTween.speed = speed;
}
WorldManager.prototype._applyCameraTween = function () {
    if (!this.state.tweeningCamera) return;
    if (this._camera.position.distanceTo(this.cameraTween.target) <= 0.01) {
        this._camera.position.copy(this.cameraTween.target); // snap to position
        this.state.tweeningCamera = false;
    } else
        this._camera.position.lerp(this.cameraTween.target, this.cameraTween.speed); // [!] eventually, replace this with actual tweening. Calculate angle between points to curve camera around the globe, instead of through it.
}
WorldManager.prototype._applyIdleAnimations = function (ambientMoveVariance = 0.05) {
    this.countries
        .filter(country => !country.userData.position.needsUpdate && country.userData.id != this.focusedCountryId)
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
        this._applyCameraTween();
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