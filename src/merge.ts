//////////////////////////////////
// query generation
//////////////////////////////////
import {flatten, first, groupBy, joinBy, only, selectMany, ohash} from './utils'

const findNameConflicts = (query, _q = query || []) => 
    _q
    .reduce((acc,q,i) => {

        (q.opArgList || [])
        .map(o => o.name.slice(1))
        .map(varName => {
            acc.counts[varName] = (acc.counts[varName] || 0) + 1
            if(acc.counts[varName] > 1){
                acc.renames[i][varName] = `${varName}_${i}`
            }
        })

        return acc
    }, {
        counts: {},
        renames: new Array(_q.length).fill(1).map(x => ({}))
    })
    .renames

const applyVariableRenames = (queries, varRenames = findNameConflicts(queries)) => {
    varRenames
    .map((renames, i) => {
        const target = queries[i]

        Object
        .keys(renames)
        .map(oldName => {
            const newName = renames[oldName]
            applyOpArgListRenames(target.opArgList, oldName, newName)
            applySelectionSetRenames(
                ((target.children || []) instanceof Array ? target.children : [target.children])
                    .filter(child => child.type === 'selectionSet' && child.items !== undefined)
                    .reduce((acc, child) => [...acc, ...child.items], []),
                oldName, 
                newName
            )
        })
    })

    return varRenames
}

const applyOpArgListRenames = (opArgList, oldName, newName) =>
    (opArgList || [])
    .filter(arg => arg.name === '$'+oldName)
    .map(arg => arg.name = '$'+newName)

const applySelectionSetRenames = (children, oldName, newName) =>
    (children || [])
    .filter(field => field.type === 'field' && field.fields !== undefined)
    .map(field => {
        applyFilterArgListRenames(field.filterArgs || [], oldName, newName)
        applySelectionSetRenames(field.fields.items, oldName, newName)
    })

const applyFilterArgListRenames = (filterArgList, oldName, newName) => {
    filterArgList
    .filter(f => f.valueType === 'arg' && f.value !== undefined)
    .map(f => applyNestedArgRename(f, oldName, newName))

    filterArgList
    .filter(f => f.value === '$'+oldName)
    .map(f => f.value = '$'+newName)
}

const applyNestedArgRename = (nestedArg, oldName, newName) => {
    if(nestedArg.value instanceof Array){
        nestedArg
        .value
        .map(val => applyNestedArgRename(val, oldName, newName))
    }

    if(nestedArg.value === '$'+oldName) nestedArg.value = '$'+newName
}

/**
 * 1. build extraction map for first query
 * 2. build 2nd extraction map, looking at first map
 * 3. build 3rd extraction map, looking at first two maps
 * etc...
*/
const buildExtractionMap = (fields, fieldsFromOtherQueries) => 
    fields
    .reduce((acc, f) => {
        let key = f.alias || f.value,
            resultKey = key
        const filterArgHash = ohash(f.filterArgs)
            
        f.__visited = true

        const similarlyNamedVisitedFieldsWithDiffFilterArgs = 
            fields
            .concat(flatten(fieldsFromOtherQueries))
            .filter(f2 => 
                (f2.__visited === true) && 
                (f2 !== f) && 
                (f2.alias || f2.value) === key &&
                ohash(f2.filterArgs) !== filterArgHash)
        
        if(similarlyNamedVisitedFieldsWithDiffFilterArgs.length >= 1){
            f.alias = `${key}_${similarlyNamedVisitedFieldsWithDiffFilterArgs.length}`
            resultKey = `${key}_${similarlyNamedVisitedFieldsWithDiffFilterArgs.length}::${key}`
        }
            
        acc[resultKey] = 
            (f.fields !== undefined) ? 
            buildExtractionMap(f.fields.items, similarlyNamedVisitedFieldsWithDiffFilterArgs) :
            null

        return acc
    }, {})

const applyAliasingToCollidingFieldNames = (queries=[]) =>
    queries
    .map(q => q.children[0].items)
    .map((g, i, arr) => buildExtractionMap(g, arr.slice(0,i)))

// one function to bring them all and in the darkness bind them
const merge = (...asts) => {
    let entries = flatten(asts),
        groupedOpsByType = groupBy(entries, x => x.type)
    
    if(groupedOpsByType.mutation || groupedOpsByType.subscription) 
        throw new Error(`Mutations and Subscriptions currently not supported with BatchQL.`)

    let queryVariableRenames = applyVariableRenames(entries), // cascade variable renames
        extractionMaps = applyAliasingToCollidingFieldNames(groupedOpsByType.query)

    let mergedQuery =
        (groupedOpsByType.query || [])
        .reduce((acc,q) => {
            acc.opArgList.push(...q.opArgList)
            acc.children.push(...q.children)
            return acc
        }, {
            type: 'query',
            name: 'BATCHEDQUERY',
            opArgList: [],
            children: []
        })

    mergedQuery.children = 
        joinBy(
            selectMany(mergedQuery.children, x => x.items),
            x => only(x, 'alias', 'type', 'value', 'filterArgs'),
            items =>
                joinBy(
                    selectMany(items, x => x.fields.items),
                    x => ({...x})
                ),
            'fields')
    
    ;(groupedOpsByType.fragmentDefinition || [])
        .reduce((acc,fragment) => {
            let key = fragment.name+'::'+fragment.target
            if(acc[key] !== undefined)
                throw new Error(`Multiple fragments named ${fragment.name} defined on ${fragment.target}`)

            return {...acc, [key]: 1}
        }, {})

    return {
        mergedQuery: [...(groupedOpsByType.fragmentDefinition || []), ...mergedQuery],
        queryVariableRenames,
        extractionMaps
    }
}

export default merge