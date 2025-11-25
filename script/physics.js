import * as THREE from "three";
import { isVectorZero } from "./three-utils.js";

export function PhysicsManager (
    nodeManager,
    maxDistance,
    maxProximity,
    attractForce,
    repelForce,
    passiveForce,
) {
    const self = this;
    this._nodeManager = nodeManager;
    this.config = {
        maxDistance: maxDistance,
        maxProximity: maxProximity,
        pushForce: repelForce,
        pullForce: attractForce,
        passiveForce: passiveForce
    };
    this._enabled = true;
    this._applyAmbientForce = function (node) {
        const axisZero = new THREE.Vector3(node.position.x, 0, node.position.z);
        const distance = node.position.distanceTo(axisZero);
        const magnitude = distance * self.config.passiveForce;
        const forceVector = new THREE.Vector3();
        const direction = new THREE.Vector3().subVectors(
            node.position,
            axisZero
        );
        direction.normalize();
        forceVector.sub(
            direction.multiplyScalar(magnitude)
                .multiplyScalar(0.6 ** (this._nodeManager.getNeighbors(node.uuid).length - 1)) // significantly scale down physics force based on number of neighbors
        );
        if (
            !node.userData.dragged && 
            distance >= Number.EPSILON
        ) {
            node.position.add(forceVector);
        }
    }
    this._applyAmbientForces = function () {
        self._nodeManager.nodelist.forEach(node => self._applyAmbientForce(node));
    }
    this._applyTetherForce = function (origin, target) {
        const isNeighbor = self._nodeManager.isNeighbor(origin.uuid, target.uuid);
        const forceVector = new THREE.Vector3();
        const distance = origin.position.distanceTo(target.position);
        const distanceSquared = origin.position.distanceToSquared(target.position); // supposedly more efficient to use this for comparison, according to threejs docs
        const direction = new THREE.Vector3().subVectors(
            origin.position,
            target.position
        );
        direction.normalize();
        const pullMagnitude = ((self.config.maxDistance - distance) / self.config.maxDistance) * self.config.pullForce;
        const pushMagnitude = -((self.config.maxDistance - distance) / self.config.maxDistance) * self.config.pushForce;
        if (isNeighbor && distanceSquared > self.config.maxDistance ** 2) {
            forceVector.sub(direction.clone().multiplyScalar(pullMagnitude));
        } else if (distanceSquared < self.config.maxProximity ** 2) {
            forceVector.add(direction.clone().multiplyScalar(pushMagnitude));
        }
        if (!origin.userData.dragged) origin.position.sub(forceVector);
        if (!target.userData.dragged) target.position.add(forceVector);
    }
    this._applyTetherForces = function () {
        self._nodeManager.nodelist.forEach((node, i) => {
            const nodes = [...self._nodeManager.nodelist.slice(0, i), ...self._nodeManager.nodelist.slice(i + 1)];
            nodes.forEach(otherNode => {
                self._applyTetherForce(node, otherNode);
            });
        });
    }
    this.update = function () {
        if (this._enabled) {
            this._applyTetherForces();
            this._applyAmbientForces();
        }
    }
    this.activate = function () {
        this._enabled = true;
    }
    this.deactivate = function () {
        this._enabled = false;
    }
}
