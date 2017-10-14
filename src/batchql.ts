import {obs} from 'clan-fp'
import merge from './merge'
import regenerate from './regenerate'
import parseProgram from './combinators'

export const batch = (...programs) => {
    const asts = programs.map(parseProgram),
        {
            mergedQuery,
            extractionMaps,
            queryVariableRenames
        } = merge(...asts)
    
    return { 
        mergedQuery: regenerate(mergedQuery), 
        extractionMaps, 
        queryVariableRenames 
    }
}

export const fetcher = (url) => (query, args) =>
    fetch(url, { method: 'POST', body: JSON.stringify({ query, variables: args }) })
    .then(r => r.json())
    
const appendOrClear = (acc,x) => {
    if(x === false) return []
    acc.push(x)
    return acc
}

const applyQueryVarRenames = (varMap, renameMap) =>
    Object
    .keys(varMap)
    .reduce((acc,key) => {
        acc[key in renameMap ? renameMap[key] : key] = varMap[key]
        return acc
    }, {})

const applyExtractionMap = (data, extractionMap) => 
    Object
    .keys(extractionMap)
    .reduce(
        (acc,key) => {
            const dataTarget = data[key]
            if(dataTarget instanceof Array){
                acc[key] = 
                    dataTarget
                    .map(item => applyExtractionMap(item, extractionMap[key]))
            } else if(dataTarget instanceof Object){
                acc[key] = applyExtractionMap(dataTarget,extractionMap[key])
            } else if(dataTarget !== undefined){
                acc[key] = dataTarget
            }
            return acc
        },
        {})

export const mux = (getter=fetcher, wait=60) => {
    const $queries = obs(),
        $callbacks = obs(),
        $data = obs(),
        responses = $callbacks.reduce(appendOrClear, []),
        payload = $queries.reduce(appendOrClear, []),
        append = ({ query='', args={} }) => $queries({query, args}),
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

        let {mergedQuery, queryVariableRenames, extractionMaps} = batch(...$q),
            batchedArgs = 
                $a.reduce((acc, x, i) => 
                    Object.assign(acc, applyQueryVarRenames(x, queryVariableRenames[i])), 
                    {})

        getter(mergedQuery, batchedArgs)
        .then(data => 
            $c.map((fn, i) => 
                fn(applyExtractionMap(data, extractionMaps[i]))))
    })

    return (query, args) => {
        append({query, args})
        return new Promise(res => queue(d => res(d)))
    }
}

export default mux