/////////////////////////
// tokenizers
/////////////////////////

import {flatten, first} from './utils'
import {token, ignore, interleave, sequence, either, maybe, readN} from './parsers'

const opType = either(token('query', 'opType'), token('mutation', 'opType'), token('subscription', 'opType'))
const name = token(/^[a-z][a-z0-9_]*/i, 'name') //const name = token('\\w+', 'name')
const alias = token(/^[a-z][a-z0-9_]*/i, 'alias')
const variableName = token('\\$\\w+', 'variableName')
const scalarType = token(/^[\-_a-z]+\!?/i, 'type')
const typeClass =
	either(
        sequence(token(/^\[/), scalarType, token(/^\]/), maybe(token(/^\!/)))),
        scalarType
    )

// opArgList ($arg1: type, $arg2: type!, ...)
const opArgListFn =
	sequence(
        ignore('\\('),
        readN(
            1,
            sequence(
                variableName,
                ignore(':'),
                typeClass,
                maybe(ignore(','))
            )),
        ignore('\\)'))

const opArgList = s => {
    let v = opArgListFn(s)
    
    v.ast = {
        type: 'opArgList',
        value:
            flatten(v.ast)
            .map(([a,b]) => 
                ({
                    name: a.value, 
                    type:
                        b instanceof Array ? 
                        b.map(_ => _.value).join('') 
                        : b.value
                }))
	}
    
    return v
}

const value =
    either(
        s => {
            let x = sequence(ignore('\\.{3}'), name)(s)
            x.ast = { value: x.ast[0].value, type: 'fragmentExpansion' }
            return x
        },
        token(/^\d+(\.\d+)?/, 'number'),
        s => {
            let x = sequence(ignore('"'), token('[^"]*', 'string'), ignore('"'))(s)
            x.ast = x.ast[0]
            return x
        },
        variableName,
        name
	)

const filterArgFn =
	either(
        sequence(
            ignore('\\{'),
            readN(
                1,
                sequence(
                    name,
                    ignore(':'),
                    s => filterArg(s),
                    maybe(ignore(','))
                )
            ),
            ignore('\\}'),
        ),
        value
    )

const filterArg = s => {
    let v = filterArgFn(s)
    if(v.ast[0] instanceof Array) v.ast = flatten(v.ast)
    return v
}

const selectionArgsFn =
	sequence(
        ignore('\\('),
        readN(0, sequence(name, ignore(':'), filterArg, maybe(ignore(',')))),
        ignore('\\)')
    )

const selectionArgs = s => {
    let v = selectionArgsFn(s)

    const prep = ([a,b]) => 
        ({
            type: 'arg', 
            name: a.value, 
            valueType: b instanceof Array ? 'arg' : b.type, 
            value: b instanceof Array ? b.map(prep) : b.value
        })
    
    v.ast = flatten(v.ast).map(prep)
    
    return v
}

const fragmentExpansionFn = sequence(ignore(/^\.\.\./), name)
const fragmentExpansion = s => {
    let v = fragmentExpansionFn(s)
    
    v.ast = { 
        type: 'fragmentExpansion',
        value: v.ast[1].value
    }
    
    return v
}

const intoSelection = arr => {
    if(!(arr instanceof Array)){ 
        return arr // not a subquery
    }
    
    let hasAlias = first(arr, x => x.type === 'alias'),
        hasName = first(arr, x => x.type === 'name'),
        numItems = 
        	[hasAlias, hasName]
    		.reduce((acc,x) => acc + (x && 1 || 0), 0),
        rest = arr.slice(numItems)
    
    return {
        alias: hasAlias && hasAlias.value,
        type: 'field',
        value: hasName && hasName.value,
        filterArgs: rest.length === 2 && rest[0],
        fields: rest[rest.length === 2 ? 1 : 0]
    }
}

const selectionSetFn =
	sequence(
        ignore('\\{'),
        readN(
            1,
            sequence(
                either(
                    sequence(alias, ignore(':'), name, selectionArgs, s => selectionSet(s)),
                    sequence(name, selectionArgs, s => selectionSet(s)),
                    sequence(name, s => selectionSet(s)),
                    fragmentExpansion,
                    name
                ),
                maybe(ignore(','))
            )
        ),
        ignore('\\}'))

const selectionSet = s => {
	let v = selectionSetFn(s),
        parts = flatten(flatten(v.ast))
    
    v.ast = {
        type: 'selectionSet',
        items: parts.map(intoSelection)
    }
    
    return v
}

const statementFn = sequence(maybe(opType), maybe(name), maybe(opArgList), selectionSet)
const statement = s => {
    
    let v = statementFn(s)
    
    let hasOptype = first(v.ast, (x,i) => x.type === 'opType'),
        hasQueryName = first(v.ast, (x,i) => x.type === 'name'),
        hasOpArgList = first(v.ast, (x,i) => x.type === 'opArgList'),
        numItems = 
        	[hasOptype, hasQueryName, hasOpArgList]
    		.reduce((acc,x) => acc + (x && 1 || 0), 0)
    
    v.ast = {
        type: hasOptype && hasOptype.value || 'query',
        name: hasQueryName && hasQueryName.value || 'DEFAULTNAME',
        opArgList: hasOpArgList && hasOpArgList.value,
        children: v.ast.slice(numItems)
    }
    
    return v
}

const fragmentFn = sequence(token('fragment'), name, ignore('on'), name, selectionSet)
const fragment = s => {
    let v = fragmentFn(s)
    
    v.ast = {
        type: 'fragmentDefinition',
        name: v.ast[1].value,
        target: v.ast[2].value,
        children: v.ast[3]
    }
    
    return v
}

const parseProgramFn = readN(1, either(statement,fragment))
const removeComments = s => s.replace(/#[^\n\r]*[\n\r]/igm, '')
const removeWhitespace = s => s.replace(/\s+/igm, ' ')
const parseProgram = s => {
    let {remaining, matched, ast} = parseProgramFn(removeWhitespace(removeComments(s)))
    
    if(remaining !== '') 
        throw new Error(`remaining, unparsed snippet of graphQL query:\n\n${remaining}`)
    
    return ast
}

export default parseProgram