// Attack Data / Manager. Stores attack data for attack phase and used as reference between Managers.

import * as MESH from "./mesh.js";

export const AttackLogic = {
    BasicLogicFactory: function () {
        return Object.create({
            logic: (tis, tat) => { // sorts by total health
                if (tis.hp.total < tat.hp.total)
                    return -1;
                else if (tis.hp.total > tat.hp.total)
                    return 1;
                else // both are equal
                    return 0;
            },
            target: function (targets) {
                return targets.sort(this.logic)?.map(target => target.uuid).at(0);
            }
        });
    },
    ParticleLogicFactory: function () {
        const self = AttackLogic.BasicLogicFactory();
        self.logic = function (me, them) {
            return them.hp.total - me.hp.total; // sorts from greatest to lowest health
        }
        return self;
    }
};


export const AttackerData = {
    attacks: [
        {
            type: "particle",            
            amount: 99
        }
    ]
};

export const AttackTypeData = {
    particle: {
        mesh: MESH.Attack.Particle,
        damage: 5,
        logic: AttackLogic.ParticleLogicFactory // don't need to instantite logic controllers for "dumb" attackers- they're stateless!
    },
    cubedefense: {
        mesh: MESH.Attack.CubeDefense,
        damage: 10,
        logic: AttackLogic.BasicLogicFactory
    }
};

export const NodeTypeData = {
    placeholder: {
        health: 50,
        slots: 5
    },
    cube: {
        health: 100,
        slots: 6
    },
    scanner: {
        health: 75,
        slots: 4,
    },
    globe: {
        health: 0,
        slots: 3
    }
};