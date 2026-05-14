"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hmacSha256 = hmacSha256;
exports.hashToFloat = hashToFloat;
exports.generateFloat = generateFloat;
exports.calculateCrashPoint = calculateCrashPoint;
exports.generateMinePositions = generateMinePositions;
exports.generateKenoNumbers = generateKenoNumbers;
var crypto_js_1 = require("crypto-js");
// ---------------------------------------------------------------------------
// Core: Deterministic float from HMAC-SHA256
// Produces a value in [0, 1) – never uses Math.random().
// ---------------------------------------------------------------------------
/**
 * HMAC_SHA256(key = serverSeed, message = clientSeed:nonce:cursor)
 * Returns the full hex digest (64 hex chars / 256 bits).
 */
function hmacSha256(serverSeed, clientSeed, nonce, cursor, platform) {
    if (platform === void 0) { platform = 'stake'; }
    var message = platform === 'roobet'
        ? "".concat(clientSeed, "-").concat(nonce, "-").concat(cursor)
        : "".concat(clientSeed, ":").concat(nonce, ":").concat(cursor);
    return crypto_js_1.default.HmacSHA256(message, serverSeed).toString(crypto_js_1.default.enc.Hex);
}
/**
 * Convert the first 4 bytes (8 hex chars) of a hex hash to a float in [0, 1).
 * int(first_8_hex) / 2^32
 */
function hashToFloat(hash) {
    var slice = hash.slice(0, 8);
    var int = parseInt(slice, 16); // 0 .. 0xFFFFFFFF
    return int / 4294967296; // 0 .. < 1
}
var lastSeed = null;
var cachedHmac = null;
/**
 * Convenience: generate the Nth deterministic float for a given round.
 */
function generateFloat(serverSeed, clientSeed, nonce, cursor, platform) {
    if (platform === void 0) { platform = 'stake'; }
    if (serverSeed !== lastSeed || !cachedHmac) {
        cachedHmac = crypto_js_1.default.algo.HMAC.create(crypto_js_1.default.algo.SHA256, serverSeed);
        lastSeed = serverSeed;
    }
    var message = platform === 'roobet'
        ? "".concat(clientSeed, "-").concat(nonce, "-").concat(cursor)
        : "".concat(clientSeed, ":").concat(nonce, ":").concat(cursor);
    cachedHmac.reset();
    cachedHmac.update(message);
    var hashObj = cachedHmac.finalize();
    return (hashObj.words[0] >>> 0) / 4294967296;
}
// ---------------------------------------------------------------------------
// Crash – provably fair multiplier
// ---------------------------------------------------------------------------
/**
 * Crash multiplier derived from HMAC-SHA256.
 *
 * Algorithm (industry standard):
 *   1. hash = HMAC_SHA256(serverSeed, clientSeed)
 *      – We include nonce in clientSeed component as `clientSeed:nonce`.
 *   2. h = first 13 hex characters of hash, parsed as integer.
 *   3. if h % 33 === 0 → result = 1  (the "instant crash" / house edge).
 *   4. Otherwise:  result = floor( (100 * 2^52 - h) / (2^52 - h) ) / 100
 *   5. Return max(1, result) to guarantee minimum 1.00x.
 */
function calculateCrashPoint(serverSeed, clientSeed, nonce) {
    var message = "".concat(clientSeed, ":").concat(nonce);
    var hash = crypto_js_1.default.HmacSHA256(message, serverSeed).toString(crypto_js_1.default.enc.Hex);
    // First 13 hex chars → integer (fits within JS safe integer range: 16^13 ≈ 4.5e15 < 2^53)
    var h = parseInt(hash.slice(0, 13), 16);
    // House edge: ~3 % of rounds instant-crash at 1.00x
    if (h % 33 === 0) {
        return 1;
    }
    var TWO_52 = Math.pow(2, 52);
    var result = Math.floor((100 * TWO_52 - h) / (TWO_52 - h)) / 100;
    return Math.max(1, result);
}
// ---------------------------------------------------------------------------
// Mines – Fisher-Yates shuffle
// ---------------------------------------------------------------------------
/**
 * Returns an array of `mineCount` unique cell indices in [0, totalCells).
 *
 * Uses a Fisher-Yates (Knuth) shuffle on the full cell array, consuming one
 * deterministic float per swap (incrementing cursor each time), then takes
 * the first `mineCount` elements.
 */
function generateMinePositions(serverSeed, clientSeed, nonce, mineCount, totalCells, platform) {
    var _a;
    // Stake exclusively supports 5x5 (25 cells). Roobet dictates 36, 49, 64.
    // If the explicit platform is omitted, infer based on geographic limits.
    var activePlatform = platform || (totalCells !== 25 ? 'roobet' : 'stake');
    if (activePlatform === 'roobet') {
        // Roobet uses simple picking with re-rolls
        var mines = [];
        var cursor = 0;
        while (mines.length < mineCount) {
            var float = generateFloat(serverSeed, clientSeed, nonce, cursor, activePlatform);
            var mine = Math.floor(float * totalCells);
            if (!mines.includes(mine)) {
                mines.push(mine);
            }
            cursor++;
        }
        return mines.sort(function (a, b) { return a - b; });
    }
    else {
        // Stake uses Fisher-Yates
        var cells = Array.from({ length: totalCells }, function (_, i) { return i; });
        var cursor = 0;
        // Fisher-Yates shuffle (we only need `mineCount` iterations)
        for (var i = totalCells - 1; i > totalCells - 1 - mineCount; i--) {
            var float = generateFloat(serverSeed, clientSeed, nonce, cursor, activePlatform);
            cursor++;
            var j = Math.floor(float * (i + 1)) // random index in [0, i]
            ;
            _a = [cells[j], cells[i]], cells[i] = _a[0], cells[j] = _a[1];
        }
        // The last `mineCount` positions in the array are the mines
        var mines = cells.slice(totalCells - mineCount);
        return mines.sort(function (a, b) { return a - b; });
    }
}
// ---------------------------------------------------------------------------
// Keno – unique number selection
// ---------------------------------------------------------------------------
/**
 * Draws exactly `count` unique numbers from [1, maxNum].
 *
 * Uses the float generator; on collision the cursor increments and we redraw
 * until we have the required count.  Default: 10 draws from 1-40.
 */
function generateKenoNumbers(serverSeed, clientSeed, nonce, count, maxNum) {
    if (count === void 0) { count = 10; }
    if (maxNum === void 0) { maxNum = 40; }
    var drawn = new Set();
    var cursor = 0;
    while (drawn.size < count) {
        var float = generateFloat(serverSeed, clientSeed, nonce, cursor);
        cursor++;
        var num = Math.floor(float * maxNum) + 1; // 1 .. maxNum
        drawn.add(num); // Set ignores duplicates
    }
    return Array.from(drawn).sort(function (a, b) { return a - b; });
}
