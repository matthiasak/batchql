"use strict";
exports.__esModule = true;
var generateOpArgList = function (args) {
    if (!args || args.length === 0)
        return '';
    return '(' + args.map(function (a) { return a.name + ": " + a.type; }).join(', ') + ')';
};
var generateValue = function (value, type) {
    if (type === undefined)
        return 'undefined';
    if (type === null)
        return 'null';
    if (type === 'number')
        return value;
    if (type === 'boolean')
        return value ? 'true' : 'false';
    if (type === 'variableName')
        return value;
    if (type === 'arg')
        return '{' +
            value.map(function (v) { return v.name + ":" + generateValue(v.value, v.valueType); }).join(', ') +
            '}';
    return "\"" + value + "\"";
};
var generateFilterArgs = function (args) {
    if (!args || args.length === 0)
        return '';
    return '(' +
        args
            .map(function (_a) {
            var name = _a.name, value = _a.value, valueType = _a.valueType;
            return name + ": " + generateValue(value, valueType);
        })
            .join(', ') +
        ')';
};
var generateFields = function (args) {
    if (!args || args.length === 0)
        return '';
    return '{' +
        args
            .map(function (x) {
            var type = x.type, value = x.value, filterArgs = x.filterArgs, fields = x.fields;
            if (type === 'field')
                return generateSelectionSet([x]);
            if (type === 'name')
                return value;
        })
            .join(' ') +
        '}';
};
var generateSelectionSet = function (set) {
    if (!set || set.length === 0)
        return '{}';
    return set
        .map(function (_a) {
        var value = _a.value, filterArgs = _a.filterArgs, fields = _a.fields, alias = _a.alias, items = _a.items;
        return (alias ? alias + " : " : '') +
            value +
            (items ?
                generateFields(items) :
                (generateFilterArgs(filterArgs) +
                    generateFields(fields instanceof Array ? fields : fields.items)));
    })
        .join(' ');
};
var generateQuery = function (_a) {
    var type = _a.type, name = _a.name, opArgList = _a.opArgList, children = _a.children;
    return type + " " + (name || '') + " " + generateOpArgList(opArgList) + " " + generateFields(children);
};
var generateFragment = function (_a) {
    var name = _a.name, target = _a.target, child = _a.children;
    return "fragment " + name + " on " + target + " " + generateFields(child.items);
};
var regenerate = function (ast) {
    return ast.reduce(function (acc, q) {
        switch (q.type) {
            case "query": return acc + generateQuery(q) + '\n';
            case "fragmentDefinition": return acc + generateFragment(q) + '\n';
            default: throw new Error("Unknown operation: \"" + q.type + "\"");
        }
    }, '');
};
exports["default"] = regenerate;
