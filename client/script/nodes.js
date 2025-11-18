import {
    Vector3,
    Color
} from "three";
import * as UTIL from "./utils.js";

const emissiveValue = new Color(0xdedede);
const colorValue = new Color(0xaa0000);

export function NodeManager(
    scene,
    renderer,
    camera,
    raycaster,
    nodeMeshData = {}
) {
    const self = this;
    this._scene = scene;
    this._camera = camera;
    this._renderer = renderer;
    this._raycaster = raycaster;
    this._meshData = nodeMeshData;
    Object.defineProperty(self, "lowPerformanceMode", {
        get: function() {
            return self._lowPerformance;
        },
        set: function(value) {
            self._lowPerformance = value;
            self._setLowPerformanceMode(value);
        }
    });
    this.centerNodes = function () {
        // get mean node location
        const mean = new Vector3();
        self.nodelist.forEach(node => mean.add(node.position));
        mean.divideScalar(self.nodelist.length);
        self.nodelist.forEach(node => node.position.sub(mean));
        self._updateTethers();
    }
    this._popNode = function (node) {
        // remove tethers
        if (node.userData.tetherlist.length)
            node.userData.tetherlist.forEach(tether => this._popTether(tether));
        this._scene.remove(node);
        delete this.nodes[node.uuid];
        this.nodelist = [...Object.values(this.nodes)];
    }
    this._pushNode = function (node) {
        this.nodes[node.uuid] = node;
        this.nodelist.push(this.nodes[node.uuid]);
    }
    this._popTether = function (tether) { // does not pop tether reference from attached nodes
        this._scene.remove(tether);
        // tether.userData.origin = undefined;
        // tether.userData.target = undefined;
        delete this.tethers[tether.uuid];
        this.tetherlist = [...Object.values(this.tethers)]; // [!] may be optimizied, see if performance is impacted by this
    }
    this._pushTether = function (tether) {
        this.tethers[tether.uuid] = tether;
        this.tetherlist.push(this.tethers[tether.uuid]);
    }
    this._getTetherFromNodes = function (originid, targetid) {
        // there should only be one tether between each node
        const tether = this.tetherlist.filter(t => 
            t.userData.origin.uuid === originid &&
            t.userData.target.uuid === targetid
        );
        if (!tether.length)
            throw new Error(`[NodeManager] | A tether from Node UUID "${originid}" to "${targetid}" does not exist.`);
        return tether[0]; // there should only be one
    }
    this.isNeighbor = function (originid, targetid) { // order does not matter, returns the tether uuid if true
        // there should only be one tether between each node
        const tether = this.tetherlist.filter(t => 
            (
                t.userData.origin.uuid === originid &&
                t.userData.target.uuid === targetid
            ) || (
                t.userData.origin.uuid === targetid &&
                t.userData.target.uuid === originid
            )
        );
        if (tether.length > 0)
            return tether[0].uuid;
        return false;
    }
    this.getOtherNode = function (tetherid, nodeid) {
        const tether = this.getTether(tetherid);
        const originid = tether.userData.origin.uuid;
        const targetid = tether.userData.target.uuid;
        return (originid == nodeid) ? targetid : originid;
    }
    this.getNeighbors = function (nodeid) {
        const node = this.getNode(nodeid);
        return [
            ...Object.values(node.userData.tethers.origin).map(t => t.userData.target),
            ...Object.values(node.userData.tethers.target).map(t => t.userData.origin)
        ];
    }
    this.getNodes = function (...nodeids) {
        return nodeids.map(nodeid => this.getNode(nodeid));
    }
    this._removeTether = function (tether) {
        const [origin, target] = this._getNodesFromTether(tether);
        // [!] hoping this just removes the reference and not the actual object
        delete origin.userData.tethers.origin[tether.uuid];
        delete target.userData.tethers.target[tether.uuid];
        this._popTether(tether);
    }
    this._getNodesFromTether = function (tether) {
        return [
            tether.userData.origin,
            tether.userData.target
        ];
    }
    this._updateAnimations = function (timedelta) {
        this.nodelist.forEach(node => {
            if (node.userData.updateAnimations)
                node.userData.updateAnimations(timedelta);
        });
    }
    this.getNode = function (nodeid) {
        const node = this.nodes[nodeid];
        if (!node)
            Logger.throw(new Error(`[NodeManager] | Node with UUID "${nodeid}" does not exist.`));
        return node;
    }
    this.createNode = function (nodeType, position = [0, 0, 0]) {
        const newNode = this._getMesh(nodeType);
        if (position.x)
            newNode.position.set(position.x, position.y, position.z);
        else
            newNode.position.set(...position);
        this._pushNode(newNode);
        this._scene.add(newNode);
        Logger.debug(`[NodeManager] | Created new Node (${nodeType}): ${newNode.uuid}`);
        return newNode.uuid;
    }
    this._getMesh = function (meshName, ...args) {
        if (!Object.keys(self._meshData).includes(meshName))
            Logger.throw(new Error(`[NodeManager] | Could load mesh of type "${nodeType}": No mesh data found.`));
        return self._meshData[meshName](...args);
    }
    this.addMeshData = function (meshData) {
        Object.keys(meshData).forEach(nodeType => this._meshData[nodeType] = meshData[nodeType]);
    }
    this.update = function (timedelta) {
        this._updateAnimations(timedelta);
    }
    this.getFlatCoordinateFromNode = function (nodeid) {
        const worldPosition = new Vector3();
        self.getNode(nodeid).getWorldPosition(worldPosition); // Get world position (not local!)
        worldPosition.project(self._camera); // Project to NDC
    
        const rect = self._renderer.domElement.getBoundingClientRect();
    
        const screenX = (worldPosition.x * 0.5 + 0.5) * rect.width + rect.left;
        const screenY = (-worldPosition.y * 0.5 + 0.5) * rect.height + rect.top;
    
        return { x: screenX, y: screenY, distance: camera.position.distanceTo(worldPosition) };
    }
    this.getNodeFromFlatCoordinate = function (coordinate) { // [!] this modifies the raycaster
        self._raycaster.setFromCamera(coordinate, self._camera);
        const intersects = self._raycaster.intersectObjects(self.nodelist, true);
        return intersects.length > 0
            ? intersects[0].object.userData.nodeid ?
                intersects[0].object.userData.nodeid
                : intersects[0].object.userData.uuid
            : undefined;
    }
    this._setLowPerformanceMode = function (low) {
        if (low)
            self.nodelist.forEach(node => node.userData.state.setLowPerformance());
        else
            self.nodelist.forEach(node => node.userData.state.setHighPerformance());
    }
    this.clear = function () {
        const nodeCount = self.nodelist.length;
        const tetherCount = self.tetherlist.length;
        self.nodelist.forEach(n => self._popNode(n));
        self.tetherlist.forEach(t => self._popTether(t));
        Logger.log(`[NodeManager] | Cleared ${nodeCount} nodes and ${tetherCount} tethers`);
    }
    this._tetherNodes = function (origin, target) {
        if (this.isNeighbor(origin.uuid, target.uuid))
            throw new Error(
                `[NodeManager] | Tether already exists between Nodes ${originid} and ${targetid}`
            );
        else if (origin.uuid == target.uuid)
            throw new Error(
                `[NodeManager] | Cannot tether a Node to itself`
            );
        const tether = this._getMesh("tether", origin, target);
        this._pushTether(tether);
        this._scene.add(tether);
        return tether;
    }
    this.tetherNodes = function (originid, targetid) {
        const [origin, target] = this.getNodes(originid, targetid);
        const tether = this._tetherNodes(origin, target);
        return tether.uuid;
    }
    this.removeTether = function (tetherid) {
        const tether = this.getTether(tetherid);
        this._removeTether(tether);
    }
    this.getTether = function (tetherid) {
        const tether = this.tethers[tetherid];
        if (!tether)
            Logger.throw(new Error(`[NodeManager] | Tether with UUID "${tetherid}" does not exist.`));
        return tether;
    }
    this.getDistance = function (originid, targetid) {
        const [origin, target] = this.getNodes(originid, targetid);
        return origin.position.distanceTo(target.position);
    }
    this.getDirection = function (originid, targetid) {
        const [origin, target] = this.getNodes(originid, targetid);
        return new THREE.Vector3().subVectors(
            origin.position,
            target.position
        );
    }
    this.getCameraDirection = function (nodeid) { // [!] needs a concise, but DESCRIPTIVE name. come back to this later and do better
        const node = this.getNode(nodeid);
        const nodeWorldPos = new Vector3();
        const cameraWorldPos = new Vector3();
        const direction = new Vector3();
        node.getWorldPosition(nodeWorldPos);
        this._camera.getWorldPosition(cameraWorldPos);
        direction.subVectors(cameraWorldPos, nodeWorldPos);
        direction.normalize();
        return direction;
    }
    this.getCameraDistance = function (nodeid) {
        const node = this.getNode(nodeid);
        const distance = this._camera.position.distanceTo(node.position);
        return distance;
    }
    this.getAngle = function (originid, targetid) { // returns in RADIANS
        const [origin, target] = this.getNodes(originid, targetid);
        return origin.position.angleTo(target.position);
    }
    this._updateTethers = function () {
        this.tetherlist.forEach(tether => {
            if (
                tether.userData.origin.position != tether.userData.vectors.origin ||
                tether.userData.target.position != tether.userData.vectors.target
            ) {
                tether.userData.update();
            }
        });
    }
    return this;
}

NodeManager.prototype = {
    _lowPerformance: false,
    nodes: {},
    nodelist: [], // read only
    tethers: {},
    tetherlist: [], // read only
}

export function AttackNodeManager (
    nodeManager,
    nodeTypeData = {},
    attackTypeData = {}
) {
    const self = {...nodeManager};
    self.tick = {
        delta: 0,
        interval: 0.1 // seconds, configurable
    };
    self._nodeTypeData = nodeTypeData;
    self._attackTypeData = attackTypeData;
    self.nodedata = {};
    self.attacks = {};
    self.attacklist = []; // read only
    UTIL.bindProperty(nodeManager, self, "nodelist");
    UTIL.bindProperty(nodeManager, self, "tethers");
    UTIL.bindProperty(nodeManager, self, "tetherlist");
    self.nodes = new Proxy(nodeManager.nodes, {
        set(target, key, value, receiver) {
            Logger.log(key, value);
            if (!self._nodeTypeData[value.userData.type])
                Logger.throw(`[AttackNodeManager] | Error while adding node ${key}: No data found for Node type "${value.userData.type}"`);
            self.nodedata[key] = self._addNodeData(node.uuid);
            return Reflect.set(target, key, value, receiver); // default behavior, equal to "self._nodes[key] = value"
        },
        deleteProperty(target, key) {
            const res = Reflect.deleteProperty(target, key); // default behavior, equal to "delete self._nodes[key]"
            self.nodelist = [...Object.values(self._nodes)];
            return res;
        }
    });
    self._addNodeData = function (node) {
        try {
            self.nodedata[node.uuid] = NodeDataFactory(node.uuid, self);
            if (!self.nodedata[node.uuid].isFriendly) {
                //self.nodedata[node.uuid].slots = 99;
                if (node.userData.type == "cube")
                    self.addAttackToNode("cubedefense", node.uuid);
            }
        } catch (err) {
            Logger.error(`[AttackNodeManager] | Error while creating node data for type: ${node.userData.type}`);
            Logger.throw(err);
        }   
    }
    self.getNodeData = function (nodeid) {
        const nodeData = self.nodedata[nodeid];
        if (!nodeData)
            Logger.throw(new Error(`[AttackNodeManager] | Error getting data: Node with UUID "${nodeid}" does not exist.`));
        return nodeData;
    }
    self._getNodeTypeData = function (nodeType) {
        if (!Object.keys(self._nodeTypeData).includes(nodeType))
            Logger.throw(new Error(`[AttackNodeManager] | Could not retrieve node data for type "${nodeType}"`));
        return self._nodeTypeData[nodeType];
    }
    self._getAttackTypeData = function (attackType) {
        if (!Object.keys(this._attackTypeData).includes(attackType))
            Logger.throw(new Error(`[AttackNodeManager] | Could not retrieve attack data for type "${attackType}"`));
        return this._attackTypeData[attackType];
    }
    self.addAttackData = function (attackData) {
        Object.keys(attackData).forEach(attackType => this._attackTypeData[attackType] = attackData[attackType]);
    }
    self.setNodeFriendly = function (nodeid) {
        const node = this.getNode(nodeid);
        const nodeData = this.getNodeData(nodeid);
        const nodeTypeData = this._getNodeTypeData(node.userData.type);
        nodeData.attackers.clear();
        if (node.userData.type != "globe") {
            nodeData.friendly = true;
            nodeData.hp.set(nodeTypeData.health / 2);
            node.userData.traverseMesh(function (mesh) {
                if (mesh.material.emissive && !mesh.material.emissive.equals(colorValue)) {
                    mesh.userData.oldEmissive = mesh.material.color.clone();
                    mesh.material.emissive.set(colorValue); 
                }
            });
        }
    }
    self.setNodeEnemy = function (nodeid) {
        const node = this.getNode(nodeid);
        const nodeData = this.getNodeData(nodeid);
        const nodeTypeData = this._getNodeTypeData(node.userData.type);
        nodeData.attackers.clear();
        if (node.userData.type == "cube")
            self.addAttackToNode("cubedefense", node.uuid);
        if (node.userData.type != "globe") {
            nodeData.friendly = false;
            nodeData.hp.set(nodeTypeData.health);
            node.userData.traverseMesh(function (mesh) {
                if (mesh.material.emissive && mesh.userData.oldEmissive)
                    mesh.material.emissive.set(mesh.userData.oldEmissive);
            });
        }
    }
    self._pushAttack = function (attack) {
        this.attacks[attack.uuid] = attack;
        this.attacklist.push(this.attacks[attack.uuid]);
    }
    self._popAttack = function (attack) {
        attack.halt();
        this._scene.remove(attack.mesh);
        delete this.attacks[attack.uuid];
        this.attacklist = [...Object.values(this.attacks)]; // [!] may be optimizied, see if performance is impacted by this
    }
    self.getAttack = function (attackid) {
        const attack = this.attacks[attackid];
        if (!attack)
            Logger.throw(new Error(`[AttackNodeManager] | Attack with UUID "${attackid}" does not exist.`));
        return attack;
    }
    self.createAttack = function (originid, attackType) {
        const attack = AttackFactory(attackType, originid, self);
        this._pushAttack(attack);
        attack.update();
        this._scene.add(attack.mesh);
        Logger.debug(`[AttackNodeManager] | Created new Attack (${attackType}): ${attack.uuid}`);
        return attack.uuid;
    }
    self.getAllAttacksFrom = function (nodeid) {
        return this.attacklist.filter(attack => attack.origin == nodeid);
    }
    self.getAllAttacksTo = function (nodeid) {
        return this.attacklist.filter(attack => attack.target == nodeid);
    }
    self.addAttackToNode = function (attackType, nodeid) {
        const nodeData = this.getNodeData(nodeid);
        if (nodeData.attackers.space >= 1)
            nodeData.attackers.push({
                uuid: this.createAttack(nodeid, attackType),
                type: attackType
            });
        else
            Logger.warn(`[AttackNodeManager] | Cannot add attacker: Node (${nodeid}) is limited to ${nodeData.attackers.length} slots.`);
    }
    self._updateAnimations = function (timedelta) {
        this.nodelist.forEach(node => {
            if (node.userData.updateAnimations) {
                const data = this.getNodeData(node.uuid);
                node.userData.updateAnimations((data.isFriendly && node.userData.type != "globe" ? 0.4 : 1) * timedelta);
            }
        });
    }
    self._updateAttacks = function () {
        this.attacklist.forEach(attack => attack.update());
    }
    self._updateTick = function (timedelta) {
        this.tick.delta += timedelta;
        if (this.tick.delta < this.tick.interval)
            return;
        // deal damage and whatnot here

        this.tick.delta = this.tick.delta % this.tick.interval;
    }
    self.update = function (timedelta) {
        this._updateTick(timedelta);
        this._updateAnimations(timedelta);
        this._updateAttacks();
    }
    self.clear = function () {
        const nodeCount = this.nodelist.length;
        const tetherCount = this.tetherlist.length;
        const attackCount = this.attacklist.length;
        this.tetherlist.forEach(t => this._popTether(t));
        this.attacklist.forEach(a => this._popAttack(a));

        Object.entries(this.nodes).forEach(([id, n]) => {
            this._popNode(n);
            delete this.nodedata[id];
        });
        delete this._nodeTypeData;
        this._nodeTypeData = {};
        delete this._attackTypeData;
        this._attackTypeData = {};
        Logger.log(`[AttackNodeManager] | Cleared ${nodeCount} nodes, ${attackCount} attacks, and ${tetherCount} tethers`);
    }
    // init data for existing nodes
    Object.values(self.nodes).forEach(node => self._addNodeData(node));

    return self;
}

export function BuildNodeManager (
    nodeManager
) {
    const self = {...nodeManager};
    UTIL.bindProperty(nodeManager, self, "nodes");
    UTIL.bindProperty(nodeManager, self, "nodelist");
    UTIL.bindProperty(nodeManager, self, "tethers");
    UTIL.bindProperty(nodeManager, self, "tetherlist");
    self.untetherNodes = function (originid, targetid) {
        const tether = this._getTetherFromNodes(originid, targetid);
        this._removeTether(tether); // a bit inefficient
    }
    self.untetherNode = function (nodeid) {
        const node = this.getNode(nodeid);
        node.userData.tetherlist.forEach(tether => this._removeTether(tether));
    }
    self.removeNode = function (nodeid) {
        const node = this.getNode(nodeid);
        this._popNode(node);
    }
    self._setNodeEmissive = function (node, emissive) {
        node.userData.traverseMesh(function (mesh) {
            if (mesh.material.emissive)
                mesh.material.emissive.set(emissive);
        });
    }
    self.highlightNode = function (nodeid) {
        const node = this.getNode(nodeid);
        node.userData.traverseMesh(function (mesh) {
            if (mesh.material.emissive && !mesh.material.emissive.equals(emissiveValue)) {
                mesh.userData.oldEmissive = mesh.material.emissive.clone();
                mesh.material.emissive.set(emissiveValue);
            }
        });
    }
    self.unhighlightNode = function (nodeid) {
        const node = this.getNode(nodeid);
        node.userData.traverseMesh(function (mesh) {
            if (mesh.material.emissive && mesh.userData.oldEmissive)
                mesh.material.emissive.set(mesh.userData.oldEmissive);
        });
    }
    self.update = function (timedelta) {
        this._updateAnimations(timedelta);
        this._updateTethers();
    }
    return self;
}

function AttackFactory (attackType, originid, manager) {
    const typeData = manager._getAttackTypeData(attackType);
    const nodeData = manager.getNodeData(originid);
    const mesh = typeData.mesh();
    mesh.userData.setOrigin(manager.getNode(originid)?.position);
    const attack = Object.create({
        mesh: mesh,
        _target: undefined,
        origin: originid,
        friendly: nodeData.isFriendly,
        type: attackType,
        uuid: mesh.uuid,
        damage: typeData.damage,
        logic: typeData.logic(),
        get active () {
            return this.mesh.visible;
        },
        set active (value) { // boolean
            this.mesh.visible = value;
        },
        get target () {
            return this._target;
        },
        set target (nodeid) {
            this._target = nodeid;
            if (nodeid) {
                this.active = true;
                this.mesh.userData.setTarget(manager.getNode(nodeid)?.position);
                this.mesh.userData.callback = function () {
                    if (attack.active) {
                        try {
                            manager.getNodeData(attack.target).damage(attack.damage);
                            attack.update();
                            if (attack.active)
                                attack.mesh.userData.start();
                        } catch (err) {
                            Logger.warn(err.message);
                        }
                    }
                }
                this.mesh.userData.start();
            } else
                this.active = false;
        },
        update: function () { // assumes enabled
            if (!this.active || !this.target || !manager.getNodeData(this.origin)?.canAttack(this.target))
                this.target = this.logic.target(manager.getNodeData(this.origin)?.attackableNeighbors);
            if (this.active)
                this.mesh.userData.update();
        },
        halt: function () {
            this.active = false;
            this.mesh.userData.video.pause();
        }
    });
    return attack;
}

function NodeDataFactory (nodeid, manager) {
    const node = manager.getNode(nodeid);
    const typeData = manager._getNodeTypeData(node.userData.type);
    const obj = Object.create({
        get neighbors () { // gets nodedata only
            try {
                const neighbors = manager.getNeighbors(this.uuid)?.map(n => manager.getNodeData(n.uuid));
                return neighbors ? neighbors : [];
            } catch (err) {
                Logger.warn(err.message);
                return [];
            }
        },
        get isDead () {
            return this.hp.total <= 0;
        },
        get isFriendly() {
            return this.friendly;
        },
        get isAttackable() {
            return this.neighbors.some(nd => nd.isFriendly) && !this.isFriendly;
        },
        get attackableNeighbors() {
            return this.neighbors.filter(nd => nd.isFriendly != this.isFriendly && !nd.isDead);
        },
        canAttack: function (targetid) {
            return this.attackableNeighbors.filter(nd => nd.uuid == targetid).length > 0;
        },
        damage: function (value) {
            this.hp.applyDamage(value)
            Logger.debug(`Dealt ${value} damage to node ${this.uuid}`);
            if (this.isDead) {
                [...manager.getAllAttacksFrom(this.uuid), ...manager.getAllAttacksTo(this.uuid)]
                    .forEach(attack => attack.active = false);
                if (this.isFriendly)
                    manager.setNodeEnemy(this.uuid);
                else
                    manager.setNodeFriendly(this.uuid);
                return true;
            }
            return false;
        },
        uuid: nodeid,
        friendly: node.userData.type == "globe",
        hp: NodeHealthFactory(typeData?.health),
        _slots: typeData?.slots,
        get slots () {
            return this._slots;
        },
        set slots (length) {
            const oldlength = this._slots;
            this._slots = length;
            if (oldlength > this._slots)
                this.attackers.splice(this._slots, oldlength - this._slots);
            else if (oldlength < this._slots)
                this.attackers.fillempty();
        },
        attackers: Array.from({length: typeData?.slots}, () => {return {uuid: undefined, type: undefined}}),
    });
    Object.defineProperty(obj.attackers, "space", {
        get: function() {
            return obj.attackers.filter(a => a.uuid == undefined).length;
        },
    });
    Object.defineProperty(obj.attackers, "filled", {
        get: function() {
            return obj.attackers.filter(a => a.uuid != undefined).length;
        },
    });
    obj.attackers.pop = function (index) {
        const idx = Number(index);
        if (isNaN(idx) || idx < 0 || idx >= obj.attackers.length) {
            Logger.warn(`Invalid index for deletion: ${idx}`);
            return false;
        }
        // stop that attack
        manager._popAttack(manager.getAttack(obj.attackers[idx].uuid));
        // shift everything down
        obj.attackers.splice(idx, 1);
        obj.attackers[obj.attackers.length] = {uuid: undefined, type: undefined};
        return true;
    }
    obj.attackers.push = function (...args) {
        if (args.length + obj.attackers.filled <= obj.slots)
            args.forEach((arg, i) => obj.attackers[obj.attackers.filled + i] = arg);
        else {
            args.forEach(arg => manager._popAttack(manager.getAttack(arg.uuid)));
            Logger.error(`Cannot add attacker(s): Node is limited to ${obj.slots} slots.`);
            return false;
        }
        return true;
    }
    obj.attackers.fillempty = function () {
        for (let i = Math.max(0, obj.attackers.filled - 1); i < obj._slots; i++)
            obj.attackers[i] = {uuid: undefined, type: undefined};
    }
    obj.attackers.clear = function () {
        while (obj.attackers.filled > 0) {
            obj.attackers.pop(0);
        }
    }
    
    return obj;
}

function NodeHealthFactory (maxHealth) {
    return Object.create({
        _health: {
            max: maxHealth,
            current: maxHealth,
        },
        _shield: {
            current: 0
        },
        set: function (health) {
            this._health.max = health;
            this._health.current = health;
            this._shield.current = 0;
        },
        get total () {
            return this.health + this.shield;
        },
        get shield () {
            return this._shield.current;
        },
        set shield (value) {
            this._shield.current = Math.max(0, value);
        },
        get health () {
            return this._health.current;
        },
        set health (value) {
            this._health.current = UTIL.clamp(value, 0, this.maxHealth);
        },
        get maxHealth () {
            return this._health.max;
        },
        // [!] ugly as hell, fix this soon!
        applyDamage: function (value) { // should be a positive value
            let damage = Math.abs(value);
            let shieldExcess = this.shield - damage;
            this.shield = shieldExcess;
            if (shieldExcess < 0) {
                let healthExcess = this.health + shieldExcess;
                this.health = healthExcess;
                if (healthExcess < 0)
                    return Math.abs(healthExcess); // returns the extra damage, for easier callbacks later
            }
            return 0;
        },
        applyHeal: function (value) { // should be a positive value
            let heal = Math.abs(value);
            let excess = Math.abs(Math.min(0, this.maxHealth - (this.health + heal)));
            this.health += heal;
            return excess; // returns overhealing, for easier callbacks later
        },
        applyShield: function (value) { // should be a positive value
            let shield = Math.abs(value);
            this.shield += shield;
        }
    });
}
