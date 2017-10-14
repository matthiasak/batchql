
// tests
import {queries} from "./test-data"
import { should } from "fuse-test-runner"
import { batch, fetcher, mux } from "./batchql"
import parseProgram from "./combinators"
import regenerate from "./regenerate"

export class Test {
	timeout: 5000;

    "should mux queries and args together"() {
		
		// echo back the query and args
		const mock = (query, args) => 
			new Promise(res => 
				setTimeout(() => res({query, args})), 0)
		
		const f = mux(mock)
		
		queries
		.map(q => 
			should(f(q, {id: Math.random()}))
			.bePromise()
			.beOkay())
	}
}