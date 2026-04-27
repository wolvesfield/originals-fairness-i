"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolatilityHedge = void 0;
/**
 * Gaussian Variance Attenuation Circuit Breaker
 * H_f = e^(-((V_obs - V_exp)^2) / (2 * gamma^2))
 */
var VolatilityHedge = /** @class */ (function () {
    function VolatilityHedge() {
        this.rollingWindow = [];
        this.maxWindowSize = 50;
        this.baselineSigma = 1.0;
    }
    VolatilityHedge.prototype.calculateHedgeFactor = function (latestOutcome) {
        this.rollingWindow.push(latestOutcome);
        if (this.rollingWindow.length > this.maxWindowSize)
            this.rollingWindow.shift();
        if (this.rollingWindow.length < this.maxWindowSize)
            return 1.0;
        var currentSigma = this.stddev(this.rollingWindow);
        if (currentSigma <= this.baselineSigma)
            return 1.0;
        var delta = currentSigma - this.baselineSigma;
        return Math.max(Math.exp(-(delta * delta) / 0.5), 0.05);
    };
    VolatilityHedge.prototype.stddev = function (values) {
        var avg = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
        var sqDiffs = values.map(function (v) { return Math.pow((v - avg), 2); });
        return Math.sqrt(sqDiffs.reduce(function (a, b) { return a + b; }, 0) / values.length);
    };
    return VolatilityHedge;
}());
exports.VolatilityHedge = VolatilityHedge;
