"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initP2P = initP2P;
exports.createCore = createCore;
exports.appendToCore = appendToCore;
exports.readCore = readCore;
const hypercore_1 = __importDefault(require("hypercore"));
const hyperswarm_1 = __importDefault(require("hyperswarm"));
const b4a = __importStar(require("b4a"));
const cores = new Map();
let swarm;
function initP2P() {
    swarm = new hyperswarm_1.default();
    console.log('P2P initialized');
}
async function createCore(name) {
    const core = new hypercore_1.default('./storage/' + name);
    await core.ready();
    cores.set(name, core);
    swarm.on('connection', (conn, info) => {
        const stream = core.replicate(conn);
        stream.on('error', (err) => console.error('Replication error:', err));
    });
    swarm.join(core.discoveryKey);
    await swarm.flush();
    return { key: b4a.toString(core.key, 'hex'), length: core.length };
}
async function appendToCore(name, data) {
    const core = cores.get(name);
    if (!core) {
        throw new Error(`Core ${name} not found`);
    }
    await core.append(data);
    return { length: core.length };
}
async function readCore(name) {
    const core = cores.get(name);
    if (!core) {
        throw new Error(`Core ${name} not found`);
    }
    const entries = [];
    for (let i = 0; i < core.length; i++) {
        const block = await core.get(i);
        entries.push(b4a.toString(block));
    }
    return entries;
}
