// World/Earth/Globe Manager
import * as UTIL from "./utils.js";
import * as THREEUTIL from "./three-utils.js";
import { Vector3, Quaternion, Box3 } from "three";
import { WorldMarker } from "./mesh.js";

export function WorldManager(
    scene,
    renderer,
    camera,
    raycaster,
    mouseManager,
    effectRenderer,
    orbitControls
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
    this.cameraTween.target = new Vector3();

    if (
        Object.getPrototypeOf(this) === WorldManager.prototype // don't reinitalize these when subclassing
    ) {

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
    enabled: false,
    markers: {}, // keep track of markers/objects placed on each country
    country: {}, // never meant to be updated, so additions/deletions are not reflected in set
    countries: [], // never meant to be updated, so additions/deletions are not reflected in dict
    cameraTween: {
        target: undefined,
        speed: 0.1, // configurable
    },
    get origin() {
        const origin = new Vector3();
        this._mesh.userData.core.getWorldPosition(origin);
        return origin;
    },
};
WorldManager.prototype._initState = function () {
    const self = this;
    this.state = {
        tweeningCamera: false,
        get focusedCountry() {
            return self.focusedCountryId != undefined;
        },
    };
};
WorldManager.prototype._insertMarker = function (marker, country) {
    this.markers[marker.uuid] = {
        mesh: marker,
        country: country.userData.id,
    };
    country.userData._reset((c) => {
        c.attach(marker);
    });
};
WorldManager.prototype.markOnWorld = function (
    lat,
    long,
    targetid,
    markerLength = 1
) {
    try {
        const startPos = this.gpsToWorld(lat, long);
        const endPos = startPos
            .clone()
            .add(this._getDirection(startPos).multiplyScalar(markerLength));
        const closestCountryId = this.getClosestCountry(startPos);
        const marker = WorldMarker(startPos, endPos);
        marker.userData.targetid = targetid;
        marker.userData.head.userData.targetid = targetid; // [!] temporary fix
        this._insertMarker(marker, this.getCountry(closestCountryId));
        return closestCountryId;
    } catch (err) {
        Logger.error(
            `[WorldManager] | Failed to add marker to world at (${lat}, ${long}): ${err.message}`
        );
        return undefined;
    }
};
WorldManager.prototype.placeOnWorld = function (
    lat,
    long,
    object,
    offsetScalar = 1.035
) {
    try {
        const worldPos = this.gpsToWorld(lat, long, offsetScalar);
        const closestCountryId = this.getClosestCountry(worldPos);
        object.position.copy(worldPos);
        this._insertMarker(object, this.getCountry(closestCountryId));
        return closestCountryId;
    } catch (err) {
        Logger.error(
            `[WorldManager] | Failed to add object to world at (${lat}, ${long}): ${err.message}`
        );
        return undefined;
    }
};
WorldManager.prototype.removeFromWorld = function (objectid) {
    // [!] fully disposes of material and geometry. This may interfere with shared geometries and materials.
    const mesh = this.markers[objectid].mesh;
    this.getCountry(this.markers[objectid].country).remove(mesh);
    mesh.geometry.dispose();
    if (mesh.material)
        if (Array.isArray(mesh.material))
            mesh.material.forEach((mat) => mat.dispose());
        else mesh.material.dispose();
    delete this.markers[objectid];
};
WorldManager.prototype._clickListener = function (e) {
    if (this.enabled) {
        const clickPosition = this._mouseManager.position;
        const clickedCountryId =
            this.getCountryFromFlatCoordinate(clickPosition);
        if (this.state.focusedCountry) {
            // select a target within country
            const clickedTarget = this.getTargetFromFlatCoordinate(
                clickPosition,
                this.focusedCountryId
            );
            if (clickedTarget)
                this._dispatch("click", {
                    target: clickedTarget,
                });
            else if (
                clickedCountryId &&
                clickedCountryId != this.focusedCountryId
            )
                this.focusCountry(clickedCountryId);
            else if (!clickedCountryId) this.unfocusCountry();
        } else if (clickedCountryId) this.focusCountry(clickedCountryId);
    }
};
WorldManager.prototype.focusCountry = function (countryid, dispatch = true) {
    if (countryid == this.focusedCountryId) return;
    const previousCountryId = this.focusedCountryId;
    this.unfocusCountry(false);
    const country = this.getCountry(countryid);
    this._orbitControls.autoRotate = false;
    country.userData.moveTo(country.position.clone().multiplyScalar(1.1), 0.12);
    country.userData.scaleTo(2, 0.12);
    this._fxRenderer.addOutline(country, { recursive: false });
    this.focusedCountryId = countryid;
    this._focusMarkers();
    this.faceCameraTo(countryid);
    Logger.debug(`[WorldManager] | Selected ${countryid}`);
    if (dispatch)
        // meant to be overridden during internal calls
        this._dispatch("focuschange", {
            current: countryid,
            previous: previousCountryId,
        });
};
WorldManager.prototype.unfocusCountry = function (dispatch = true) {
    if (!this.state.focusedCountry) return;
    const country = this.getCountry(this.focusedCountryId);
    country.userData.revert(0.12);
    this._unfocusMarkers();
    this._fxRenderer.removeOutline(country);
    this.focusedCountryId = undefined;
    this._orbitControls.autoRotate = true;
    if (dispatch)
        // meant to be overridden during internal calls
        this._dispatch("focuschange", {
            current: undefined,
            previous: this.focusedCountryId,
        });
};
WorldManager.prototype._focusMarkers = function () {
    if (!this.state.focusedCountry) return;
    const country = this.getCountry(this.focusedCountryId);
    const markers = Object.values(this.markers)
        .filter((m) => m.country == this.focusedCountryId)
        ?.map((m) => m.mesh);
    markers.forEach((marker, idx) => {
        marker.userData._ogscale = marker.scale.x;
        marker.scale.multiplyScalar(0.2 * (idx + 1) + 0.5);
    });
};
WorldManager.prototype._unfocusMarkers = function () {
    if (!this.state.focusedCountry) return;
    const country = this.getCountry(this.focusedCountryId);
    const markers = Object.values(this.markers)
        .filter((m) => m.country == this.focusedCountryId)
        ?.map((m) => m.mesh);
    markers.forEach((marker, idx) => {
        if (marker.userData._ogscale) {
            marker.scale.setScalar(marker.userData._ogscale);
            delete marker.userData._ogscale;
        }
    });
};
WorldManager.prototype.gpsToWorld = function (lat, long, offsetScalar = 0) {
    // [!] caused some confusion here with JS Geolocation API. Lat N = +, Lat S = -..... Long W = +, Long E = -
    let globeRadius = this._mesh.userData.radius * offsetScalar;
    if (offsetScalar == 0) {
        globeRadius = this._mesh.userData._reset((_) => {
            const basepos = this.gpsToWorld(lat, long, 1);
            const direction = THREEUTIL.directionVector(basepos, this.origin);
            const raypos = basepos.add(
                direction
                    .clone()
                    .multiplyScalar(this._orbitControls.maxDistance)
            );
            const intersect = THREEUTIL.raycast(
                this._raycaster,
                [...this.countries, this._mesh.userData.core],
                false
            );
            return intersect
                ? Math.abs(intersect.point.distanceTo(this.origin))
                : this._mesh.userData.radius;
        });
    }
    // stupid radians
    const latRad = lat * 1.1 * (Math.PI / 180);
    const lonRad = long * 0.95 * (Math.PI / 180);
    const [x, y, z] = [
        globeRadius * Math.cos(latRad) * Math.cos(lonRad),
        globeRadius * Math.sin(latRad),
        globeRadius * Math.cos(latRad) * Math.sin(lonRad),
    ];
    // cartesian coords
    return new Vector3(x, y, z);
};
WorldManager.prototype._getDirection = function (position) {
    return THREEUTIL.directionVector(this.origin, position);
};
WorldManager.prototype.getCountryDirection = function (countryid) {
    const target = this.getCountry(countryid)?.userData.position.origin;
    return this._getDirection(target);
};
WorldManager.prototype.faceCameraTo = function (countryid) {
    // need to pause orbitControls if used, before calling this function
    const pos = new Vector3();
    this.getCountry(countryid)?.getWorldPosition(pos);
    pos.normalize().multiplyScalar(this._mesh.userData.radius * 2);
    this.tweenCameraTo(pos);
};
WorldManager.prototype.addMeshData = function (worldMesh) {
    this._mesh = worldMesh;
    this._mesh.userData.children.forEach((country) => {
        this.country[country.userData.id] = country;
        this.countries.push(country);
    });
};
WorldManager.prototype.getClosestCountry = function (coord) {
    // [!] still, cannot detect if inside of Russia.
    return this._mesh.userData._reset((_) => {
        const direction = THREEUTIL.directionVector(coord, this.origin);
        const raypos = direction
            .clone()
            .multiplyScalar(this._mesh.userData.radius * 2);
        const intersect = THREEUTIL.raycast(
            this._raycaster,
            [...this.countries, this._mesh.userData.core],
            false
        );
        if (intersect && intersect.object.uuid != this._mesh.userData.core.uuid)
            // intersection found
            return intersect.object.userData.id;
        const bboxes = this.countries.filter((c) => {
            const bbox = new Box3().setFromObject(c);
            return bbox.containsPoint(coord);
        });
        if (bboxes.length === 1)
            // within a country
            return bboxes[0].userData.id;
        if (bboxes.length > 1)
            // within multiple country bounding boxes, go by closest origin
            bboxes
                .map((c) => {
                    return {
                        distance: c.position.distanceTo(coord),
                        id: c.userData.id,
                    };
                })
                ?.toSorted((a, b) => a.distance - b.distance)?.[0].id;
        return this.countries // outside of country, go by promixity to a country's edge
            .map((c) => {
                return {
                    distance: THREEUTIL.distanceTo(c, coord),
                    id: c.userData.id,
                };
            })
            ?.toSorted((a, b) => a.distance - b.distance)?.[0].id;
    });
};
WorldManager.prototype.getTargetFromFlatCoordinate = function (
    coordinate,
    countryid
) {
    // [!] this modifies the raycaster
    this._raycaster.setFromCamera(coordinate, this._camera);
    const country = this.getCountry(countryid);
    const targets = Object.values(this.markers)
        .filter((m) => m.country == countryid)
        ?.map((m) => m.mesh);
    const intersects = this._raycaster.intersectObjects(
        [...targets, this._mesh.userData.core],
        true
    );
    return intersects.length > 0 &&
        this._mesh.userData.core.uuid != intersects[0].object.uuid
        ? {
              // this IS EXPECTED.
              id: intersects[0].object.userData.targetid,
          }
        : undefined;
};
WorldManager.prototype.getCountryFromFlatCoordinate = function (coordinate) {
    // [!] this modifies the raycaster
    this._raycaster.setFromCamera(coordinate, this._camera);
    const intersects = this._raycaster.intersectObjects(
        [...this.countries, this._mesh.userData.core],
        false
    );
    return intersects.length > 0 &&
        this._mesh.userData.core.uuid != intersects[0].object.uuid
        ? intersects[0].object.userData.id
        : undefined;
};
WorldManager.prototype.getCountry = function (countryid) {
    const country = this.country[countryid];
    if (!country)
        Logger.throw(
            new Error(
                `[WorldManager] | Country with ID "${countryid}" does not exist.`
            )
        );
    return country;
};
WorldManager.prototype.clear = function () {
    this._scene.remove(this._mesh);
    this.eventTarget = undefined;
    this.enabled = false;
    this.countries.forEach((country) => {
        country.userData.revert(1);
        country.children.forEach((child) => country.remove(child));
    });
    this.unfocusCountry();
    Object.keys(this.markers).forEach((markerid) =>
        this.removeFromWorld(markerid)
    );
};
WorldManager.prototype._dispatch = function (name = "", detail = {}) {
    if (detail.log && detail.log === true)
        Logger.debug(
            `[WorldManager] | Dispatched "${name}". Details: `,
            detail
        );
    if (this.eventTarget)
        this.eventTarget.dispatchEvent(UTIL.createEvent(name, detail));
};
WorldManager.prototype.when = function (eventName, handler, once = false) {
    this.eventTarget.addEventListener(
        eventName,
        (e) => {
            handler(e.detail);
        },
        { once: once }
    );
};
WorldManager.prototype.clearWhen = function (eventName, handler) {
    this.eventTarget.removeEventListener(eventName, handler);
};
WorldManager.prototype.tweenCameraTo = function (position, speed = undefined) {
    this.state.tweeningCamera = true;
    this.cameraTween.target.copy(position);
    if (speed) this.cameraTween.speed = speed;
};
WorldManager.prototype._applyCameraTween = function () {
    if (!this.state.tweeningCamera) return;
    if (this._camera.position.distanceTo(this.cameraTween.target) <= 0.01) {
        this._camera.position.copy(this.cameraTween.target); // snap to position
        this.state.tweeningCamera = false;
    } else
        this._camera.position.lerp(
            this.cameraTween.target,
            this.cameraTween.speed
        ); // [!] eventually, replace this with actual tweening. Calculate angle between points to curve camera around the globe, instead of through it.
};
WorldManager.prototype._applyIdleAnimations = function (
    ambientMoveVariance = 0.05
) {
    this.countries
        .filter(
            (country) =>
                !country.userData.position.needsUpdate &&
                country.userData.id != this.focusedCountryId
        )
        .forEach((country) => {
            country.userData.moveTo(
                country.userData.position.origin
                    .clone()
                    .multiplyScalar(1 + ambientMoveVariance * Math.random()),
                0.0065
            );
        });
};
WorldManager.prototype._updateAnimations = function () {
    this.countries.forEach((country) => {
        country.userData.update();
    });
};
WorldManager.prototype.update = function () {
    this._applyIdleAnimations();
    this._updateAnimations();
    this._applyCameraTween();
};
WorldManager.prototype.init = function () {
    this.eventTarget = document.createElement("div");
    this._scene.add(this._mesh);
    this.enabled = true;
    // adding listeners
    this._renderer.domElement.addEventListener("clicked", (e) => {
        this._clickListener(e);
    }); // used in conjuction with MouseManager
};
