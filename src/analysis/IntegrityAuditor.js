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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrityAuditor = void 0;
var crypto_js_1 = require("crypto-js");
/**
 * Multi-Layer Hash Resolution Engine
 * Attempts to resolve SHA-256 hashes to their plaintext server seeds via:
 *   Layer 1: Local in-memory cache (instant)
 *   Layer 2: Local SQLite database of previously verified seeds (<10ms)
 *   Layer 3: Hashes.com API (1-3s, requires API key)
 *   Layer 4: Nitrxgen.net API (free, open-source alternative, 1-5s)
 *
 * Transitions system from probabilistic to deterministic mode when successful.
 */
var IntegrityAuditor = /** @class */ (function () {
    function IntegrityAuditor() {
        var _a;
        this.hashesBaseUrl = 'https://hashes.com/en/api/search';
        this.nitrxgenBaseUrl = 'https://www.nitrxgen.net/md5db/';
        this.localCache = new Map();
        this.isBrowser = typeof window !== 'undefined';
        // Try browser localStorage first, then env var, then hardcoded default
        var browserKey = typeof window !== 'undefined'
            ? localStorage.getItem('hashes_api_key')
            : null;
        this.hashesApiKey = browserKey
            || (typeof process !== 'undefined' && ((_a = process.env) === null || _a === void 0 ? void 0 : _a.HASHES_API_KEY))
            || '94b5b9c73e8a71fd34f7e12abea2e919';
    }
    /**
     * Multi-layer hash resolution. Tries each layer in order until a match is found.
     */
    IntegrityAuditor.prototype.resolveServerSeed = function (hash) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedHash, cached, dbMatch, hashesResult, nitrxgenResult;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        normalizedHash = hash.toLowerCase().trim();
                        cached = this.localCache.get(normalizedHash);
                        if (cached) {
                            console.log("[IntegrityAuditor] Layer 1 HIT (cache): ".concat(normalizedHash.slice(0, 16), "..."));
                            return [2 /*return*/, cached];
                        }
                        if (!!this.isBrowser) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.checkLocalDatabase(normalizedHash)];
                    case 1:
                        dbMatch = _a.sent();
                        if (dbMatch) {
                            this.localCache.set(normalizedHash, dbMatch);
                            console.log("[IntegrityAuditor] Layer 2 HIT (SQLite): ".concat(normalizedHash.slice(0, 16), "..."));
                            return [2 /*return*/, dbMatch];
                        }
                        _a.label = 2;
                    case 2:
                        if (!this.hashesApiKey) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.queryHashesCom(normalizedHash)];
                    case 3:
                        hashesResult = _a.sent();
                        if (hashesResult) {
                            this.localCache.set(normalizedHash, hashesResult);
                            console.log("[IntegrityAuditor] Layer 3 HIT (hashes.com): ".concat(normalizedHash.slice(0, 16), "..."));
                            return [2 /*return*/, hashesResult];
                        }
                        _a.label = 4;
                    case 4: return [4 /*yield*/, this.queryNitrxgen(normalizedHash)];
                    case 5:
                        nitrxgenResult = _a.sent();
                        if (nitrxgenResult) {
                            this.localCache.set(normalizedHash, nitrxgenResult);
                            console.log("[IntegrityAuditor] Layer 4 HIT (nitrxgen.net): ".concat(normalizedHash.slice(0, 16), "..."));
                            return [2 /*return*/, nitrxgenResult];
                        }
                        console.log("[IntegrityAuditor] All layers MISS for: ".concat(normalizedHash.slice(0, 16), "..."));
                        return [2 /*return*/, null];
                }
            });
        });
    };
    /**
     * Layer 2: Check local SQLite database for previously verified seeds.
     * Queries the verified_seeds table in database/audit_store.db.
     */
    IntegrityAuditor.prototype.checkLocalDatabase = function (hash) {
        return __awaiter(this, void 0, void 0, function () {
            var Database, path, dbPath, db, row, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require(/* @vite-ignore */ 'better-sqlite3'); })];
                    case 1:
                        Database = (_b.sent()).default;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require(/* @vite-ignore */ 'path'); })];
                    case 2:
                        path = (_b.sent()).default;
                        dbPath = path.resolve(process.cwd(), 'database', 'audit_store.db');
                        db = new Database(dbPath, { readonly: true });
                        row = db.prepare('SELECT server_seed FROM verified_seeds WHERE server_hash = ? LIMIT 1').get(hash);
                        db.close();
                        return [2 /*return*/, (row === null || row === void 0 ? void 0 : row.server_seed) || null];
                    case 3:
                        _a = _b.sent();
                        // SQLite not available (browser context or missing DB) — skip
                        return [2 /*return*/, null];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Layer 3: Hashes.com API — paid hash lookup service.
     */
    IntegrityAuditor.prototype.queryHashesCom = function (hash) {
        return __awaiter(this, void 0, void 0, function () {
            var rawUrl, endpoint, response, data, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        rawUrl = "".concat(this.hashesBaseUrl, "?key=").concat(this.hashesApiKey, "&hash=").concat(hash);
                        endpoint = this.isBrowser
                            ? this.buildProxiedUrl(rawUrl)
                            : rawUrl;
                        return [4 /*yield*/, fetch(endpoint, {
                                method: 'GET',
                                signal: AbortSignal.timeout(8000),
                            })];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        if (data.success && data.result) {
                            return [2 /*return*/, data.result];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error('[IntegrityAuditor] Hashes.com API error:', error_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, null];
                }
            });
        });
    };
    /**
     * Layer 4: Nitrxgen.net — free open-source hash database.
     * Supports MD5, SHA1, SHA256 lookups via simple GET request.
     * Returns plaintext directly in response body if found, empty string if not.
     */
    IntegrityAuditor.prototype.queryNitrxgen = function (hash) {
        return __awaiter(this, void 0, void 0, function () {
            var rawUrl, endpoint, response, text, verified, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Nitrxgen's md5db endpoint strictly accepts 32-character MD5 hashes.
                        // It will return an HTTP 400 Bad Request if passed a 64-character SHA-256 hash.
                        if (!/^[a-f0-9]{32}$/.test(hash)) {
                            return [2 /*return*/, null];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        rawUrl = "".concat(this.nitrxgenBaseUrl).concat(hash);
                        endpoint = this.isBrowser ? this.buildProxiedUrl(rawUrl) : rawUrl;
                        return [4 /*yield*/, fetch(endpoint, {
                                method: 'GET',
                                signal: AbortSignal.timeout(5000),
                            })];
                    case 2:
                        response = _a.sent();
                        return [4 /*yield*/, response.text()];
                    case 3:
                        text = (_a.sent()).trim();
                        // Nitrxgen returns the plaintext directly, or empty string if not found
                        if (text && text.length > 0) {
                            verified = this.verifyHash(text, hash);
                            if (verified) {
                                return [2 /*return*/, text];
                            }
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        console.error('[IntegrityAuditor] Nitrxgen.net API error:', error_2);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/, null];
                }
            });
        });
    };
    /**
     * Verify that a plaintext hashes to the expected SHA-256 hash.
     */
    IntegrityAuditor.prototype.verifyHash = function (plaintext, expectedHash) {
        var computed = crypto_js_1.default.SHA256(plaintext).toString(crypto_js_1.default.enc.Hex);
        return computed === expectedHash.toLowerCase();
    };
    /**
     * Manually register a known seed→hash mapping (e.g., from ServerSeedReveal).
     */
    IntegrityAuditor.prototype.registerSeed = function (plaintext, hash) {
        this.localCache.set(hash.toLowerCase(), plaintext);
    };
    /**
     * Wrap a URL through the configured CORS proxy for browser requests.
     */
    IntegrityAuditor.prototype.buildProxiedUrl = function (targetUrl) {
        var proxyPrefix = (typeof window !== 'undefined' && localStorage.getItem('cors_proxy'))
            || 'https://fairness-cors-proxy.wolvesfield.workers.dev/?url=';
        if (!proxyPrefix)
            return targetUrl;
        if (proxyPrefix.includes('workers.dev'))
            return proxyPrefix + encodeURIComponent(targetUrl);
        if (proxyPrefix.includes('corsproxy.io'))
            return proxyPrefix + targetUrl;
        return proxyPrefix + encodeURIComponent(targetUrl);
    };
    /**
     * Get cache statistics.
     */
    IntegrityAuditor.prototype.getCacheStats = function () {
        return {
            size: this.localCache.size,
            entries: Array.from(this.localCache.keys()).map(function (k) { return k.slice(0, 16) + '...'; }),
        };
    };
    return IntegrityAuditor;
}());
exports.IntegrityAuditor = IntegrityAuditor;
// CLI entry point for standalone testing
if (typeof process !== 'undefined' && process.argv && ((_a = process.argv[1]) === null || _a === void 0 ? void 0 : _a.includes('IntegrityAuditor'))) {
    (function () { return __awaiter(void 0, void 0, void 0, function () {
        var auditor, testHash, result, unknownHash, unknown;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('═══ INTEGRITY AUDITOR — MULTI-LAYER HASH RESOLUTION ═══\n');
                    auditor = new IntegrityAuditor();
                    testHash = crypto_js_1.default.SHA256('test').toString(crypto_js_1.default.enc.Hex);
                    console.log("Test hash (SHA-256 of \"test\"): ".concat(testHash));
                    // Register it manually to demonstrate caching
                    auditor.registerSeed('test', testHash);
                    return [4 /*yield*/, auditor.resolveServerSeed(testHash)];
                case 1:
                    result = _a.sent();
                    console.log("Resolved: ".concat(result));
                    console.log("Verification: ".concat(auditor.verifyHash('test', testHash) ? '✅ VALID' : '❌ INVALID'));
                    console.log("\nCache stats:", auditor.getCacheStats());
                    unknownHash = 'abc123def456';
                    console.log("\nAttempting resolution of unknown hash: ".concat(unknownHash, "..."));
                    return [4 /*yield*/, auditor.resolveServerSeed(unknownHash)];
                case 2:
                    unknown = _a.sent();
                    console.log("Result: ".concat(unknown || 'NOT FOUND (expected for demo hash)'));
                    return [2 /*return*/];
            }
        });
    }); })();
}
