(function(FuseBox){
FuseBox.pkg("batchql", {}, function(___scope___){
___scope___.file("index.js", function(exports, require, module, __filename, __dirname){ 

"use strict";
const clan_fp_1 = require("clan-fp");
const debounce = require('lodash.debounce');
const parse = (_q, i) => {
    const [query, fragments] = removeFragments(_q), name = /^\s*(query|mutation)\s*(\w+)\s*(\([^)]+\))?\s*/ig, ws = /\s+/ig, comment = /(#|\/\/)(.*)$/igm, q = query.replace(comment, '').replace(name, '').replace(ws, ' ').trim(), sig = name.exec(query.trim()), unwrapped = q.slice(1, q.lastIndexOf('}')).trim();
    if (sig && sig[1] === 'mutation')
        throw 'Mutations cannot be batched, and must be submitted as a regular GraphQL request';
    if (sig) {
        let [s, type, name, args] = sig;
        return {
            args: parseArgs(args),
            query: parseSelections(unwrapped),
            fragments
        };
    }
    else {
        return { query: parseSelections(unwrapped), fragments };
    }
};
const removeFragments = query => {
    let r, fragments = [];
    while ((r = /\bfragment\b/ig.exec(query))) {
        let start = r.index, end = start, matched = false, stack = 0;
        while (start < query.length && !matched) {
            end++;
            query[end] === '{' && ++stack;
            query[end] === '}' && --stack === 0 && (matched = true);
        }
        if (matched) {
            let f = query.slice(start, end + 1);
            fragments.push(f);
            query = query.replace(f, '');
        }
    }
    return [query, fragments.join('\n\n')];
};
const parseArgs = args => {
    return args
        .slice(1, args.length - 1)
        .replace(/\s+/, '')
        .split(',')
        .map(kvp => {
        let [name, type] = kvp.split(':');
        return { name, type };
    });
};
const getNextBracketPairing = ss => {
    let parens = /\([^:]+:[^)]+\)/ig.exec(ss), args = parens && parens.index < ss.indexOf('{') ? parens : '', selection = args ? ss.replace(args[0], '') : ss, start = selection.indexOf('{'), end = start + 1, matched = false, nested = 0;
    while (!matched && end < selection.length) {
        ++end;
        let c = selection[end];
        if (c === '{')
            ++nested;
        else if (c === '}') {
            if (nested > 0)
                --nested;
            else
                matched = true;
        }
    }
    let sig = selection.slice(0, start).trim(), colon = sig.indexOf(':'), ref = colon !== -1
        ? sig.slice(0, colon)
        : sig, name = colon !== -1
        ? sig.slice(colon + 1)
        : sig, result = [
        {
            ref,
            args: args && args[0],
            body: selection.slice(start, end + 1).trim(),
            name: name.trim()
        },
        selection.slice(end + 1).trim()
    ];
    return result;
};
const parseSelections = (selections) => {
    let r = [];
    while (selections.length !== 0) {
        let [selection, next] = getNextBracketPairing(selections);
        selections = next;
        r.push(selection);
    }
    return r;
};
const batch = q => {
    let r = q
        .map(parse)
        .reduce((acc, x, i) => {
        let rmap = {};
        x.fragments && (acc.fragments += '\n\n' + x.fragments);
        x.args && x.args.map(({ name, type }) => {
            acc.args = `${name}:${type}`;
        });
        x.query.map(({ ref, args, body, name }) => {
            rmap[ref + i] = ref;
            acc.query += `\n\t${ref}${i}: ${name}${args || ''} ${body}\n`;
        });
        acc.rmaps.push(rmap);
        return acc;
    }, { query: '', args: '', fragments: '', rmaps: [] });
    let batchedQuery = `${r.fragments}\n\nquery batchedQuery ${r.args ? `(${r.args})` : ''} {\n${r.query}\n}`;
    return { q: batchedQuery, rmaps: r.rmaps };
};
exports.f = (url, query, args) => fetch(url, { method: 'POST', body: JSON.stringify({ query, variables: args }) })
    .then(r => r.json());
exports.mux = (getter, wait = 60, max_buffer = 8) => {
    const queries = clan_fp_1.obs() // source queries
    , callbacks = clan_fp_1.obs() // source callbacks
    , cbs = callbacks // sink callbacks
        .reduce((acc, x) => x === false ? [] : acc.concat([x]), []), payload = queries // sink queries
        .reduce((acc, val) => val === false ? [] : acc.concat([val]), []), append = ({ query = '', args = {} }) => {
        // console.log(tag`${query}`)
        queries({ query, args }); // append new query
        return payload().length - 1;
    }, parseQueryReg = q => {
        let t = /(\{|[^{])/.exec(q);
        if (t && t[0] === '{')
            return q.slice(q.indexOf('{') + 1, q.lastIndexOf('}'));
        return q;
    }, send = debounce($ => {
        let q = payload(), c = cbs();
        callbacks(false); // reset callbacks
        queries(false); // reset query data
        let { q: query, rmaps } = batch(q.map(x => x.query)), args = q.reduce((acc, x) => Object.assign(acc, x.args), {});
        getter(query, args)
            .then(data => {
            if (data.errors)
                return console.error(data.errors);
            rmaps
                .map((rmap, i) => {
                let d = Object.keys(rmap)
                    .reduce((acc, key) => {
                    // rmap[user0] -> user
                    // { user: ... } <-- { user0: {...} }
                    acc[rmap[key]] = data.data[key];
                    return acc;
                }, {});
                c[i]({ data: d }); // pipe demuxed data back into callbacks
            });
        });
    }, wait), queue = cb => {
        callbacks(cb); // append callback
        send(); // send will execute once every 60ms
    };
    return (query, args) => {
        let index = append({ query, args });
        return new Promise(res => queue(d => res(d)));
    };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.mux;

});
});
FuseBox.expose([{"alias":"batchql","pkg":"batchql/index.js"}]);
FuseBox.main("batchql/index.js");
})
(function(e){var r="undefined"!=typeof window&&window.navigator;r&&(window.global=window),e=r&&"undefined"==typeof __fbx__dnm__?e:module.exports;var t=r?window.__fsbx__=window.__fsbx__||{}:global.$fsbx=global.$fsbx||{};r||(global.require=require);var n=t.p=t.p||{},i=t.e=t.e||{},o=function(e){if(/^([@a-z].*)$/.test(e)){if("@"===e[0]){var r=e.split("/"),t=r.splice(2,r.length).join("/");return[r[0]+"/"+r[1],t||void 0]}return e.split(/\/(.+)?/)}},a=function(e){return e.substring(0,e.lastIndexOf("/"))||"./"},f=function(){for(var e=[],r=0;r<arguments.length;r++)e[r]=arguments[r];for(var t=[],n=0,i=arguments.length;n<i;n++)t=t.concat(arguments[n].split("/"));for(var o=[],n=0,i=t.length;n<i;n++){var a=t[n];a&&"."!==a&&(".."===a?o.pop():o.push(a))}return""===t[0]&&o.unshift(""),o.join("/")||(o.length?"/":".")},s=function(e){var r=e.match(/\.(\w{1,})$/);if(r){var t=r[1];return t?e:e+".js"}return e+".js"},u=function(e){if(r){var t,n=document,i=n.getElementsByTagName("head")[0];/\.css$/.test(e)?(t=n.createElement("link"),t.rel="stylesheet",t.type="text/css",t.href=e):(t=n.createElement("script"),t.type="text/javascript",t.src=e,t.async=!0),i.insertBefore(t,i.firstChild)}},l=function(e,t){var i=t.path||"./",a=t.pkg||"default",u=o(e);u&&(i="./",a=u[0],t.v&&t.v[a]&&(a=a+"@"+t.v[a]),e=u[1]),/^~/.test(e)&&(e=e.slice(2,e.length),i="./");var l=n[a];if(!l){if(r)throw'Package was not found "'+a+'"';return{serverReference:require(a)}}e||(e="./"+l.s.entry);var v,c=f(i,e),d=s(c),p=l.f[d];return!p&&/\*/.test(d)&&(v=d),p||v||(d=f(c,"/","index.js"),p=l.f[d],p||(d=c+".js",p=l.f[d]),p||(p=l.f[c+".jsx"])),{file:p,wildcard:v,pkgName:a,versions:l.v,filePath:c,validPath:d}},v=function(e,t){if(!r)return t(/\.(js|json)$/.test(e)?global.require(e):"");var n;n=new XMLHttpRequest,n.onreadystatechange=function(){if(4==n.readyState)if(200==n.status){var r=n.getResponseHeader("Content-Type"),i=n.responseText;/json/.test(r)?i="module.exports = "+i:/javascript/.test(r)||(i="module.exports = "+JSON.stringify(i));var o=f("./",e);p.dynamic(o,i),t(p.import(e,{}))}else console.error(e+" was not found upon request"),t(void 0)},n.open("GET",e,!0),n.send()},c=function(e,r){var t=i[e];if(t)for(var n in t){var o=t[n].apply(null,r);if(o===!1)return!1}},d=function(e,t){if(void 0===t&&(t={}),/^(http(s)?:|\/\/)/.test(e))return u(e);var i=l(e,t);if(i.serverReference)return i.serverReference;var o=i.file;if(i.wildcard){var f=new RegExp(i.wildcard.replace(/\*/g,"@").replace(/[.?*+^$[\]\\(){}|-]/g,"\\$&").replace(/@/g,"[a-z0-9$_-]+")),s=n[i.pkgName];if(s){var p={};for(var m in s.f)f.test(m)&&(p[m]=d(i.pkgName+"/"+m));return p}}if(!o){var g="function"==typeof t,h=c("async",[e,t]);if(h===!1)return;return v(e,function(e){if(g)return t(e)})}var _=i.validPath,x=i.pkgName;if(o.locals&&o.locals.module)return o.locals.module.exports;var w=o.locals={},b=a(_);w.exports={},w.module={exports:w.exports},w.require=function(e,r){return d(e,{pkg:x,path:b,v:i.versions})},w.require.main={filename:r?"./":global.require.main.filename,paths:r?[]:global.require.main.paths};var y=[w.module.exports,w.require,w.module,_,b,x];c("before-import",y);var k=o.fn;return k(w.module.exports,w.require,w.module,_,b,x),c("after-import",y),w.module.exports},p=function(){function t(){}return t.global=function(e,t){var n=r?window:global;return void 0===t?n[e]:void(n[e]=t)},t.import=function(e,r){return d(e,r)},t.on=function(e,r){i[e]=i[e]||[],i[e].push(r)},t.exists=function(e){var r=l(e,{});return void 0!==r.file},t.remove=function(e){var r=l(e,{}),t=n[r.pkgName];t&&t.f[r.validPath]&&delete t.f[r.validPath]},t.main=function(e){return this.mainFile=e,t.import(e,{})},t.expose=function(r){for(var t in r){var n=r[t],i=d(n.pkg);e[n.alias]=i}},t.dynamic=function(){for(var r=[],t=0;t<arguments.length;t++)r[t]=arguments[t];var n,i,o="default";2===r.length?(n=r[0],i=r[1],r):(o=r[0],n=r[1],i=r[2],r),this.pkg(o,{},function(r){r.file(n,function(r,t,n,o,a){var f=new Function("__fbx__dnm__","exports","require","module","__filename","__dirname","__root__",i);f(!0,r,t,n,o,a,e)})})},t.flush=function(e){var r=n.default;if(e)return void(r.f[e]&&delete r.f[e].locals);for(var t in r.f){var i=r.f[t];delete i.locals}},t.pkg=function(e,r,t){if(n[e])return t(n[e].s);var i=n[e]={},o=i.f={};i.v=r;var a=i.s={file:function(e,r){o[e]={fn:r}}};return t(a)},t}();return p.packages=n,p.isBrowser=void 0!==r,p.isServer=!r,e.FuseBox=p}(this))
//# sourceMappingURL=index.js.map