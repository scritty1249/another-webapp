import * as THREE from "three";
import { isVectorZero } from "./script/three-utils.js";

function applyPhysicsRelation(
    origin,
    target,
    attractProximity,
    repelProximity,
    force
) {
    const isNeighbor =
        origin.userData.lines.target.map((line) => line.userData.origin).includes(target) ||
        origin.userData.lines.origin.map((line) => line.userData.target).includes(target) ||
        target.userData.lines.target.map((line) => line.userData.origin).includes(origin) ||
        target.userData.lines.origin.map((line) => line.userData.target).includes(origin);
    const attractiveVector = new THREE.Vector3();
    const distance = origin.position.distanceTo(target.position);
    const direction = new THREE.Vector3().subVectors(
        origin.position,
        target.position
    );
    direction.normalize();
    const magnitude =
        ((attractProximity - distance) / attractProximity) * force;
    if (isNeighbor && distance > attractProximity) {
        attractiveVector.sub(direction.clone().multiplyScalar(magnitude));
    } else if (distance < repelProximity) {
        attractiveVector.add(direction.clone().multiplyScalar(-magnitude));
    }
    if (!isVectorZero(attractiveVector))
        if (!origin.userData.dragged) origin.position.sub(attractiveVector);
    if (!target.userData.dragged) target.position.add(attractiveVector);
}

export function applyPhysicsForces(
    shapes,
    attractProximity,
    repelProximity,
    force
) {
    Array.from(shapes).forEach((shape, i) => {
        const others = [...shapes.slice(0, i), ...shapes.slice(i + 1)];
        others.forEach((other) =>
            applyPhysicsRelation(
                shape,
                other,
                attractProximity,
                repelProximity,
                force
            )
        );
    });
}
