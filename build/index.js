"use strict";
var clan_fp_1 = require("clan-fp");
var debounce = require('lodash.debounce');
var mutationWarningShown = false;
var parse = function (_q, i) {
    var _a = removeFragments(_q), query = _a[0], fragments = _a[1], name = /^\s*(query|mutation)\s*(\w+)\s*(\([^)]+\))?\s*/ig, ws = /\s+/ig, comment = /(#|\/\/)(.*)$/igm, q = query.replace(comment, '').replace(name, '').replace(ws, ' ').trim(), sig = name.exec(query.trim()), unwrapped = q.slice(1, q.lastIndexOf('}')).trim();
    if (sig && sig[1] === 'mutation' && !mutationWarningShown) {
        mutationWarningShown = true;
        console.warn instanceof Function && console.warn('Take caution when batching mutations. It is recommended they are submitted as a regular GraphQL request.');
    }
    if (sig) {
        var s = sig[0], type = sig[1], name_1 = sig[2], args = sig[3];
        return {
            args: parseArgs(args),
            query: parseSelections(unwrapped),
            fragments: fragments
        };
    }
    else {
        return { query: parseSelections(unwrapped), fragments: fragments };
    }
};
var removeFragments = function (query) {
    var r, fragments = [];
    while ((r = /\bfragment\b/ig.exec(query))) {
        var start = r.index, end = start, matched = false, stack = 0;
        while (start < query.length && !matched) {
            end++;
            query[end] === '{' && ++stack;
            query[end] === '}' && --stack === 0 && (matched = true);
        }
        if (matched) {
            var f_1 = query.slice(start, end + 1);
            fragments.push(f_1);
            query = query.replace(f_1, '');
        }
    }
    return [query, fragments.join('\n\n')];
};
var parseArgs = function (args) {
    return args
        .slice(1, args.length - 1)
        .replace(/\s+/, '')
        .split(',')
        .map(function (kvp) {
        var _a = kvp.split(':'), name = _a[0], type = _a[1];
        return { name: name, type: type };
    });
};
var getNextBracketPairing = function (ss) {
    var parens = /\([^:]+:[^)]+\)/ig.exec(ss), args = parens && parens.index < ss.indexOf('{') ? parens : '', selection = args ? ss.replace(args[0], '') : ss, start = selection.indexOf('{'), end = start + 1, matched = false, nested = 0;
    while (!matched && end < selection.length) {
        ++end;
        var c = selection[end];
        if (c === '{')
            ++nested;
        else if (c === '}') {
            if (nested > 0)
                --nested;
            else
                matched = true;
        }
    }
    var sig = selection.slice(0, start).trim(), colon = sig.indexOf(':'), ref = colon !== -1
        ? sig.slice(0, colon)
        : sig, name = colon !== -1
        ? sig.slice(colon + 1)
        : sig, result = [
        {
            ref: ref,
            args: args && args[0],
            body: selection.slice(start, end + 1).trim(),
            name: name.trim()
        },
        selection.slice(end + 1).trim()
    ];
    return result;
};
var parseSelections = function (selections) {
    var r = [];
    while (selections.length !== 0) {
        var _a = getNextBracketPairing(selections), selection = _a[0], next = _a[1];
        selections = next;
        r.push(selection);
    }
    return r;
};
var batch = function (q) {
    var r = q
        .map(parse)
        .reduce(function (acc, x, i) {
        var rmap = {};
        x.fragments && (acc.fragments += '\n\n' + x.fragments);
        x.args && x.args.map(function (_a) {
            var name = _a.name, type = _a.type;
            acc.args = name + ":" + type;
        });
        x.query.map(function (_a) {
            var ref = _a.ref, args = _a.args, body = _a.body, name = _a.name;
            rmap[ref + i] = ref;
            acc.query += "\n\t" + ref + i + ": " + name + (args || '') + " " + body + "\n";
        });
        acc.rmaps.push(rmap);
        return acc;
    }, { query: '', args: '', fragments: '', rmaps: [] });
    var batchedQuery = r.fragments + "\n\nquery batchedQuery " + (r.args ? "(" + r.args + ")" : '') + " {\n" + r.query + "\n}";
    return { q: batchedQuery, rmaps: r.rmaps };
};
exports.f = function (url, query, args) {
    return fetch(url, { method: 'POST', body: JSON.stringify({ query: query, variables: args }) })
        .then(function (r) { return r.json(); });
};
exports.mux = function (getter, wait, max_buffer) {
    if (wait === void 0) { wait = 60; }
    if (max_buffer === void 0) { max_buffer = 8; }
    var queries = clan_fp_1.obs() // source queries
    , callbacks = clan_fp_1.obs() // source callbacks
    , cbs = callbacks // sink callbacks
        .reduce(function (acc, x) { return x === false ? [] : acc.concat([x]); }, []), payload = queries // sink queries
        .reduce(function (acc, val) { return val === false ? [] : acc.concat([val]); }, []), append = function (_a) {
        var _b = _a.query, query = _b === void 0 ? '' : _b, _c = _a.args, args = _c === void 0 ? {} : _c;
        // console.log(tag`${query}`)
        queries({ query: query, args: args }); // append new query
        return payload().length - 1;
    }, parseQueryReg = function (q) {
        var t = /(\{|[^{])/.exec(q);
        if (t && t[0] === '{')
            return q.slice(q.indexOf('{') + 1, q.lastIndexOf('}'));
        return q;
    }, send = debounce(function ($) {
        var q = payload(), c = cbs();
        callbacks(false); // reset callbacks
        queries(false); // reset query data
        var _a = batch(q.map(function (x) { return x.query; })), query = _a.q, rmaps = _a.rmaps, args = q.reduce(function (acc, x) { return Object.assign(acc, x.args); }, {});
        getter(query, args)
            .then(function (data) {
            if (data.errors)
                return console.error(data.errors);
            rmaps
                .map(function (rmap, i) {
                var d = Object.keys(rmap)
                    .reduce(function (acc, key) {
                    // rmap[user0] -> user
                    // { user: ... } <-- { user0: {...} }
                    acc[rmap[key]] = data.data[key];
                    return acc;
                }, {});
                c[i]({ data: d }); // pipe demuxed data back into callbacks
            });
        });
    }, wait), queue = function (cb) {
        callbacks(cb); // append callback
        send(); // send will execute once every 60ms
    };
    return function (query, args) {
        var index = append({ query: query, args: args });
        return new Promise(function (res) {
            return queue(function (d) { return res(d); });
        });
    };
};
exports.__esModule = true;
exports["default"] = exports.mux;
