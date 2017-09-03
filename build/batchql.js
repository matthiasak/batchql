"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
exports.__esModule = true;
var clan_fp_1 = require("clan-fp");
var debounce = require('lodash.debounce');
var merge_1 = require("./merge");
var regenerate_1 = require("./regenerate");
var combinators_1 = require("./combinators");
exports.batch = function () {
    var programs = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        programs[_i] = arguments[_i];
    }
    var asts = programs.map(combinators_1["default"]), combined = merge_1["default"].apply(void 0, asts);
    return regenerate_1["default"](combined);
};
exports.f = function (url, query, args) {
    return fetch(url, { method: 'POST', body: JSON.stringify({ query: query, variables: args }) })
        .then(function (r) { return r.json(); });
};
var appendOrClear = function (acc, x) {
    if (x === false)
        return [];
    acc.push(x);
    return acc;
};
exports.mux = function (getter, wait) {
    if (wait === void 0) { wait = 100; }
    var $queries = clan_fp_1.obs(), $callbacks = clan_fp_1.obs(), $data = clan_fp_1.obs(), responses = $callbacks
        .reduce(appendOrClear, []), payload = $queries
        .reduce(appendOrClear, []), append = function (_a) {
        var _b = _a.query, query = _b === void 0 ? '' : _b, _c = _a.args, args = _c === void 0 ? {} : _c;
        return $queries({ query: query, args: args });
    }, send = debounce(function ($) {
        var data = payload(), $q = data.map(function (x) { return x.query; }), $a = data.map(function (x) { return x.args; }), $c = $callbacks();
        // clear
        $queries(false);
        $callbacks(false);
        var batchedQuery = exports.batch.apply(void 0, $q), batchedArgs = $a.reduce(function (acc, x) { return (__assign({}, acc, x)); }, {});
        getter(batchedQuery, batchedArgs)
            .then(function (data) {
            return $callbacks.map(function (fn) { return fn(data); });
        });
    }, wait), queue = function (cb) {
        $callbacks(cb);
        send();
    };
    return function (query, args) {
        append({ query: query, args: args });
        return new Promise(function (res) { return queue(function (d) { return res(d); }); });
    };
};
