import { should } from "fuse-test-runner";
import * as utils from "./utils";

export class Test {
    "flatten() should flatten an array of arrays"() {
        should(
            utils
            .flatten([[1,2,3], [4,5,6]])
        )
        .deepEqual([1,2,3,4,5,6])
    }

    "first() finds the first value in a collection matching a predicate"() {
        const list = [{a: 1}, {a: 2}, {a: 3}]

        should(
            utils.first(
                list, 
                x => x.a === 2
            )
        ).deepEqual({a: 2})
    }

    "groupBy()"() {
        const list = [{a: 1, b: 2}, {a: 1, b: 3}],
            groupedByA = utils.groupBy(list, x => x.a),
            groupedByB = utils.groupBy(list, x => x.b)

        should(groupedByA)
            .beObject()
            .deepEqual({ '1': [ { a: 1, b: 2 }, { a: 1, b: 3 } ] })
            .mutate(x => Object.keys(x).length)
            .equal(1)

        should(groupedByB)
            .beObject()
            .deepEqual({ '2': [{a:1,b:2}], '3': [{a:1,b:3}]})
            .mutate(x => Object.keys(x).length)
            .equal(2)
    }

    "hash() - should be sufficiently random and deterministic, but ordering of keys is important"() {
        should(utils.hash({})).equal(utils.hash({}))
        should(utils.hash([1,2,3])).equal(utils.hash([1,2,3]))
        should(utils.hash({a:1, b:2})).notEqual(utils.hash({b:2, a:1}))
    }

    "ohash() - ordered hash, orders all keys recursively"() {
        should(utils.ohash({a:1, b:2})).equal(utils.ohash({b:2, a:1}))
    }

    "selectMany()"() {
        should(utils.selectMany([[1,2,3], [4,5,6], [7,8,9]], x => x.map(y => y+1)))
        .deepEqual([2,3,4,5,6,7,8,9,10])
    }

    "joinBy()"() {
        const test = 
            utils.joinBy(
                [
                    {a:{c: [1,2,3]}, type: 'test'},
                    {a:{c: [4,5,6]}, type: 'test'}
                ],
                x => ({type: x.type}),
                xs => xs.reduce((acc,x) => acc.concat(x.a.c), [])
            )
        
        should(test[0]).deepEqual({ type: 'test', children: [ 1, 2, 3, 4, 5, 6 ] })
    }

    "only()"() {
        should(utils.only({a:1, b:2, c:3}, 'a', 'c')).deepEqual({a:1, c:3})
    }
}