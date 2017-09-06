
// tests

const q1 = `
query Person($id: ID!){
	person(id: $id){
        name
        email
        createdAt
        updatedAt
		siblings { name }
	}
}
`

const q2 = `
query Person($id: ID!){
	person(id: $id){
        name
        email
        createdAt
        updatedAt
		parents
	}
	everyone: allPeople(email: "@gmail.com", limit: 5){
		name
		email
	}
}
`

const q21 = `
query Person($id: ID!){
	everyone: allPeople(email: "@gmail.com", limit: 5){
		name
		email
	}
}
`

const q3 = `
query Person($id: ID!){
	person(email: $email){
        email
        createdAt
        updatedAt
    }
}
`

const q4 = `
query Person($id: ID!, $startsWith: String){
	allPeople(email: "@gmail.com", limit: 5, age: { parents: {minAge: 50, maxAge: 65}, siblings: {minAge: 30}}){
		name
		email
	}
}
`

const q41 = `
query Person($id: ID!){
	person(email: $email){
        email
        createdAt
        updatedAt
    }
}

fragment nestedEdge on Person { id name }
fragment blah on Person { test }
`

const q42 = `
query someQueryName($id: ID!){
    subqueryName: def(arg1: "a", arg2: $id, name: 5){
        id 
		name 
		...nestedEdge
    }
}

fragment nestedEdge on Person { id name }

fragment blah on Person { test }
`

// let ast = mergeOps(...[q41].map(parseProgram)), //q1,q2,q3,q4
//     mergedQuery = regenerate(ast)

// log(mergedQuery, '', '===========', '')
// jsonlog(ast)

import { should } from "fuse-test-runner";
import { batch, fetcher, mux } from "./batchql"
import parseProgram from "./combinators"
// import regenerate from "./regenerate"

export class Test {
    "shouldParsePrograms()"() {
        should(batch(q4, q41)).beOkay() //q42
        console.log(batch(q4, q41))

   //      console.log(
	  //       batch(
	  //       `query Person($id: ID!){
			// 	person(id: $id){
			// 		name
	  //               siblings { name }
	  //           }
			// }`, 
	  //       `query Person($id: ID!){
			// 	person(id: $id){
	  //               email
			// 		testField
			// 		testField2
	  //           }
			// }`)
	  //   )
	}

	// "shouldBatchAndResolve()"() {
	// 	const mock = (query, args) => new Promise((res, rej) => {
	// 		console.log("new query:", query, args)
	// 		res({})
	// 	})

	// 	const f = mux(mock)

	// 	should(f(q4, q41))
	// 		.bePromise()
	// 		.beOkay()
	// }
}