import {obs} from 'clan-fp'

import merge from './merge'
import regenerate from './regenerate'
import parseProgram from './combinators'

export const batch = (...programs) => {
    const asts = programs.map(parseProgram),
        combined = merge(...asts)

    return regenerate(combined)
}

export const fetcher = (url) => (query, args) =>
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
        
        send = obs(),
    
        queue = cb => {
            $callbacks(cb)
            send(true)
        }


    send
    .debounce(wait)
    .then(() => {
        let data = payload(),
            $q = data.map(x => x.query),
            $a = data.map(x => x.args),
            $c = responses()
        
        // clear
        $queries(false)
        $callbacks(false)

        let batchedQuery = batch(...$q),
            batchedArgs = $a.reduce((acc,x) => Object.assign(acc, x), {})

        getter(batchedQuery, batchedArgs)
        .then(data => 
            $c.map(fn => fn(data)))
    })

    return (query, args) => {
        append({query, args})
        return new Promise(res => queue(d => res(d)))
    }
}

export default mux