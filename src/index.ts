import {obs} from 'clan-fp'

const parse = (_q, i) => {
    const [query, fragments] = removeFragments(_q)
    	, name = /^\s*(query|mutation)\s*(\w+)\s*(\([^)]+\))?\s*/ig
    	, ws = /\s+/ig
    	, comment = /(#|\/\/)(.*)$/igm
    	, q = query.replace(comment, '').replace(name, '').replace(ws, ' ').trim()
    	, sig = name.exec(query.trim())
    	, unwrapped = q.slice(1, q.lastIndexOf('}')).trim()

    if(sig && sig[1] === 'mutation')
        throw 'Mutations cannot be batched, and must be submitted as a regular GraphQL request'

    if(sig){
    	let [s, type, name, args] = sig
        return {
            args: parseArgs(args)
            , query: parseSelections(unwrapped)
            , fragments
        }
    } else {
        return { query: parseSelections(unwrapped), fragments }
    }
}

const removeFragments = query => {
	let r
		, fragments = []

	while((r = /\bfragment\b/ig.exec(query))) {

		let start = r.index
			, end = start
			, matched = false
			, stack = 0

		while(start < query.length && !matched){
			end++
			query[end] === '{' && ++stack
			query[end] === '}' && --stack === 0 && (matched = true)
		}

		if(matched){
			let f = query.slice(start, end+1)
			fragments.push(f)
			query = query.replace(f, '')
		}
	}

	return [query, fragments.join('\n\n')]
}

const parseArgs = args => {
	return args
    	.slice(1, args.length-1)
        .replace(/\s+/, '')
    	.split(',')
        .map(kvp => {
        	let [name,type] = kvp.split(':')
            return {name, type}
        })
}

const getNextBracketPairing = ss => {
    let parens = /\([^:]+:[^)]+\)/ig.exec(ss)
    	, args = parens && parens.index < ss.indexOf('{') ? parens : ''
        , selection = args ? ss.replace(args[0], '') : ss
    	, start = selection.indexOf('{')
    	, end = start+1
    	, matched = false
    	, nested = 0

    while(!matched && end < selection.length){
        ++end
        let c = selection[end]
        if(c === '{') ++nested
        else if(c === '}') {
            if(nested > 0) --nested
            else matched = true
        }
    }

    let sig = selection.slice(0, start).trim()
    	, colon = sig.indexOf(':')
        , ref = colon !== -1
    		? sig.slice(0, colon)
            : sig
    	, name = colon !== -1
    		? sig.slice(colon+1)
    		: sig
        , result = [
            {
                ref
                , args: args && args[0]
                , body: selection.slice(start, end+1).trim()
                , name: name.trim()
            }
            , selection.slice(end+1).trim()
        ]

    return result
}

const parseSelections = (selections) => {
    let r = []
    while(selections.length !== 0){
        let [selection, next] = getNextBracketPairing(selections)
        selections = next
        r.push(selection)
    }
    return r
}

const batch = q => {
    let r =
        q
        .map(parse)
    	.reduce((acc,x,i) => {
    		let rmap = {}
    		x.fragments && (acc.fragments += '\n\n'+x.fragments)
            x.args && x.args.map(({name,type}) => {
				acc.args = `${name}:${type}`
            })
            x.query.map(({ref,args,body,name}) => {
            	rmap[ref+i] = ref
                acc.query += `\n\t${ref}${i}: ${name}${args || ''} ${body}\n`
            })
            acc.rmaps.push(rmap)
            return acc
        }, {query:'', args:'', fragments:'', rmaps:[]})

    let batchedQuery = `${r.fragments}\n\nquery batchedQuery ${r.args ? `(${r.args})` : ''} {\n${r.query}\n}`
    return {q:batchedQuery, rmaps: r.rmaps}
}

export const f = (url, query, args) =>
	fetch(
		url
		, { method: 'POST', body: JSON.stringify({ query, variables: args }) })
	.then(r => r.json())

export const mux = (getter, wait=60, max_buffer=8) => {
	const queries = obs() // source queries
		, callbacks = obs() // source callbacks
		, cbs = callbacks // sink callbacks
			.reduce((acc,x) => x === false ? [] : acc.concat([x]), [])
		, payload = queries // sink queries
			.reduce((acc, val) => val === false ? [] : acc.concat([val]), [])
		, append = ({ query='', args={} }) => {
			// console.log(tag`${query}`)
			queries({query, args}) // append new query
			return payload().length - 1
		}
		, parseQueryReg = q => {
			let t = /(\{|[^{])/.exec(q)
			if(t && t[0] === '{')
				return q.slice(q.indexOf('{')+1, q.lastIndexOf('}'))

			return q
		}
		, send = debounce(
			$ => {
				let q = payload()
					, c = cbs()

				callbacks(false) // reset callbacks
				queries(false) // reset query data

				let {q:query, rmaps} = batch(q.map(x => x.query))
					, args = q.reduce((acc,x) => Object.assign(acc, x.args), {})

				getter(query, args)
					.then(data => {
						if(data.errors)
							return console.error(data.errors)

						rmaps
						.map((rmap,i) => {
							let d = Object.keys(rmap)
								.reduce((acc,key) => {
									// rmap[user0] -> user
									// { user: ... } <-- { user0: {...} }
									acc[rmap[key]] = data.data[key]
									return acc
								}, {})

							c[i]({data:d}) // pipe demuxed data back into callbacks
						})
					})
			}
			, wait)
		, queue = cb => {
			callbacks(cb) // append callback
			send() // send will execute once every 60ms
		}

	return (query, args) => {
		let index = append({query, args})
		return new Promise(res =>
			queue(d => res(d)))
	}
}

export default mux