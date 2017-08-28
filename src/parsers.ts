/////////////////////////
// Base functions / parsers + combinators
/////////////////////////

// returns a function that takes a string which parses 
// the string according to a regexp or pattern, declaring the type of token
export const token = (t, type, d=0, o='igm', mod=x=>x) => {
    let m = s => {
        let r = 
            t instanceof RegExp 
                ? t 
                : new RegExp('^'+t, o)
            , results = r.exec(s)

        if(!results || results.length <= d) 
            throw new Error(`Expected: '''${t}'''\nActual: '''${s}'''`)

        return mod({
            remaining: s.slice(results[d].length)
            , matched: results[d]
            , ast: {type: type || t+'', value: results[d]}
        })
    }
    
    return m
}

export const ignore = (...args) => {
    let nArgs = args
    nArgs[4] = x => ({...x, ignore: true})
    return token(...nArgs)
}

const ws = ignore('\\s*')

export const interleave = (splitter, tokenizers) =>
    new Array(tokenizers.length)
        .fill(true)
    	.reduce((acc, x, i) => acc.concat([splitter, tokenizers[i]]), [])
		.concat([splitter])

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
            errors.push(e)
        }
    }
    throw new Error(`Either(...): ${s}\n\n${errors.map(e => '::->\n'+e+'').join('\n')}`)
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
        , error

    try {
        while((current = tokenizer(acc.remaining))){
            let {remaining, matched, ast, ignore} = current
            if(remaining === acc.remaining) throw `Inf. loop in readN sequence.`
            if(!ignore && ast) acc.ast.push(ast)
            acc.remaining = remaining
            acc.matched += matched
            count++
        }
    } catch(e) { error = e }

    if(count < n) throw new Error(`Expected ${n}+ occurrences, but only have ${count}. Sub error:\n---\n${error}`)

    return acc
}