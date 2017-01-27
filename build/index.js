(function(FuseBox){
FuseBox.pkg("batchql", {}, function(___scope___){
___scope___.file("index.js", function(exports, require, module, __filename, __dirname){ 

"use strict";
const clan_fp_1 = require("clan-fp");
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
(function(){
    FuseBox.pkg('clan-fp', {}, function (___scope___) {
        ___scope___.file('index.js', function (exports, require, module, __filename, __dirname) {
            'use strict';
            const batch_1 = require('./batch');
            const vdom_1 = require('./vdom');
            const mixin_1 = require('./mixin');
            const model_1 = require('./model');
            const observable_1 = require('./observable');
            const hamt = require('./hamt');
            const worker = require('./worker');
            const fp = require('./fp');
            const hash = (v, _v = JSON.stringify(v)) => {
                let hash = 0;
                for (let i = 0, len = _v.length; i < len; ++i) {
                    const c = _v.charCodeAt(i);
                    hash = (hash << 5) - hash + c | 0;
                }
                return hash;
            };
            module.exports = Object.assign({}, fp, {
                batch: batch_1.default,
                vdom: vdom_1.default,
                mixin: mixin_1.default,
                model: model_1.default,
                obs: observable_1.default,
                hamt,
                worker,
                hash
            });
        });
        ___scope___.file('batch.js', function (exports, require, module, __filename, __dirname) {
            'use strict';
            const batch = f => {
                let inflight = {};
                return (url, options = {}) => {
                    let {method} = options, key = `${ url }:${ JSON.stringify(options) }`;
                    if ((method || '').toLowerCase() === 'post')
                        return f(url, Object.assign({}, options, { compress: false }));
                    return inflight[key] || (inflight[key] = new Promise((res, rej) => {
                        f(url, Object.assign({}, options, { compress: false })).then(d => res(d)).catch(e => rej(e));
                    }).then(data => {
                        inflight = Object.assign({}, inflight, { [key]: undefined });
                        return data;
                    }).catch(e => console.error(e, url)));
                };
            };
            Object.defineProperty(exports, '__esModule', { value: true });
            exports.default = batch;
        });
        ___scope___.file('vdom.js', function (exports, require, module, __filename, __dirname) {
            'use strict';
            const fp_1 = require('./fp');
            const vdom = () => {
                const class_id_regex = () => {
                        return /[#\.][^#\.]+/gi;
                    }, tagName_regex = () => {
                        return /^([^\.#]+)\b/i;
                    };
                const parseSelector = s => {
                    let test = null, tagreg = tagName_regex().exec(s), tag = tagreg && tagreg.slice(1)[0], reg = class_id_regex(), vdom = Object.create(null);
                    if (tag)
                        s = s.substr(tag.length);
                    vdom.className = '';
                    vdom.tag = tag || 'div';
                    while ((test = reg.exec(s)) !== null) {
                        test = test[0];
                        if (test[0] === '.')
                            vdom.className = (vdom.className + ' ' + test.substr(1)).trim();
                        else if (test[0] === '#')
                            vdom.id = test.substr(1);
                    }
                    return vdom;
                };
                const debounce = (func, wait, immediate, timeout) => (...args) => {
                    let later = () => {
                        timeout = null;
                        !immediate && func(...args);
                    };
                    var callNow = immediate && !timeout;
                    clearTimeout(timeout);
                    timeout = setTimeout(later, wait || 0);
                    callNow && func(...args);
                };
                const hash = (v, _v = JSON.stringify(v)) => {
                    let hash = 0;
                    for (let i = 0, len = _v.length; i < len; ++i) {
                        const c = _v.charCodeAt(i);
                        hash = (hash << 5) - hash + c | 0;
                    }
                    return hash;
                };
                const m = (selector, attrs = Object.create(null), ...children) => {
                    if (attrs.tag || !(typeof attrs === 'object') || attrs instanceof Array || attrs instanceof Function) {
                        if (attrs instanceof Array)
                            children.unshift(...attrs);
                        else
                            children.unshift(attrs);
                        attrs = Object.create(null);
                    }
                    let vdom = parseSelector(selector);
                    if (children.length)
                        vdom.children = children;
                    vdom.attrs = attrs;
                    vdom.shouldUpdate = attrs.shouldUpdate;
                    vdom.unload = attrs.unload;
                    vdom.config = attrs.config;
                    vdom.__hash = hash(vdom);
                    delete attrs.unload;
                    delete attrs.shouldUpdate;
                    delete attrs.config;
                    return vdom;
                };
                const stripEvents = ({attrs}) => {
                    let a = Object.create(null);
                    if (attrs) {
                        for (var name in attrs) {
                            if (name[0] === 'o' && name[1] === 'n') {
                                a[name] = attrs[name];
                                delete attrs[name];
                            }
                        }
                    }
                    return a;
                };
                const applyEvents = (events, el, strip_existing = true) => {
                    strip_existing && removeEvents(el);
                    for (var name in events) {
                        el[name] = events[name];
                    }
                };
                const flatten = (arr, a = []) => {
                    for (var i = 0, len = arr.length; i < len; i++) {
                        let v = arr[i];
                        if (!(v instanceof Array)) {
                            a.push(v);
                        } else {
                            flatten(v, a);
                        }
                    }
                    return a;
                };
                const EVENTS = 'mouseover,mouseout,wheel,mousemove,blur,focus,click,abort,afterprint,animationend,animationiteration,animationstart,beforeprint,canplay,canplaythrough,change,contextmenu,dblclick,drag,dragend,dragenter,dragleave,dragover,dragstart,drop,durationchange,emptied,ended,error,load,input,invalid,keydown,keypress,keyup,loadeddata,loadedmetadata,mousedown,mouseenter,mouseleave,mouseup,pause,pointercancel,pointerdown,pointerenter,pointerleave,pointermove,pointerout,pointerover,pointerup,play,playing,ratechange,reset,resize,scroll,seeked,seeking,select,selectstart,selectionchange,show,submit,timeupdate,touchstart,touchend,touchcancel,touchmove,touchenter,touchleave,transitionend,volumechange,waiting'.split(',').map(x => 'on' + x);
                const removeEvents = el => {
                    if (!el)
                        return;
                    for (var i in EVENTS) {
                        el[i] = null;
                    }
                };
                let mnt;
                const mount = (fn, el) => {
                    mnt = [
                        el,
                        fn
                    ];
                    render(fn, el);
                };
                const render = debounce((fn, el) => fp_1.rAF(_ => {
                    applyUpdates(fn, el.children[0], el);
                }));
                const update = () => {
                    if (!mnt)
                        return;
                    let [el, fn] = mnt;
                    render(fn, el);
                };
                const stylify = style => {
                    let s = '';
                    for (var i in style) {
                        s += `${ i }:${ style[i] };`;
                    }
                    return s;
                };
                const setAttrs = ({attrs, id, className, __hash}, el) => {
                    el.className = '';
                    el.style = '';
                    if (attrs) {
                        for (var attr in attrs) {
                            if (attr === 'style') {
                                el.style = stylify(attrs[attr]);
                            } else if (attr === 'innerHTML') {
                                fp_1.rAF(() => el.innerHTML = attrs[attr]);
                            } else if (attr === 'value') {
                                fp_1.rAF(() => el.value = attrs[attr]);
                            } else {
                                el.setAttribute(attr, attrs[attr]);
                            }
                        }
                    }
                    let _id = attrs.id || id;
                    if (_id)
                        el.id = _id;
                    let _className = ((attrs.className || '') + ' ' + (className || '')).trim();
                    if (_className)
                        el.className = _className;
                    el.__hash = __hash;
                };
                const createTag = (vdom = Object.create(null), el, parent = el && el.parentElement) => {
                    let __vdom = vdom;
                    if (typeof vdom !== 'object') {
                        let t = document.createTextNode(vdom);
                        if (el) {
                            parent.insertBefore(t, el);
                            removeEl(el);
                        } else {
                            parent.appendChild(t);
                        }
                        return t;
                    }
                    let {tag, attrs, id, className, unload, shouldUpdate, config, __hash} = vdom, shouldExchange = !el || !el.tagName || tag && el.tagName.toLowerCase() !== tag.toLowerCase(), _shouldUpdate = !(shouldUpdate instanceof Function) || shouldUpdate(el);
                    if (!attrs)
                        return;
                    if (el && (!_shouldUpdate || !vdom instanceof Function && el.__hash === __hash)) {
                        return;
                    }
                    if (shouldExchange) {
                        let t = document.createElement(tag);
                        el ? (parent.insertBefore(t, el), removeEl(el)) : parent.appendChild(t);
                        el = t;
                    }
                    setAttrs(vdom, el);
                    if (el.unload instanceof Function) {
                        fp_1.rAF(el.unload);
                    }
                    if (unload instanceof Function) {
                        el.unload = unload;
                    }
                    applyEvents(stripEvents(vdom), el);
                    config && fp_1.rAF(_ => config(el));
                    return el;
                };
                const removeEl = el => {
                    if (!el)
                        return;
                    el.parentElement.removeChild(el);
                    removeEvents(el);
                    if (el.unload instanceof Function)
                        el.unload();
                };
                const insertAt = (el, parent, i) => {
                    if (parent.children.length > i) {
                        let next_sib = parent.children[i];
                        parent.insertBefore(el, next_sib);
                    } else {
                        parent.appendChild(el);
                    }
                };
                const applyUpdates = (vdom, el, parent = el && el.parentElement) => {
                    let v = vdom;
                    while (vdom instanceof Function)
                        vdom = vdom();
                    if (!vdom)
                        return;
                    if (vdom.resolve instanceof Function) {
                        let i = parent.children.length;
                        return vdom.resolve().then(v => {
                            if (!el) {
                                let x = createTag(v, null, parent);
                                insertAt(x, parent, i);
                                applyUpdates(v, x, parent);
                            } else {
                                applyUpdates(v, el, parent);
                            }
                        });
                    }
                    let _el = vdom instanceof Array ? parent : createTag(vdom, el, parent);
                    if (!_el)
                        return;
                    if (vdom instanceof Array || vdom.children) {
                        let vdom_children = flatten(vdom instanceof Array ? vdom : vdom.children), el_children = vdom instanceof Array ? parent.childNodes : _el.childNodes;
                        while (el_children.length > vdom_children.length) {
                            removeEl(el_children[el_children.length - 1]);
                        }
                        for (let i = 0; i < vdom_children.length; i++) {
                            applyUpdates(vdom_children[i], el_children[i], _el);
                        }
                    } else {
                        while (_el.childNodes.length > 0) {
                            removeEl(_el.childNodes[_el.childNodes.length - 1]);
                        }
                    }
                };
                const qs = (s = 'body', el = document) => el.querySelector(s);
                const resolver = (states = {}) => {
                    let promises = [], done = false;
                    const _await = (_promises = []) => {
                        promises = [
                            ...promises,
                            ..._promises
                        ];
                        return finish();
                    };
                    const wait = (ms = 0) => new Promise(res => setTimeout(res, ms));
                    const isDone = () => done;
                    const finish = () => {
                        const total = promises.length;
                        return wait().then(_ => Promise.all(promises)).then(values => {
                            if (promises.length > total) {
                                return finish();
                            }
                            done = true;
                            return states;
                        });
                    };
                    const resolve = props => {
                        const keys = Object.keys(props);
                        if (!keys.length)
                            return Promise.resolve(true);
                        let f = [];
                        keys.forEach(name => {
                            let x = props[name];
                            while (x instanceof Function)
                                x = x();
                            if (x && x.then instanceof Function)
                                f.push(x.then(d => states[name] = d));
                        });
                        return _await(f);
                    };
                    const getState = () => states;
                    return {
                        finish,
                        resolve,
                        getState,
                        promises,
                        isDone
                    };
                };
                const gs = (view, state) => {
                    let r = view(state);
                    while (r instanceof Function)
                        r = view(instance.getState());
                    return r;
                };
                const container = (view, queries = {}, instance = resolver()) => {
                    let wrapper_view = state => instance.isDone() ? view(state) : m('span');
                    return () => {
                        let r = gs(wrapper_view, instance.getState());
                        instance.resolve(queries);
                        if (r instanceof Array) {
                            let d = instance.finish().then(_ => gs(wrapper_view, instance.getState()));
                            return r.map((x, i) => {
                                x.resolve = _ => d.then(vdom => vdom[i]);
                                return x;
                            });
                        }
                        r.resolve = _ => instance.finish().then(_ => gs(wrapper_view, instance.getState()));
                        return r;
                    };
                };
                const reservedAttrs = [
                    'className',
                    'id'
                ];
                const toHTML = _vdom => {
                    while (_vdom instanceof Function)
                        _vdom = _vdom();
                    if (_vdom instanceof Array)
                        return new Promise(r => r(html(..._vdom)));
                    if (!_vdom)
                        return new Promise(r => r(''));
                    if (typeof _vdom !== 'object')
                        return new Promise(r => r(_vdom));
                    return (_vdom.resolve ? _vdom.resolve() : Promise.resolve()).then(vdom => {
                        if (!vdom)
                            vdom = _vdom;
                        if (vdom instanceof Array)
                            return new Promise(r => r(html(...vdom)));
                        const {tag, id, className, attrs, children, instance} = vdom, _id = id || attrs && attrs.id ? ` id="${ id || attrs && attrs.id || '' }"` : '', _class = className || attrs && attrs.className ? ` class="${ ((className || '') + ' ' + (attrs.className || '')).trim() }"` : '';
                        const events = stripEvents(vdom);
                        let _attrs = '', inner = '';
                        for (var i in attrs || Object.create(null)) {
                            if (i === 'style') {
                                _attrs += ` style="${ stylify(attrs[i]) }"`;
                            } else if (i === 'innerHTML') {
                                inner = attrs[i];
                            } else if (reservedAttrs.indexOf(i) === -1) {
                                _attrs += ` ${ i }="${ attrs[i] }"`;
                            }
                        }
                        if (!inner && children)
                            return html(...children).then(str => `<${ tag }${ _id }${ _class }${ _attrs }>${ str }</${ tag }>`);
                        if ('br,input,img'.split(',').filter(x => x === tag).length === 0)
                            return new Promise(r => r(`<${ tag }${ _id }${ _class }${ _attrs }>${ inner }</${ tag }>`));
                        return new Promise(r => r(`<${ tag }${ _id }${ _class }${ _attrs } />`));
                    });
                };
                const html = (...v) => Promise.all(v.map(toHTML)).then(x => x.filter(x => !!x).join(''));
                return {
                    container,
                    html,
                    qs,
                    update,
                    mount,
                    m,
                    debounce
                };
            };
            Object.defineProperty(exports, '__esModule', { value: true });
            exports.default = vdom();
        });
        ___scope___.file('fp.js', function (exports, require, module, __filename, __dirname) {
            'use strict';
            exports.log = (...a) => console.log(...a);
            exports.rAF = !!global.document && (global.requestAnimationFrame || global.webkitRequestAnimationFrame || global.mozRequestAnimationFrame) || (cb => setTimeout(cb, 16.6));
            exports.c = (f, g) => x => f(g(x));
            exports.cof = (...fns) => fns.reduce((acc, fn) => exports.c(acc, fn));
            exports.cob = (...fns) => exports.cof(...fns.reverse());
            exports.pf = fn => (...args) => x => fn.apply(x, args);
            exports.curry = (fn, ...args) => fn.bind(undefined, ...args);
            exports.mapping = mapper => reducer => (result, value) => reducer(result, mapper(value));
            exports.filtering = predicate => reducer => (result, value) => predicate(value) ? reducer(result, value) : result;
            exports.concatter = (thing, value) => thing.concat([value]);
        });
        ___scope___.file('mixin.js', function (exports, require, module, __filename, __dirname) {
            'use strict';
            const mixin = (...classes) => {
                class _mixin {
                }
                let proto = _mixin.prototype;
                classes.map(({prototype: p}) => {
                    Object.getOwnPropertyNames(p).map(key => {
                        let oldFn = proto[key] || ($ => {
                        });
                        proto[key] = function () {
                            oldFn.apply(null, [].slice.call(arguments));
                            return p[key].apply(null, [].slice.call(arguments));
                        };
                    });
                });
                return _mixin;
            };
            Object.defineProperty(exports, '__esModule', { value: true });
            exports.default = mixin;
        });
        ___scope___.file('model.js', function (exports, require, module, __filename, __dirname) {
            'use strict';
            const model = {
                is(type, value) {
                    if (type && type.isValid instanceof Function) {
                        return type.isValid(value);
                    } else if (type === String && (value instanceof String || typeof value === 'string') || type === Number && (value instanceof Number || typeof value === 'number') || type === Boolean && (value instanceof Boolean || typeof value === 'boolean') || type === Function && (value instanceof Function || typeof value === 'function') || type === Object && (value instanceof Object || typeof value === 'object') || type === undefined) {
                        return true;
                    }
                    return false;
                },
                check(types, required, data) {
                    Object.keys(types).forEach(key => {
                        let t = types[key], value = data[key];
                        if (required[key] || value !== undefined) {
                            if (!(t instanceof Array))
                                t = [t];
                            let i = t.reduce((a, _type) => a || MODEL.is(_type, value), false);
                            if (!i) {
                                throw `{${ key }: ${ JSON.stringify(value) }} is not one of ${ t.map(x => `\n - ${ x }`) }`;
                            }
                        }
                    });
                    return true;
                },
                init(...args) {
                    let types, required, logic;
                    args.map(x => {
                        if (x instanceof Function && !logic) {
                            logic = x;
                        } else if (typeof x === 'object') {
                            if (!types) {
                                types = x;
                            } else if (!required) {
                                required = x;
                            }
                        }
                    });
                    const isValid = data => {
                        const pipe = logic ? [
                            check,
                            logic
                        ] : [check];
                        return pipe.reduce((a, v) => a && v(types || {}, required || {}, data), true);
                    };
                    const whenValid = data => new Promise((res, rej) => isValid(data) && res(data));
                    return {
                        isValid,
                        whenValid
                    };
                },
                ArrayOf(M) {
                    return MODEL.init((t, r, data) => {
                        if (!(data instanceof Array))
                            throw `${ data } not an Array`;
                        data.map(x => {
                            if (!MODEL.is(M, x))
                                throw `${ x } is not a model instance`;
                        });
                        return true;
                    });
                }
            };
            Object.defineProperty(exports, '__esModule', { value: true });
            exports.default = model;
        });
        ___scope___.file('observable.js', function (exports, require, module, __filename, __dirname) {
            'use strict';
            const obs = state => {
                let subscribers = [];
                const fn = val => {
                    if (val !== undefined) {
                        state = val;
                        for (let i = 0, len = subscribers.length; i < len; i++)
                            subscribers[i](val);
                    }
                    return state;
                };
                fn.map = f => {
                    const o = obs();
                    subscribers.push(val => o(f(val)));
                    return o;
                };
                fn.filter = f => {
                    const o = obs();
                    subscribers.push(val => f(val) && o(val));
                    return o;
                };
                fn.then = f => {
                    subscribers.push(val => f(val));
                    return fn;
                };
                fn.take = n => {
                    const values = [], o = obs();
                    const cb = val => {
                        if (values.length < n)
                            values.push(val);
                        if (values.length === n) {
                            subscribers.delete(cb);
                            return o(values);
                        }
                    };
                    subscribers.push(cb);
                    return o;
                };
                fn.takeWhile = f => {
                    const values = [], o = obs();
                    const cb = val => {
                        if (!f(val)) {
                            subscribers = subscribers.filter(x => x !== cb);
                            return o(values);
                        }
                        values.push(val);
                    };
                    subscribers.push(cb);
                    return o;
                };
                fn.reduce = (f, acc) => {
                    const o = obs();
                    subscribers.push(val => {
                        acc = f(acc, val);
                        o(acc);
                    });
                    return o;
                };
                fn.maybe = f => {
                    const success = obs(), error = obs(), cb = val => f(val).then(d => success(d)).catch(e => error(e));
                    subscribers.push(cb);
                    return [
                        success,
                        error
                    ];
                };
                fn.stop = () => subscribers = [];
                fn.debounce = ms => {
                    const o = obs();
                    let ts = +new Date();
                    subscribers.push(val => {
                        const now = +new Date();
                        if (now - ts >= ms) {
                            ts = +new Date();
                            o(val);
                        }
                    });
                    return o;
                };
                return fn;
            };
            obs.from = f => {
                const o = obs();
                f(x => o(x));
                return o;
            };
            obs.union = (...fs) => {
                const o = obs();
                fs.map(f => f.then(o));
                return o;
            };
            Object.defineProperty(exports, '__esModule', { value: true });
            exports.default = obs;
        });
        ___scope___.file('hamt.js', function (exports, require, module, __filename, __dirname) {
            'use strict';
            exports.hamming = x => {
                x -= x >> 1 & 1431655765;
                x = (x & 858993459) + (x >> 2 & 858993459);
                x = x + (x >> 4) & 252645135;
                x += x >> 8;
                x += x >> 16;
                return x & 127;
            };
            exports.popcount = root => {
                if (root.key)
                    return 1;
                let c = root.children;
                if (c) {
                    var sum = 0;
                    for (var i in c)
                        sum += exports.popcount(c[i]);
                    return sum;
                }
            };
            exports.hash = (v = '') => {
                v = JSON.stringify(v);
                var hash = 5381;
                for (let i = 0; i < v.length; i++)
                    hash = (hash << 5) + hash + v.charCodeAt(i);
                return hash;
            };
            exports.comp = (a, b) => exports.hash(a) === exports.hash(b);
            exports.HMAP_SIZE = 8;
            exports.MAX_DEPTH = 32 / exports.HMAP_SIZE - 1;
            exports.vec = (h = 0, i = 0, range = exports.HMAP_SIZE) => h >>> range * i & (1 << range) - 1;
            exports.shallowClone = x => {
                let y = Object.create(null);
                for (let i in x)
                    y[i] = x[i];
                return y;
            };
            exports.cloneNode = x => {
                let y = exports.node();
                if (!x)
                    return y;
                if (x.children) {
                    y.children = exports.shallowClone(x.children);
                } else if (x.key !== undefined) {
                    y.key = x.key;
                    y.val = x.val;
                    y.hash = x.hash;
                }
                return y;
            };
            exports.numChildren = x => {
                let c = 0;
                for (var i in x)
                    ++c;
                return c;
            };
            exports.set = (root, key, val) => {
                if (root.key === undefined && !root.children)
                    return exports.node(key, val);
                const newroot = exports.cloneNode(root), h = exports.hash(key);
                for (var i = 3, r = root, n = newroot; i >= 0; --i) {
                    let bits = exports.vec(h, i);
                    if (r.key !== undefined) {
                        if (r.key === key || i === 0) {
                            n.val = val;
                        } else if (i !== 0) {
                            let cp = exports.node(r.key, r.val, r.hash);
                            let cn = exports.node(key, val, h);
                            let rh = r.hash;
                            delete r.key;
                            delete r.val;
                            delete r.hash;
                            delete n.key;
                            delete n.val;
                            delete n.hash;
                            for (let j = i, __r = r, __n = n; j >= 0; j--) {
                                let vecr = exports.vec(rh, j), vecn = exports.vec(h, j);
                                let c = __r.children = Object.create(null);
                                let d = __n.children = exports.shallowClone(c);
                                if (vecr !== vecn) {
                                    c[vecr] = cp;
                                    d[vecr] = cp;
                                    d[vecn] = cn;
                                    break;
                                } else {
                                    __r = c[vecr] = exports.node();
                                    __n = d[vecn] = exports.cloneNode(__r);
                                }
                            }
                        }
                        break;
                    } else if (r.children) {
                        let _r = r.children[bits];
                        if (!_r) {
                            n = n.children[bits] = exports.node(key, val);
                            break;
                        } else {
                            r = _r;
                            n = n.children[bits] = exports.cloneNode(r);
                        }
                    }
                }
                return newroot;
            };
            exports.get = (root, key) => {
                if (root.key === key)
                    return root.val;
                const h = exports.hash(key);
                for (let i = 3, r = root; i >= 0; --i) {
                    if (!r.children)
                        return undefined;
                    r = r.children[exports.vec(h, i)];
                    if (!r)
                        return undefined;
                    if (r.key !== undefined)
                        return r.val;
                }
                return undefined;
            };
            exports.first = root => {
                let c = root.children;
                for (let i in c)
                    return c[i];
            };
            exports.unset = (root, key) => {
                const n = exports.cloneNode(root), h = exports.hash(key);
                for (var i = 3, _n = n, p = n; i >= -1; --i) {
                    if (_n.key) {
                        delete _n.key;
                        delete _n.val;
                        delete _n.hash;
                        return n;
                    }
                    const bits = exports.vec(h, i);
                    _n = _n && _n.children && _n.children[bits];
                    if (!_n)
                        return n;
                    p = _n;
                }
                return n;
            };
            exports.node = (key, val, h = key !== undefined && exports.hash(key)) => {
                let item = Object.create(null);
                if (key !== undefined) {
                    item.key = key;
                    item.hash = h;
                    item.val = val;
                }
                return item;
            };
            exports.map = (root, fn) => {
                if (root.key !== undefined)
                    return exports.node(root.key, fn(root.val, root.key), root.hash);
                let d = exports.cloneNode(root), c = d.children;
                if (c) {
                    for (var i in c) {
                        c[i] = exports.map(c[i], fn);
                    }
                }
                return d;
            };
            exports.filter = (root, fn) => {
                if (root.key !== undefined)
                    return fn(root.val, root.key) ? root : undefined;
                let d = exports.cloneNode(root), c = d.children;
                if (c) {
                    for (var i in c) {
                        if (!exports.filter(c[i], fn))
                            delete c[i];
                    }
                }
                return d;
            };
            exports.reduce = (root, fn, acc) => {
                if (root.key !== undefined)
                    return fn(acc, root.val, root.key);
                let c = root.children;
                if (c) {
                    for (var i in c)
                        acc = exports.reduce(c[i], fn, acc);
                    return acc;
                }
            };
            exports.toList = (root, r = []) => {
                if (root.key !== undefined)
                    r.push(root.val);
                let c = root.children;
                if (c) {
                    for (var i in c) {
                        exports.toList(c[i], r);
                    }
                }
                return r;
            };
            exports.toOrderedList = (root, r = []) => {
                let i = 0, n;
                do {
                    n = exports.get(root, i++);
                    n !== undefined && r.push(n);
                } while (n);
                return r;
            };
            exports.toJSON = (root, r = {}) => {
                if (root.key !== undefined)
                    r[root.key] = root.val;
                let c = root.children;
                if (c) {
                    for (var i in c) {
                        toJson(c[i], r);
                    }
                }
                return r;
            };
            exports.push = (root, val) => exports.set(root, exports.popcount(root), val);
            exports.pop = root => exports.unset(root, exports.popcount(root) - 1);
            exports.shift = root => exports.reduce(exports.unset(root, 0), (acc, v, k) => exports.set(acc, k - 1, v), exports.node());
            exports.unshift = (root, val) => exports.set(exports.reduce(root, (acc, v, k) => exports.set(acc, k + 1, v), exports.node()), 0, val);
            exports.hamt = exports.node;
        });
        ___scope___.file('worker.js', function (exports, require, module, __filename, __dirname) {
            'use strict';
            const supports = (...q) => () => q.reduce((acc, s) => acc || window[s] !== undefined && /[native code]/.test(window[s] + '') && window[s], false);
            const supportsWorkers = supports('Worker');
            const supportsBlobs = supports('Blob');
            const supportsURLs = supports('URL', 'webkitURL');
            const supportsBuilders = supports('BlobBuilder', 'WebKitBlobBuilder', 'MozBlobBuilder');
            exports.worker = (...code) => {
                if (!supportsWorkers())
                    throw 'WebWorkers not supported';
                code[code.length - 1] = `self.onmessage=${ code[code.length - 1] }`;
                const B = supportsBlobs(), U = supportsBuilders(), W = supportsURLs();
                let blob;
                if (supportsBlobs()) {
                    blob = new B(code.map(c => c + ''), { type: 'application/javascript' });
                } else if (U) {
                    blob = new U();
                    code.map(c => blob.append(c + ''));
                    blob = blob.getBlob();
                } else {
                    blob = `data:application/javascript,` + `${ encodeURIComponent(code.reduce((acc, c) => acc + c, '')) }`;
                }
                let url = W.createObjectURL(blob);
                return new Worker(url);
            };
            exports.farm = (n, ...code) => {
                let workers = Array(n).fill(1).map(x => exports.worker(...code)), current = 0, iter = () => {
                        let _n = current;
                        ++current >= n && (current = 0);
                        return current;
                    }, pipe, onerror;
                workers.map(w => {
                    w.onmessage = e => pipe instanceof Function && pipe(e.data);
                    w.onerror = e => onerror instanceof Function && onerror(e);
                });
                const exec = (...args) => {
                    let w = workers[iter()];
                    w && w.postMessage(args);
                };
                exec.pipe = fn => {
                    pipe = fn;
                    return exec;
                };
                exec.error = fn => {
                    onerror = fn;
                    return exec;
                };
                return exec;
            };
        });
    });
    FuseBox.expose([{
            'alias': 'clan-fp',
            'pkg': 'clan-fp/index.js'
        }]);
    FuseBox.main('clan-fp/index.js');
})();
FuseBox.pkg("clan-fp", {}, function(___scope___){
___scope___.file("build/index.js", function(exports, require, module, __filename, __dirname){ 

module.exports = require("clan-fp/index.js")
});
return ___scope___.entry = "build/index.js";
});
FuseBox.expose([{"alias":"batchql","pkg":"batchql/index.js"}]);
FuseBox.main("batchql/index.js");
})
(function(e){var r="undefined"!=typeof window&&window.navigator;r&&(window.global=window),e=r&&"undefined"==typeof __fbx__dnm__?e:module.exports;var t=r?window.__fsbx__=window.__fsbx__||{}:global.$fsbx=global.$fsbx||{};r||(global.require=require);var n=t.p=t.p||{},i=t.e=t.e||{},o=function(e){if(/^([@a-z].*)$/.test(e)){if("@"===e[0]){var r=e.split("/"),t=r.splice(2,r.length).join("/");return[r[0]+"/"+r[1],t||void 0]}return e.split(/\/(.+)?/)}},a=function(e){return e.substring(0,e.lastIndexOf("/"))||"./"},f=function(){for(var e=[],r=0;r<arguments.length;r++)e[r]=arguments[r];for(var t=[],n=0,i=arguments.length;n<i;n++)t=t.concat(arguments[n].split("/"));for(var o=[],n=0,i=t.length;n<i;n++){var a=t[n];a&&"."!==a&&(".."===a?o.pop():o.push(a))}return""===t[0]&&o.unshift(""),o.join("/")||(o.length?"/":".")},s=function(e){var r=e.match(/\.(\w{1,})$/);if(r){var t=r[1];return t?e:e+".js"}return e+".js"},u=function(e){if(r){var t,n=document,i=n.getElementsByTagName("head")[0];/\.css$/.test(e)?(t=n.createElement("link"),t.rel="stylesheet",t.type="text/css",t.href=e):(t=n.createElement("script"),t.type="text/javascript",t.src=e,t.async=!0),i.insertBefore(t,i.firstChild)}},l=function(e,t){var i=t.path||"./",a=t.pkg||"default",u=o(e);u&&(i="./",a=u[0],t.v&&t.v[a]&&(a=a+"@"+t.v[a]),e=u[1]),/^~/.test(e)&&(e=e.slice(2,e.length),i="./");var l=n[a];if(!l){if(r)throw'Package was not found "'+a+'"';return{serverReference:require(a)}}e||(e="./"+l.s.entry);var v,c=f(i,e),d=s(c),p=l.f[d];return!p&&/\*/.test(d)&&(v=d),p||v||(d=f(c,"/","index.js"),p=l.f[d],p||(d=c+".js",p=l.f[d]),p||(p=l.f[c+".jsx"])),{file:p,wildcard:v,pkgName:a,versions:l.v,filePath:c,validPath:d}},v=function(e,t){if(!r)return t(/\.(js|json)$/.test(e)?global.require(e):"");var n;n=new XMLHttpRequest,n.onreadystatechange=function(){if(4==n.readyState)if(200==n.status){var r=n.getResponseHeader("Content-Type"),i=n.responseText;/json/.test(r)?i="module.exports = "+i:/javascript/.test(r)||(i="module.exports = "+JSON.stringify(i));var o=f("./",e);p.dynamic(o,i),t(p.import(e,{}))}else console.error(e+" was not found upon request"),t(void 0)},n.open("GET",e,!0),n.send()},c=function(e,r){var t=i[e];if(t)for(var n in t){var o=t[n].apply(null,r);if(o===!1)return!1}},d=function(e,t){if(void 0===t&&(t={}),/^(http(s)?:|\/\/)/.test(e))return u(e);var i=l(e,t);if(i.serverReference)return i.serverReference;var o=i.file;if(i.wildcard){var f=new RegExp(i.wildcard.replace(/\*/g,"@").replace(/[.?*+^$[\]\\(){}|-]/g,"\\$&").replace(/@/g,"[a-z0-9$_-]+")),s=n[i.pkgName];if(s){var p={};for(var m in s.f)f.test(m)&&(p[m]=d(i.pkgName+"/"+m));return p}}if(!o){var g="function"==typeof t,h=c("async",[e,t]);if(h===!1)return;return v(e,function(e){if(g)return t(e)})}var _=i.validPath,x=i.pkgName;if(o.locals&&o.locals.module)return o.locals.module.exports;var w=o.locals={},b=a(_);w.exports={},w.module={exports:w.exports},w.require=function(e,r){return d(e,{pkg:x,path:b,v:i.versions})},w.require.main={filename:r?"./":global.require.main.filename,paths:r?[]:global.require.main.paths};var y=[w.module.exports,w.require,w.module,_,b,x];c("before-import",y);var k=o.fn;return k(w.module.exports,w.require,w.module,_,b,x),c("after-import",y),w.module.exports},p=function(){function t(){}return t.global=function(e,t){var n=r?window:global;return void 0===t?n[e]:void(n[e]=t)},t.import=function(e,r){return d(e,r)},t.on=function(e,r){i[e]=i[e]||[],i[e].push(r)},t.exists=function(e){var r=l(e,{});return void 0!==r.file},t.remove=function(e){var r=l(e,{}),t=n[r.pkgName];t&&t.f[r.validPath]&&delete t.f[r.validPath]},t.main=function(e){return this.mainFile=e,t.import(e,{})},t.expose=function(r){for(var t in r){var n=r[t],i=d(n.pkg);e[n.alias]=i}},t.dynamic=function(){for(var r=[],t=0;t<arguments.length;t++)r[t]=arguments[t];var n,i,o="default";2===r.length?(n=r[0],i=r[1],r):(o=r[0],n=r[1],i=r[2],r),this.pkg(o,{},function(r){r.file(n,function(r,t,n,o,a){var f=new Function("__fbx__dnm__","exports","require","module","__filename","__dirname","__root__",i);f(!0,r,t,n,o,a,e)})})},t.flush=function(e){var r=n.default;if(e)return void(r.f[e]&&delete r.f[e].locals);for(var t in r.f){var i=r.f[t];delete i.locals}},t.pkg=function(e,r,t){if(n[e])return t(n[e].s);var i=n[e]={},o=i.f={};i.v=r;var a=i.s={file:function(e,r){o[e]={fn:r}}};return t(a)},t}();return p.packages=n,p.isBrowser=void 0!==r,p.isServer=!r,e.FuseBox=p}(this))
//# sourceMappingURL=index.js.map