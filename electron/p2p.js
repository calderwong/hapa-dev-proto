"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initP2P = initP2P;
exports.createCore = createCore;
exports.appendToCore = appendToCore;
exports.readCore = readCore;
var hypercore_1 = require("hypercore");
var hyperswarm_1 = require("hyperswarm");
var b4a = require("b4a");
var cores = new Map();
var swarm;
function initP2P() {
    swarm = new hyperswarm_1.default();
    console.log('P2P initialized');
}
function createCore(name) {
    return __awaiter(this, void 0, void 0, function () {
        var core;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    core = new hypercore_1.default('./storage/' + name);
                    return [4 /*yield*/, core.ready()];
                case 1:
                    _a.sent();
                    cores.set(name, core);
                    swarm.on('connection', function (conn, info) {
                        var stream = core.replicate(conn);
                        stream.on('error', function (err) { return console.error('Replication error:', err); });
                    });
                    swarm.join(core.discoveryKey);
                    return [4 /*yield*/, swarm.flush()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, { key: b4a.toString(core.key, 'hex'), length: core.length }];
            }
        });
    });
}
function appendToCore(name, data) {
    return __awaiter(this, void 0, void 0, function () {
        var core;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    core = cores.get(name);
                    if (!core) {
                        throw new Error("Core ".concat(name, " not found"));
                    }
                    return [4 /*yield*/, core.append(data)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, { length: core.length }];
            }
        });
    });
}
function readCore(name) {
    return __awaiter(this, void 0, void 0, function () {
        var core, entries, i, block;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    core = cores.get(name);
                    if (!core) {
                        throw new Error("Core ".concat(name, " not found"));
                    }
                    entries = [];
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < core.length)) return [3 /*break*/, 4];
                    return [4 /*yield*/, core.get(i)];
                case 2:
                    block = _a.sent();
                    entries.push(b4a.toString(block));
                    _a.label = 3;
                case 3:
                    i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, entries];
            }
        });
    });
}
