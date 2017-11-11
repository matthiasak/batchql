# BatchQL

![logo](./icon.svg)

[![NPM](https://nodei.co/npm/batchql.png)](https://nodei.co/npm/batchql/)

BatchQL is a language-level query optimizer for GraphQL. 

**Note:** Not all GraphQL features are perfectly supported, there will be some caveats that come with the usage of a tool like this. Right now, you should handle mutations and subscriptions through standard means, as the batching logic has been written with queries in mind. But mutations are really close to working :)

## Installation

```sh
npm install --save batchql
# or
yarn add batchql
```

## Playground & Usage

You can play with the code by copy+pasting the following into https://matthiasak.github.io/arbiter-frame. This example uses the GitHub GraphQL API to demonstrate the effectiveness of logical query batching :)

```js
const token = 'd1606fec57686c5dbbecdb97c063da2f848b0da9'

const app = $ => {
    const {mux, batch, debug} = batchql
    
    const fetcher = (url) => (query, args) =>
    (debug() && log({batchedQuery: query}, '')) ||
    fetch(
        url, 
        { 
            method: 'POST', 
            headers: {
                "Content-Type": 'application/json',
                "Authorization": `Bearer ${token}`
            }, 
            body: JSON.stringify({ query, variables: args }) 
        })
    .then(r => r.json())
    .then(f => {
        if(f.errors) throw new Error(f.errors.map(e => '\n- '+e.message).join(''))
        return f.data
    })

    // register a free GraphQL endpoint at https://graph.cool
    const f = mux(fetcher('https://api.github.com/graphql'), 100)

    // want debug messages for parsing graphQL syntax? uncomment below
    debug(true)
    
    f(`($name: String!){ 
      topic(name: $name) {
        name
        relatedTopics {
          id
          name
        }
      }
    }`, {name: 'typescript'})
    .then(d => log(d, ''))
    
    f(`($name: String!){ 
      topic(name: $name) {
        name
        relatedTopics {
          id
          name
        }
      }
    }`, {name: 'ruby'})
    .then(d => log(d, ''))
    
    f(`($name: String!){ 
      topic(name: $name) {
        name
        relatedTopics {
          id
          name
        }
      }
    }`, {name: 'ruby'})
    .then(d => log(d, ''))
    
    f(`($name: String!){ 
      topic(name: $name) {
        name
        relatedTopics {
          id
          name
        }
      }
    }`, {name: 'ruby'})
    .then(d => log(d, ''))
}

require('batchql@1.1.14').then(app).catch(e => log(e))
```

## This is Dark Magic...

Not really :-) For a given time-slice, one part of BatchQL's algorithm (the `mux()`) can take all calls for a given X ms and then send all of those query strings to the `batch()` method.

The old method (BatchQL pre-1.0) used to take a best guess on batching the queries together by finding a general query statement and matching on parens or curly braces, but if the input query had invalid syntax then the algorithm kinda just blew up. 

It used to kinda do something like this:

```js
const mergedQueries = batch('query { allPersons { name } }', 'query { allPersons { email } }', 'query { allPersons { age } }')
mergedQueries
// query { 
//  item0: allPersons { name } 
//  item1: allPersons { email } 
//  item2: allPersons { age } 
// }
```

This merely batched the queries together, but didn't do an actual logical merge of the queries. But no more! Now we have an actual tree-merging batching mechanisms that doesn't batch _messages together_, it batches the _logical queries_. Yey!

```js
const mergedQueries = batch('query { allPersons { name } }', 'query { allPersons { email } }', 'query { allPersons { age } }')
mergedQueries
// query { allPersons { name email age }  }
// sooooooooooooo much more efficient as queries get larger
```

How?

Parsers, combinators, and parser-combinators.

> Parser combinators propose a middle ground between hand-written parsers and generated parsers. They are made of small functions that handle basic parts of a format, like recognizing a word in ASCII characters or a null byte. Those functions are then composed in more useful building blocks like the pair combinator that applies two parsers in sequence, or the choice combinator that tries different parsers until one of them succeeds.

> The functions are completely deterministic and hold no mutable state. The deterministic behaviour of parser combinators simplifies writing the state machine that manages data accumulation.

We can actually parse GraphQL query strings into a lightweight Abstract Syntax Tree (AST), and then with multiple ASTs merge them into a single tree with some quick recursive logic. 

You can check out each piece in the various files under the `/src` folder.
- `/src/parsers.ts` - code for parsing tokens
- `/src/combinators.ts` - code for the parser combinators that contain the logic to parse entire GraphQL queries
- `/src/merge.ts` - code for merging multiple ASTs into a single AST, generating extraction maps for parsing out the tree of data requested by each parallelized query, and logic for renaming query variables and aliases/query-fields that may have collisions (with built-in reverse maps)
- `/src/regenerate.ts` - code for generating a GraphQL string from an AST
- `/src/batchql.ts` - code for the muxer, a general fetcher, and the batch method, plus applying extraction maps to the returned data

## Embracing parser combinators

> Changing the language is important, but it is not enough. Another component is required to help fix logical bugs, and make sure parsers are both easier to write and do not contain errors.

Many low-level parsers ‘in the wild’ are written by hand, often because they need to deal with binary formats, or in a quest for better performance. Often these end up with hard to maintain code. At the other end of the spectrum there are parser generators, which tend to produce parsers of good quality but still present challenges in writing the grammar and integrating context specific libraries.

In between these two choices lie parser combinators.

> Parser combinators propose a middle ground between hand-written parsers and generated parsers. They are made of small functions that handle basic parts of a format, like recognizing a word in ASCII characters or a null byte. Those functions are then composed in more useful building blocks like the pair combinator that applies two parsers in sequence, or the choice combinator that tries different parsers until one of them succeeds.

The functions are completely deterministic and hold no mutable state. The deterministic behaviour of parser combinators simplifies writing the state machine that manages data accumulation.

- [Writing parsers like it is 2017](http://spw17.langsec.org/papers/chifflier-parsing-in-2017.pdf) Chifflier & Couprie, SPW’17

## Strengths of this approach

If you choose to create "Service Oriented Components", meaning your components can request their own data (such as `onMount`), you run into sometimes 5 or 10 parallel graphql requests heading to your server:

```

  +----------------------------+
  |                            |
  |    header                  |  header -> `{ user { ...menuItems }}`
  |                            |
  |                            |
  |                            |
  +----------------------------+
  |                            |
  |  +-------------------------+
  |  |     ||     ||     ||   ||
  |  |  a  ||  b  ||  c  ||   ||  a, b, c, d, e -> `{ content(id:???) { title, date, summary } }
  |  |     ||     ||     ||   ||
  |  +--------------------|   ||
  |  +--------------------| e ||
  |  |                   ||   ||
  |  |                   ||   ||
  |  |        d          ||   ||
  |  |                   ||   ||
  |  |                   ||   ||
  |  +-------------------------|
  +----------------------------+

```

With the 6 queries above it could take a lot longer to get the data you need to render to the screen quickly. 

BatchQL treats your queries like they are meant to be: logically independent (as much as I could do in a few days' time :D). So, using BatchQL is pretty straightforward and hopefully not too leaky of an abstraction:

```js
// step 1. import batchql
// mux :: (string -> object -> Promise) -> (string -> object -> Promise)
import mux from 'batchql'

// step 2. create your function the posts to your graphql endpoint
const get = (url, query, args) =>
	fetch(
		url
		, {
			method: 'POST'
			, headers: Object.assign(
				{'Content-Type': 'application/json'}
				, token ? {'authorization': `Bearer ${token}`} : {})
			, body: JSON.stringify({ query, variables: args })
		})
		.then(r => r.json()))

// step 3. batch it!
const batchedGet = batchql(get.bind(null, 'https://mygraphqlendpoint.com/graphql'))

// step 4. use it err'where?
batchedGet(`{ user { id } }`).then(response => console.log(response.data.user))
batchedGet(`{ notifications { comments } }`).then(response => console.log(response.data.comments))
batchedGet(`{ messages { text, from } }`).then(response => console.log(response.data.messages))
```

The end result of using batchql:

```


   with batchql:



  +----------------------------+
  |                            |
  |    header                  |  header +> `{ user { ...menuItems }}`+
  |                            |                                      |
  |                            |                                      |
  |                            |                                      |
  +----------------------------+                                      |
  |                            |                                      |
  |  +-------------------------+                                      |
  |  |     ||     ||     ||   ||                                      +
  |  |  a  ||  b  ||  c  ||   ||  a, b, c, d, e +> `{ content(id:???) { title, date, summary } }
  |  |     ||     ||     ||   ||  +-------------------------------+   +
  |  +--------------------|   ||                      |  |  |  |  |   |
  |  +--------------------| e ||                      |  |  |  |  |   |
  |  |                   ||   ||                      |  |  |  |  |   |
  |  |                   ||   ||                      |  |  |  |  |   |
  |  |        d          ||   ||                      |  |  |  |  |   |
  |  |                   ||   ||                      |  |  |  |  |   |
  |  |                   ||   ||                      |  |  |  |  |   |
  |  +-------------------------|                      |  |  |  |  |   |
  +----------------------------+               +------v--v--v--v--v---v------------+
                                               |                                   |
                                               |         batched querying          |
                                               |                                   |
                                               |                                   |
                                               +-----------------------------------+
                                                                |
                                                         SINGLE QUERY!! :D
                                                                |
                                                            XXXX|XX  XXXXX
                                                  XXXXXXXXXXX   v         XXX
                                                 X                          X
                                           XXXX XX                          XXXXXX X
                                        XXX                                        X
                                        X                                          XX
                                        X             graphql endpoint              X
                                        X                                            X
                                        X                                            XX
                                          XXXXXXXXXXXXXXXXXX                          X
                                                           XX                        XX
                                                            XX         XXXXXXX      XX
                                                              XXXXXXXXX      XXXX XXX
                                                                                XXX

```

## Caught a bug?

1. [Fork](https://help.github.com/articles/fork-a-repo/) this repository to your own GitHub account and then [clone](https://help.github.com/articles/cloning-a-repository/) it to your local device
2. Install the dependencies: `yarn`
3. Bundle the source code and watch for changes: `npm start`

After that, you'll find the code in the `./build` folder!

## Authors

- Matthew Keas, [@matthiasak](https://twitter.com/@matthiasak). Need help / support? Create an issue or ping on Twitter.

## Credits

> Thanks to Amy Morgan on The Noun Project for the logo!