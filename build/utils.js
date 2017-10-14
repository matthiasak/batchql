"use strict";
/////////////////////////
// utilities
/////////////////////////
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
exports.__esModule = true;
exports.first = function (arr, fn) {
    for (var i = 0, n = arr.length; i < n; i++) {
        if (fn(arr[i], i))
            return arr[i];
    }
};
exports.flatten = function (arr) {
    return arr.reduce(function (acc, x) { return acc.concat(x); }, []);
};
exports.groupBy = function (arr, fn) {
    return arr.reduce(function (acc, x, i) {
        var key = fn(x, i);
        acc[key] = acc[key] !== undefined ? acc[key].concat(x) : [x];
        return acc;
    }, {});
};
exports.hash = function (v, _v) {
    if (_v === void 0) { _v = v === undefined ? 'undefined' : JSON.stringify(v); }
    var hash = 0;
    for (var i = 0, len = _v.length; i < len; ++i) {
        var c = _v.charCodeAt(i);
        hash = (((hash << 5) - hash) + c) | 0;
    }
    return hash;
};
exports.ordered = function (obj) {
    return Object
        .keys(obj)
        .sort()
        .reduce(function (acc, key) {
        return (__assign({}, acc, (_a = {}, _a[key] = obj[key] instanceof Object ? exports.ordered(obj[key]) : obj[key], _a)));
        var _a;
    }, {});
};
exports.ohash = function (obj) { return exports.hash(exports.ordered(obj)); };
exports.selectMany = function (arr, fn) {
    return arr.reduce(function (acc, x) { return acc.concat(fn(x)); }, []);
};
exports.joinBy = function (arr, rootProps, mapGroupedChildren, childrenKey, hashProps) {
    if (rootProps === void 0) { rootProps = function (x) { return x; }; }
    if (mapGroupedChildren === void 0) { mapGroupedChildren = function (x) { return undefined; }; }
    if (childrenKey === void 0) { childrenKey = 'children'; }
    if (hashProps === void 0) { hashProps = rootProps; }
    var g = exports.groupBy(arr, function (x) { return exports.ohash(hashProps(x)); });
    return Object
        .keys(g)
        .reduce(function (acc, key) {
        var items = g[key], first = rootProps(items[0]), m = mapGroupedChildren(items);
        if (m !== undefined)
            first[childrenKey] = m;
        return acc.concat(first);
    }, []);
};
exports.only = function (obj) {
    var keys = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        keys[_i - 1] = arguments[_i];
    }
    return keys.reduce(function (acc, key) {
        return (__assign({}, acc, (_a = {}, _a[key] = obj[key], _a)));
        var _a;
    }, {});
};
