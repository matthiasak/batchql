//////////////////////////////////
// query generation
//////////////////////////////////
import {flatten, first, groupBy, joinBy, only, selectMany} from './utils'

const generateOpArgList = args => {
    if(!args || args.length === 0) return ''
    return '(' + args.map(a => `${a.name}: ${a.type}`).join(', ') + ')'
}

const generateValue = (value, type) => {
    if(type === undefined) return 'undefined'
    if(type === null) return 'null'
    if(type === 'number') return value
    if(type === 'boolean') return value ? 'true' : 'false'
    if(type === 'variableName') return value

    if(type === 'arg')
        return '{' +
            value.map(v => `${v.name}:${generateValue(v.value, v.valueType)}`).join(', ') +
        '}'

    return `"${value}"`
}

const generateFilterArgs = args => {
    if(!args || args.length === 0) return ''

    return '(' +
        args
        .map(({name, value, valueType}) => {
        	return `${name}: ${generateValue(value, valueType)}`
    	})
        .join(', ') +
        ')'
}

const generateFields = args => {
    if(!args || args.length === 0) return ''

    return '{' +
        args
        .map(x => {
        	let {type, value, filterArgs, fields} = x
        	if(type === 'field') return generateSelectionSet([x])
        	if(type === 'name') return value
    	})
        .join(' ') +
    '}'
}

const generateSelectionSet = set => {
    if(!set || set.length === 0) return '{}'
    return set
        .map(({value, filterArgs, fields, alias, items}) => {
        	return (alias ? `${alias} : ` : '') +
                value +
                (
                    items ?
                	    generateFields(items) :
                	    (
                            generateFilterArgs(filterArgs) +
                            generateFields(fields instanceof Array ? fields : (fields && fields.items))
                        )
                )
    	})
    	.join(' ')
}

const generateQuery = ({type, name, opArgList, children}) =>
    `${type} ${name || ''} ${generateOpArgList(opArgList)} ${generateFields(children)}`

const generateFragment = ({name, target, children:child}) =>
    `fragment ${name} on ${target} ${generateFields(child.items)}`

const regenerate = ast =>
	ast.reduce((acc,q) => {
        switch(q.type) {
            case "query": return acc + generateQuery(q) + '\n';
            case "fragmentDefinition": return acc + generateFragment(q) + '\n';
            default: throw new Error(`Unknown operation: "${q.type}"`)
        }
    }, '')

export default regenerate