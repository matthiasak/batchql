"use strict";
exports.__esModule = true;
var clan_fp_1 = require("clan-fp");
var merge_1 = require("./merge");
var regenerate_1 = require("./regenerate");
var combinators_1 = require("./combinators");
var parsers_1 = require("./parsers");
exports.debug = parsers_1.debug;
exports.batch = function () {
    var programs = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        programs[_i] = arguments[_i];
    }
    var asts = programs.map(combinators_1["default"]), _a = merge_1["default"].apply(void 0, asts), mergedQuery = _a.mergedQuery, extractionMaps = _a.extractionMaps, queryVariableRenames = _a.queryVariableRenames;
    return {
        mergedQuery: regenerate_1["default"](mergedQuery),
        extractionMaps: extractionMaps,
        queryVariableRenames: queryVariableRenames
    };
};
exports.fetcher = function (url) { return function (query, args) {
    return (parsers_1.debug() && console.log(query)) ||
        fetch(url, {
            method: 'POST',
            headers: {
                "Content-Type": 'application/json'
            },
            body: JSON.stringify({ query: query, variables: args })
        })
            .then(function (r) { return r.json(); })
            .then(function (f) {
            if (f.errors)
                throw new Error(f.errors.map(function (e) { return '\n- ' + e.message; }).join(''));
            return f.data;
        });
}; };
var appendOrClear = function (acc, x) {
    if (x === false)
        return [];
    acc.push(x);
    return acc;
};
var applyQueryVarRenames = function (varMap, renameMap) {
    return Object
        .keys(varMap)
        .reduce(function (acc, key) {
        acc[key in renameMap ? renameMap[key] : key] = varMap[key];
        return acc;
    }, {});
};
var applyExtractionMap = function (data, extractionMap) {
    return (data === null || data === undefined) ?
        data :
        Object
            .keys(extractionMap)
            .reduce(function (acc, key) {
            var _a = key.split('::'), actualKey = _a[0], renamedFrom = _a[1];
            var dataTarget = data[actualKey];
            if (dataTarget instanceof Array) {
                acc[renamedFrom || actualKey] =
                    dataTarget
                        .map(function (item) { return applyExtractionMap(item, extractionMap[key]); });
            }
            else if (dataTarget instanceof Object) {
                acc[renamedFrom || actualKey] = applyExtractionMap(dataTarget, extractionMap[key]);
            }
            else if (dataTarget !== undefined) {
                acc[renamedFrom || actualKey] = dataTarget;
            }
            return acc;
        }, {});
};
exports.mux = function (getter, wait) {
    if (wait === void 0) { wait = 60; }
    var $queries = clan_fp_1.obs(), $callbacks = clan_fp_1.obs(), $data = clan_fp_1.obs(), responses = $callbacks.reduce(appendOrClear, []), payload = $queries.reduce(appendOrClear, []), append = function (_a) {
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
        var _a = exports.batch.apply(void 0, $q), mergedQuery = _a.mergedQuery, queryVariableRenames = _a.queryVariableRenames, extractionMaps = _a.extractionMaps, batchedArgs = $a.reduce(function (acc, x, i) {
            return Object.assign(acc, applyQueryVarRenames(x, queryVariableRenames[i]));
        }, {});
        getter(mergedQuery, batchedArgs)
            .then(function (data) {
            return $c.map(function (fn, i) {
                return fn(applyExtractionMap(data, extractionMaps[i]));
            });
        });
    });
    return function (query, args) {
        append({ query: query, args: args });
        return new Promise(function (res) { return queue(function (d) { return res(d); }); });
    };
};
exports["default"] = exports.mux;
