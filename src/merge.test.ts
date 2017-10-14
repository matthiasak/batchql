
// tests

import {queries} from "./test-data"
import { should } from "fuse-test-runner"
import { batch, fetcher, mux } from "./batchql"
import parseProgram from "./combinators"
import regenerate from "./regenerate"

export class Test {
	timeout: 5000;

    "shouldParsePrograms()"() {
        should(batch(...queries))
        .beOkay()
	}

	"shouldBatchAndResolve()"() {
		// echo back the query and args
		const mock = (query, args) => new Promise((res, rej) => res({query, args}))
		const f = mux(mock, 0)

		queries
		.map(q => 
			should(f(q, {id: Math.random()}))
			.bePromise()
			.beOkay())

	}
}