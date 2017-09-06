
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
    "shouldParsePrograms()"() {
        should(batch(...queries))
        .beOkay()
        // .equal('')
	}

	"shouldBatchAndResolve()"() {
		const mock = (query, args) => 
			new Promise((res, rej) =>
				setTimeout(() => 
					res({query, args}), 500)) // echo back the query and args

		const f = mux(mock)

		should(f(queries[0]))
		.bePromise()
		.beOkay()

		should(f(queries[1]))
		.bePromise()
		.beOkay()
	}
}