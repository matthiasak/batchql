"use strict";
/////////////////////////
// Base functions / parsers + combinators
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
var clan_fp_1 = require("clan-fp");
// returns a function that takes a string which parses 
// the string according to a regexp or pattern, declaring the type of token
exports.token = function (t, type, d, o, mod) {
    if (type === void 0) { type = t + ''; }
    if (d === void 0) { d = 0; }
    if (o === void 0) { o = 'igm'; }
    if (mod === void 0) { mod = function (x) { return x; }; }
    return function (s) {
        var r = t instanceof RegExp ? t : new RegExp('^' + t, o), results = r.exec(s);
        if (results === null || results.length <= d)
            throw new Error(JSON.stringify({ expected: t + '', actual: s }));
        return mod({
            remaining: s.slice(results[d].length),
            matched: results[d],
            ast: { type: type, value: results[d] }
        });
    };
};
exports.debug = clan_fp_1.obs(false);
exports.ignore = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var nArgs = args;
    nArgs[4] = function (x) { return (__assign({}, x, { ignore: true })); };
    return exports.token.apply(void 0, nArgs);
};
var ws = exports.ignore('\\s*');
var zip = function (a, b) {
    var result = [];
    for (var i = 0, len = Math.max(a.length, b.length); i < len; i++) {
        if (a[i])
            result.push(a[i]);
        if (b[i])
            result.push(b[i]);
    }
    return result;
};
exports.interleave = function (splitter, tokenizers) {
    return zip(new Array(tokenizers.length + 1).fill(splitter), tokenizers);
};
exports.sequence = function () {
    var tokenizers = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        tokenizers[_i] = arguments[_i];
    }
    return function (s) {
        return exports.interleave(ws, tokenizers)
            .reduce(function (acc, fn, i) {
            var _a = fn(acc.remaining), remaining = _a.remaining, matched = _a.matched, ast = _a.ast, ignore = _a.ignore;
            if (!ignore && ast)
                acc.ast.push(ast);
            acc.remaining = remaining;
            acc.matched += matched;
            return acc;
        }, { remaining: s, matched: '', ast: [] });
    };
};
exports.either = function () {
    var tokenizers = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        tokenizers[_i] = arguments[_i];
    }
    return function (s) {
        var errors = [];
        for (var i = 0, len = tokenizers.length; i < len; i++) {
            try {
                return tokenizers[i](s);
            }
            catch (e) {
                errors.push(e.message);
            }
        }
        exports.debug() && console.warn(errors);
        throw new Error("Either failed.");
    };
};
exports.maybe = function (tokenizer) { return function (s) {
    try {
        return tokenizer(s);
    }
    catch (e) {
        return { remaining: s, matched: '', ast: null };
    }
}; };
exports.readN = function (n, tokenizer) { return function (s) {
    var acc = { remaining: s, matched: '', ast: [] }, current, count = 0, errors = [];
    try {
        while ((current = tokenizer(acc.remaining))) {
            var remaining = current.remaining, matched = current.matched, ast = current.ast, ignore_1 = current.ignore;
            if (remaining === acc.remaining)
                throw "Infinite loop detected in readN sequence.";
            if (!ignore_1 && ast)
                acc.ast.push(ast);
            acc.remaining = remaining;
            acc.matched += matched;
            count++;
        }
    }
    catch (e) {
        errors.push(e.message);
    }
    if (count < n) {
        exports.debug() && console.warn(errors);
        throw new Error("Expected " + n + "+ occurrences, but only have " + count + ".");
    }
    return acc;
}; };
