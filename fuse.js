const f = require("fuse-box")
	, chokidar = require('chokidar')
	, dev = process.env.NODE_ENV !== 'production'
	, closure = require('fusebox-closure-plugin').default

let c = {
	homeDir: "src/"
	, cache: dev
	, package: 'batchql'
	, globals: { 'batchql': 'batchql' }
	, sourceMap: {
		bundleReference: "index.js.map"
		, outFile: "./build/index.js.map"
	}
	, outFile: "./build/index.js"
	, inFile: "> [index.ts]"
	, plugins: [
		f.TypeScriptHelpers()
		// , !dev && closure()
	].filter(x => !!x)
}

const build = $ => {
	let d = Object.assign({}, c)
		, inFile = d.inFile
	f.FuseBox.init(d).bundle(inFile)
}

let p = require('lodash.debounce')(build, 250)

dev &&
	chokidar
	.watch('src')
	.on('all', p)

p()