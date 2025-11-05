import * as THREE from "three";
import { isVectorZero } from "./three-utils.js";

export function PhysicsManager (
    nodeManager,
    maxDistance,
    maxProximity,
    force
) {
    const self = this;
    this._nodeManager = nodeManager;
    this.config = {
        maxDistance: maxDistance,
        maxProximity: maxProximity,
        force: force
    };
    this._applyRelation = function (origin, target) {
        const isNeighbor = this._nodeManager.isNeighbor(origin.uuid, target.uuid);
        const forceVector = new THREE.Vector3();
        const distance = origin.position.distanceTo(target.position);
        const distanceSquared = origin.position.distanceToSquared(target.position); // supposedly more efficient to use this for comparison, according to threejs docs
        const direction = new THREE.Vector3().subVectors(
            origin.position,
            target.position
        );
        direction.normalize();
        const magnitude = ((self.config.maxDistance - distance) / self.config.maxDistance) * self.config.force;
        if (isNeighbor && distanceSquared > self.config.maxDistance ** 2) {
            forceVector.sub(direction.clone().multiplyScalar(magnitude));
        } else if (distanceSquared < self.config.maxProximity ** 2) {
            forceVector.add(direction.clone().multiplyScalar(-magnitude));
        }
        if (!isVectorZero(forceVector))
            if (!origin.userData.dragged) origin.position.sub(forceVector);
        if (!target.userData.dragged) target.position.add(forceVector);
    }
    this._applyRelations = function () {
        self._nodeManager.nodelist.forEach((node, i) => {
            const nodes = [...self._nodeManager.nodelist.slice(0, i), ...self._nodeManager.nodelist.slice(i + 1)];
            nodes.forEach(otherNode => {
                self._applyRelation(node, otherNode);
            });
        });
    }
    this.update = function () {
        this._applyRelations();
    }
}
