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
//////////////////////////////////
// query generation
//////////////////////////////////
var utils_1 = require("./utils");
// one function to bring them all and in the darkness bind them
var merge = function () {
    var asts = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        asts[_i] = arguments[_i];
    }
    var ops = utils_1.groupBy(utils_1.flatten(asts), function (x) { return x.type; });
    var queries = utils_1.joinBy(ops.query || [], function (x) { return utils_1.only(x, 'type', 'name', 'opArgList'); }, function (items) {
        return utils_1.joinBy(utils_1.selectMany(utils_1.selectMany(items, function (x) { return x.children; }), function (x) { return x.items; }), function (x) { return utils_1.only(x, 'alias', 'type', 'value', 'filterArgs'); }, function (items) {
            return utils_1.joinBy(utils_1.selectMany(items, function (x) { return x.fields.items; }), function (x) { return (__assign({}, x)); });
        }, 'fields');
    });
    (ops.fragmentDefinition || [])
        .reduce(function (acc, fragment) {
        var key = fragment.name + '::' + fragment.target;
        if (acc[key] !== undefined)
            throw new Error("Multiple fragments named " + fragment.name + " defined on " + fragment.target);
        return __assign({}, acc, (_a = {}, _a[key] = 1, _a));
        var _a;
    }, {});
    return (ops.fragmentDefinition || []).concat(queries);
};
exports["default"] = merge;
