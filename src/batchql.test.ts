
// tests

const queries = [
	`query Person($id: ID!){

		person(id: $id){
	        name
	        email
	        createdAt
	        updatedAt
			siblings { name }
		}

	}`,
	`query Person($id: ID!){

		person(id: $id){
	        name
	        email
	        createdAt
	        updatedAt
			parents
		}

	}`
]

import { should } from "fuse-test-runner";
import { batch, fetcher, mux } from "./batchql"
import parseProgram from "./combinators"
import regenerate from "./regenerate"

export class Test {
	timeout: 5000;

    "should mux queries and args together"() {
		const mock = (query, args) => 
			new Promise(res =>
				setTimeout(() => res({query, args})), 1) // echo back the query and args

		const f = mux(mock)

		should(f(queries[0]))
		.bePromise()
		.beOkay()
		.mutate(x => 
			x.then(d => should(d).beOkay()))

		should(f(queries[1]))
		.bePromise()
		.beOkay()
		.mutate(x => x.then(d => console.log(d)))
	}
}