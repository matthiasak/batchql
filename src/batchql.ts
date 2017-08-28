import {obs} from 'clan-fp'
const debounce = require('lodash.debounce')

import merge from './merge'
import regenerate from './regenerate'
import parseProgram from './combinators'

export const batch = (...programs) => {
    const asts = programs.map(parseProgram),
        combined = merge(...asts)

    return regenerate(combined)
}

export const f = (url, query, args) =>
    fetch(url, { method: 'POST', body: JSON.stringify({ query, variables: args }) })
    .then(r => r.json())
    
const appendOrClear = (acc,x) => {
    if(x === false) return []
    acc.push(x)
    return acc
}

export const mux = (getter, wait=100) => {
    const $queries = obs(),
        $callbacks = obs(),
        $data = obs(),

        responses = 
            $callbacks
            .reduce(appendOrClear, []),

        payload = 
            $queries
            .reduce(appendOrClear, []),

        append = 
            ({ query='', args={} }) => 
                $queries({query, args}),
        
		send = debounce($ => {
                let data = payload(),
                    $q = data.map(x => x.query),
                    $a = data.map(x => x.args),
                    $c = $callbacks()
                
                // clear
                $queries(false)
                $callbacks(false)

                let batchedQuery = batch(...$q),
                    batchedArgs = $a.reduce((acc,x) => ({...acc, ...x}), {})

				getter(batchedQuery, batchedArgs)
                .then(data => 
                    $callbacks.map(fn => fn(data)))
            }
            , wait),
            
		queue = cb => {
                $callbacks(cb)
                send()
            }

	return (query, args) => {
        append({query, args})
        return new Promise(res => queue(d => res(d)))
	}
}