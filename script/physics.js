import * as THREE from "three";
import { isVectorZero } from "./three-utils.js"
export function applyTetherForces(tethers, attractProximity, repelProximity, force, dragForceMultiplier) {
    // positive forceVec attracts, negative repeals
    tethers.forEach(tether => {
        const attractiveVector = new THREE.Vector3();
        const magnitude = ((attractProximity - tether.length) / attractProximity)
            * (force * (tether.target.dragged || tether.origin.dragged) ? dragForceMultiplier : 1);
        if (tether.length > attractProximity) {
            attractiveVector.add(tether.direction.clone().multiplyScalar(magnitude));
        } else if (tether.length < repelProximity) {
            attractiveVector.sub(tether.direction.clone().multiplyScalar(-magnitude));
        }
        if (!isVectorZero(attractiveVector))
            if (!tether.origin.dragged)
                tether.origin.position.sub(attractiveVector);
            if (!tether.target.dragged)
                tether.target.position.add(attractiveVector);
    });
}