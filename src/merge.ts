//////////////////////////////////
// query generation
//////////////////////////////////
import {flatten, first, groupBy, joinBy, only, selectMany} from './utils'

// one function to bring them all and in the darkness bind them
const merge = (...asts) => {
    let ops = groupBy(flatten(asts), x => x.type)
    
    let queries = 
        joinBy(
            ops.query || [], 
            x => only(x, 'type', 'name', 'opArgList'),
            items => 
                joinBy(
                    selectMany(selectMany(items, x => x.children), x => x.items),
                    x => only(x, 'alias', 'type', 'value', 'filterArgs'),
                    items => 
                        joinBy(
                            selectMany(items, x => x.fields.items),
                            x => ({...x})
                        ),
                    'fields'));
    
    (ops.fragmentDefinition || [])
        .reduce((acc,fragment) => {
            let key = fragment.name+'::'+fragment.target
            if(acc[key] !== undefined)
                throw new Error(`Multiple fragments named ${fragment.name} defined on ${fragment.target}`)

            return {...acc, [key]: 1}
        }, {})
        
    return [...(ops.fragmentDefinition || []), ...queries]
}

export default merge