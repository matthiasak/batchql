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
var findNameConflicts = function (query, _q) {
    if (_q === void 0) { _q = query || []; }
    return _q
        .reduce(function (acc, q, i) {
        (q.opArgList || [])
            .map(function (o) { return o.name.slice(1); })
            .map(function (varName) {
            acc.counts[varName] = (acc.counts[varName] || 0) + 1;
            if (acc.counts[varName] > 1) {
                acc.renames[i][varName] = varName + "_" + i;
            }
        });
        return acc;
    }, {
        counts: {},
        renames: new Array(_q.length).fill(1).map(function (x) { return ({}); })
    })
        .renames;
};
var applyVariableRenames = function (queries, varRenames) {
    if (varRenames === void 0) { varRenames = findNameConflicts(queries); }
    varRenames
        .map(function (renames, i) {
        var target = queries[i];
        Object
            .keys(renames)
            .map(function (oldName) {
            var newName = renames[oldName];
            applyOpArgListRenames(target.opArgList, oldName, newName);
            applySelectionSetRenames(((target.children || []) instanceof Array ? target.children : [target.children])
                .filter(function (child) { return child.type === 'selectionSet' && child.items !== undefined; })
                .reduce(function (acc, child) { return acc.concat(child.items); }, []), oldName, newName);
        });
    });
    return varRenames;
};
var applyOpArgListRenames = function (opArgList, oldName, newName) {
    return (opArgList || [])
        .filter(function (arg) { return arg.name === '$' + oldName; })
        .map(function (arg) { return arg.name = '$' + newName; });
};
var applySelectionSetRenames = function (children, oldName, newName) {
    return (children || [])
        .filter(function (field) { return field.type === 'field' && field.fields !== undefined; })
        .map(function (field) {
        applyFilterArgListRenames(field.filterArgs || [], oldName, newName);
        applySelectionSetRenames(field.fields.items, oldName, newName);
    });
};
var applyFilterArgListRenames = function (filterArgList, oldName, newName) {
    filterArgList
        .filter(function (f) { return f.valueType === 'arg' && f.value !== undefined; })
        .map(function (f) { return applyNestedArgRename(f, oldName, newName); });
    filterArgList
        .filter(function (f) { return f.value === '$' + oldName; })
        .map(function (f) { return f.value = '$' + newName; });
};
var applyNestedArgRename = function (nestedArg, oldName, newName) {
    if (nestedArg.value instanceof Array) {
        nestedArg
            .value
            .map(function (val) { return applyNestedArgRename(val, oldName, newName); });
    }
    if (nestedArg.value === '$' + oldName)
        nestedArg.value = '$' + newName;
};
/**
 * 1. build extraction map for first query
 * 2. build 2nd extraction map, looking at first map
 * 3. build 3rd extraction map, looking at first two maps
 * etc...
*/
var buildExtractionMap = function (fields, fieldsFromOtherQueries) {
    return fields
        .reduce(function (acc, f) {
        var key = f.alias || f.value, resultKey = key;
        var filterArgHash = utils_1.ohash(f.filterArgs);
        f.__visited = true;
        var similarlyNamedVisitedFieldsWithDiffFilterArgs = fields
            .concat(utils_1.flatten(fieldsFromOtherQueries))
            .filter(function (f2) {
            return (f2.__visited === true) &&
                (f2 !== f) &&
                (f2.alias || f2.value) === key &&
                utils_1.ohash(f2.filterArgs) !== filterArgHash;
        });
        if (similarlyNamedVisitedFieldsWithDiffFilterArgs.length >= 1) {
            f.alias = key + "_" + similarlyNamedVisitedFieldsWithDiffFilterArgs.length;
            resultKey = key + "_" + similarlyNamedVisitedFieldsWithDiffFilterArgs.length + "::" + key;
        }
        acc[resultKey] =
            (f.fields !== undefined) ?
                buildExtractionMap(f.fields.items, similarlyNamedVisitedFieldsWithDiffFilterArgs) :
                null;
        return acc;
    }, {});
};
var applyAliasingToCollidingFieldNames = function (queries) {
    if (queries === void 0) { queries = []; }
    return queries
        .map(function (q) { return q.children[0].items; })
        .map(function (g, i, arr) { return buildExtractionMap(g, arr.slice(0, i)); });
};
// one function to bring them all and in the darkness bind them
var merge = function () {
    var asts = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        asts[_i] = arguments[_i];
    }
    var entries = utils_1.flatten(asts), groupedOpsByType = utils_1.groupBy(entries, function (x) { return x.type; });
    if (groupedOpsByType.mutation || groupedOpsByType.subscription)
        throw new Error("Mutations and Subscriptions currently not supported with BatchQL.");
    var queryVariableRenames = applyVariableRenames(entries), // cascade variable renames
    extractionMaps = applyAliasingToCollidingFieldNames(groupedOpsByType.query);
    var mergedQuery = (groupedOpsByType.query || [])
        .reduce(function (acc, q) {
        (_a = acc.opArgList).push.apply(_a, q.opArgList);
        (_b = acc.children).push.apply(_b, q.children);
        return acc;
        var _a, _b;
    }, {
        type: 'query',
        name: 'BATCHEDQUERY',
        opArgList: [],
        children: []
    });
    mergedQuery.children =
        utils_1.joinBy(utils_1.selectMany(mergedQuery.children, function (x) { return x.items; }), function (x) { return utils_1.only(x, 'alias', 'type', 'value', 'filterArgs'); }, function (items) {
            return utils_1.joinBy(utils_1.selectMany(items, function (x) { return x.fields.items; }), function (x) { return (__assign({}, x)); });
        }, 'fields');
    (groupedOpsByType.fragmentDefinition || [])
        .reduce(function (acc, fragment) {
        var key = fragment.name + '::' + fragment.target;
        if (acc[key] !== undefined)
            throw new Error("Multiple fragments named " + fragment.name + " defined on " + fragment.target);
        return __assign({}, acc, (_a = {}, _a[key] = 1, _a));
        var _a;
    }, {});
    return {
        mergedQuery: (groupedOpsByType.fragmentDefinition || []).concat(mergedQuery),
        queryVariableRenames: queryVariableRenames,
        extractionMaps: extractionMaps
    };
};
exports["default"] = merge;
