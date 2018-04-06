/////////////////////////
// Base functions / parsers + combinators
/////////////////////////

import {obs} from 'clan-fp'

// returns a function that takes a string which parses
// the string according to a regexp or pattern, declaring the type of token
export const token = (t, type=t+'', d=0, o='igm', mod=x=>x) => s => {
    let r = t instanceof RegExp ? t : new RegExp('^'+t, o),
        results = r.exec(s)

    if(results === null || results.length <= d)
        throw new Error(`expected: ${t}, actual: ${s}`))

    return mod({
        remaining: s.slice(results[d].length)
        , matched: results[d]
        , ast: {type: type, value: results[d]}
    })
}

export const debug = obs(false)

export const ignore = (...args) => {
    let nArgs = args
    nArgs[4] = x => ({...x, ignore: true})
    return token(...nArgs)
}

const ws = ignore('\\s*')

const zip = (a, b) => {
    let result = []
    for(var i = 0, len = Math.max(a.length, b.length); i < len; i++){
        if(a[i]) result.push(a[i])
        if(b[i]) result.push(b[i])
    }
    return result
}

export const interleave = (splitter, tokenizers) =>
    zip(new Array(tokenizers.length + 1).fill(splitter), tokenizers)

export const sequence = (...tokenizers) => s =>
    interleave(ws, tokenizers)
    .reduce((acc, fn, i) => {
        let {remaining, matched, ast, ignore} = fn(acc.remaining)
        if(!ignore && ast) acc.ast.push(ast)
        acc.remaining = remaining
        acc.matched += matched
        return acc
    }
    , {remaining:s, matched:'', ast: []})

export const either = (...tokenizers) => s => {
    let errors = []
    for(let i = 0, len = tokenizers.length; i<len; i++){
        try {
            return tokenizers[i](s)
        } catch(e) {
            errors.push(e.message)
        }
    }
    debug() && console.warn(errors)
    throw new Error(`Either failed.`)
}

export const maybe = tokenizer => s => {
    try {
        return tokenizer(s)
    } catch(e) {
        return {remaining: s, matched: '', ast: null}
    }
}

export const readN = (n, tokenizer) => s => {
    let acc = {remaining: s, matched: '', ast: []}
        , current
        , count = 0
        , errors = []

    try {
        while((current = tokenizer(acc.remaining))){
            let {remaining, matched, ast, ignore} = current
            if(remaining === acc.remaining) throw `Infinite loop detected in readN sequence.`
            if(!ignore && ast) acc.ast.push(ast)
            acc.remaining = remaining
            acc.matched += matched
            count++
        }
    } catch(e) {
        errors.push(e.message)
    }

    if(count < n) {
        debug() && console.warn(errors)
        throw new Error(`Expected ${n}+ occurrences, but only have ${count}.`)
    }

    return acc
}