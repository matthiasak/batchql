const {mux, batch, fetcher, debug} = require('./batchql')
debug(true)

const f = mux(
    fetcher('https://api.graph.cool/simple/v1/FF'),
    100
)
const log = (...args) => console.log(...args)
console.clear()

// f(`query test ($id: ID!, $name: String!) { allFiles { name } }`)
// .then(d => log(d))

// f(`{ 
//     allFiles { name contentType } 
//     allUsers { name id _ordersMeta { count }}
// }`)
// .then(d => log(d))

// f(`query test($x: [String!]!, $y: [ID!]){
//     allUsers(filter: {name_in: $x, id_in: $y}) {
//         name
//         id
//     }
// }`, {x: ["Matt"], y: [1] })
// .then(d => log(d))

const repeat = (f,n) => 
    Array(n)
    .fill(true)
    .map(x => f())

repeat(
    () => 
        f(`query getFile($url: String!){ allFiles(url: $url){ name contentType } }`)
        .then(d => log(d)),
    3)