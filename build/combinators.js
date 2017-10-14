"use strict";
/////////////////////////
// tokenizers
/////////////////////////
exports.__esModule = true;
var utils_1 = require("./utils");
var parsers_1 = require("./parsers");
var opType = parsers_1.either(parsers_1.token('query', 'opType'), parsers_1.token('mutation', 'opType'), parsers_1.token('subscription', 'opType'));
var name = parsers_1.token(/^[a-z][a-z0-9_]*/i, 'name'); //const name = token('\\w+', 'name')
var alias = parsers_1.token(/^[a-z][a-z0-9_]*/i, 'alias');
var variableName = parsers_1.token('\\$\\w+', 'variableName');
var scalarType = parsers_1.token(/^[\-_a-z]+\!?/i, 'type');
var typeClass = parsers_1.either(parsers_1.sequence(parsers_1.token(/^\[/), scalarType, parsers_1.token(/^\]/), parsers_1.maybe(parsers_1.token(/^\!/)))), scalarType;
// opArgList ($arg1: type, $arg2: type!, ...)
var opArgListFn = parsers_1.sequence(parsers_1.ignore('\\('), parsers_1.readN(1, parsers_1.sequence(variableName, parsers_1.ignore(':'), typeClass, parsers_1.maybe(parsers_1.ignore(',')))), parsers_1.ignore('\\)'));
var opArgList = function (s) {
    var v = opArgListFn(s);
    // console.log(JSON.parse(JSON.stringify(v)))
    v.ast = {
        type: 'opArgList',
        value: utils_1.flatten(v.ast)
            .map(function (_a) {
            var a = _a[0], b = _a[1];
            return ({
                name: a.value,
                type: b instanceof Array ?
                    b.map(function (_) { return _.value; }).join('')
                    : b.value
            });
        })
    };
    return v;
};
var value = parsers_1.either(function (s) {
    var x = parsers_1.sequence(parsers_1.ignore('\\.{3}'), name)(s);
    x.ast = { value: x.ast[0].value, type: 'fragmentExpansion' };
    return x;
}, parsers_1.token(/^\d+(\.\d+)?/, 'number'), function (s) {
    var x = parsers_1.sequence(parsers_1.ignore('"'), parsers_1.token('[^"]*', 'string'), parsers_1.ignore('"'))(s);
    x.ast = x.ast[0];
    return x;
}, variableName, name);
var filterArgFn = parsers_1.either(parsers_1.sequence(parsers_1.ignore('\\{'), parsers_1.readN(1, parsers_1.sequence(name, parsers_1.ignore(':'), function (s) { return filterArg(s); }, parsers_1.maybe(parsers_1.ignore(',')))), parsers_1.ignore('\\}')), value);
var filterArg = function (s) {
    var v = filterArgFn(s);
    if (v.ast[0] instanceof Array)
        v.ast = utils_1.flatten(v.ast);
    return v;
};
var selectionArgsFn = parsers_1.sequence(parsers_1.ignore('\\('), parsers_1.readN(0, parsers_1.sequence(name, parsers_1.ignore(':'), filterArg, parsers_1.maybe(parsers_1.ignore(',')))), parsers_1.ignore('\\)'));
var selectionArgs = function (s) {
    var v = selectionArgsFn(s);
    var prep = function (_a) {
        var a = _a[0], b = _a[1];
        return ({
            type: 'arg',
            name: a.value,
            valueType: b instanceof Array ? 'arg' : b.type,
            value: b instanceof Array ? b.map(prep) : b.value
        });
    };
    v.ast = utils_1.flatten(v.ast).map(prep);
    return v;
};
var fragmentExpansionFn = parsers_1.sequence(parsers_1.ignore(/^\.\.\./), name);
var fragmentExpansion = function (s) {
    var v = fragmentExpansionFn(s);
    v.ast = {
        type: 'fragmentExpansion',
        value: v.ast[1].value
    };
    return v;
};
var intoSelection = function (arr) {
    if (!(arr instanceof Array)) {
        return arr; // not a subquery
    }
    var hasAlias = utils_1.first(arr, function (x) { return x.type === 'alias'; }), hasName = utils_1.first(arr, function (x) { return x.type === 'name'; }), numItems = [hasAlias, hasName]
        .reduce(function (acc, x) { return acc + (x && 1 || 0); }, 0), rest = arr.slice(numItems);
    return {
        alias: hasAlias && hasAlias.value,
        type: 'field',
        value: hasName && hasName.value,
        filterArgs: rest.length === 2 && rest[0],
        fields: rest[rest.length === 2 ? 1 : 0]
    };
};
var selectionSetFn = parsers_1.sequence(parsers_1.ignore('\\{'), parsers_1.readN(1, parsers_1.sequence(parsers_1.either(parsers_1.sequence(alias, parsers_1.ignore(':'), name, selectionArgs, function (s) { return selectionSet(s); }), parsers_1.sequence(name, selectionArgs, function (s) { return selectionSet(s); }), parsers_1.sequence(name, function (s) { return selectionSet(s); }), fragmentExpansion, name), parsers_1.maybe(parsers_1.ignore(',')))), parsers_1.ignore('\\}'));
var selectionSet = function (s) {
    var v = selectionSetFn(s), parts = utils_1.flatten(utils_1.flatten(v.ast));
    v.ast = {
        type: 'selectionSet',
        items: parts.map(intoSelection)
    };
    return v;
};
var statementFn = parsers_1.sequence(parsers_1.maybe(opType), name, parsers_1.maybe(opArgList), selectionSet);
var statement = function (s) {
    var v = statementFn(s);
    var hasOptype = utils_1.first(v.ast, function (x, i) { return x.type === 'opType'; }), hasQueryName = utils_1.first(v.ast, function (x, i) { return x.type === 'name'; }), hasOpArgList = utils_1.first(v.ast, function (x, i) { return x.type === 'opArgList'; }), numItems = [hasOptype, hasQueryName, hasOpArgList]
        .reduce(function (acc, x) { return acc + (x && 1 || 0); }, 0);
    v.ast = {
        type: hasOptype.value,
        name: hasQueryName && hasQueryName.value,
        opArgList: hasOpArgList && hasOpArgList.value,
        children: v.ast.slice(numItems)
    };
    return v;
};
var fragmentFn = parsers_1.sequence(parsers_1.token('fragment'), name, parsers_1.ignore('on'), name, selectionSet);
var fragment = function (s) {
    var v = fragmentFn(s);
    v.ast = {
        type: 'fragmentDefinition',
        name: v.ast[1].value,
        target: v.ast[2].value,
        children: v.ast[3]
    };
    return v;
};
var parseProgramFn = parsers_1.readN(1, parsers_1.either(statement, fragment));
var removeComments = function (s) { return s.replace(/#[^\n\r]*[\n\r]/igm, ''); };
var removeWhitespace = function (s) { return s.replace(/\s+/igm, ' '); };
var parseProgram = function (s) {
    var _a = parseProgramFn(removeWhitespace(removeComments(s))), remaining = _a.remaining, matched = _a.matched, ast = _a.ast;
    if (remaining !== '')
        throw new Error("remaining, unparsed snippet of graphQL query:\n\n" + remaining);
    return ast;
};
exports["default"] = parseProgram;
