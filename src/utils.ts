/////////////////////////
// utilities
/////////////////////////

export const first = (arr, fn) => {
    for(let i = 0, n = arr.length; i<n; i++) {
        if(fn(arr[i], i)) return arr[i]
    }
}

export const flatten = (arr) => 
	arr.reduce((acc, x) => [...acc, ...x], [])

export const groupBy = (arr, fn) => 
	arr.reduce((acc, x, i) => {
    	let key = fn(x, i)
        acc[key] = acc[key] !== undefined ? acc[key].concat(x) : [x]
        return acc
    }, {})

export const hash = (v,_v= v === undefined ? 'undefined' : JSON.stringify(v)) => {
    let hash = 0
    for (let i = 0, len = _v.length; i < len; ++i) {
        const c = _v.charCodeAt(i)
        hash = (((hash << 5) - hash) + c) | 0
    }
    return hash
}

export const ordered = obj => 
	Object
	.keys(obj)
	.sort()
	.reduce((acc,key) => ({
        ...acc, 
        [key]: obj[key] instanceof Object ? ordered(obj[key]) : obj[key]
    }), {})

export const ohash = obj => hash(ordered(obj))

export const selectMany = (arr, fn) =>
	arr.reduce((acc,x) => acc.concat(fn(x)), [])

export const joinBy = (
    arr, 
    rootProps = x => x,
    mapGroupedChildren = x => undefined,
    childrenKey = 'children'
) => {
    let g = groupBy(arr, x => ohash(rootProps(x)))
    return Object
        .keys(g)
        .reduce((acc,key) => {
        	let items = g[key],
                first = rootProps(items[0]),
                m = mapGroupedChildren(items)
            
            if(m !== undefined) first[childrenKey] = m
            return acc.concat(first)
        }, [])
}

export const only = (obj, ...keys) => keys.reduce((acc,key) => ({...acc, [key]: obj[key]}), {})
