"use strict";
exports.__esModule = true;
var clan_fp_1 = require("clan-fp");
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
exports.fetcher = function (url) { return function (query, args) {
    return fetch(url, { method: 'POST', body: JSON.stringify({ query: query, variables: args }) })
        .then(function (r) { return r.json(); });
}; };
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
    }, send = clan_fp_1.obs(), queue = function (cb) {
        $callbacks(cb);
        send(true);
    };
    send
        .debounce(wait)
        .then(function () {
        var data = payload(), $q = data.map(function (x) { return x.query; }), $a = data.map(function (x) { return x.args; }), $c = responses();
        // clear
        $queries(false);
        $callbacks(false);
        var batchedQuery = exports.batch.apply(void 0, $q), batchedArgs = $a.reduce(function (acc, x) { return Object.assign(acc, x); }, {});
        getter(batchedQuery, batchedArgs)
            .then(function (data) {
            return $c.map(function (fn) { return fn(data); });
        });
    });
    return function (query, args) {
        append({ query: query, args: args });
        return new Promise(function (res) { return queue(function (d) { return res(d); }); });
    };
};
exports["default"] = exports.mux;
