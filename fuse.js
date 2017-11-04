const f = require("fuse-box")
    , { Sparky, FuseBox:fb } = f
    , path = require("path")

Sparky.task("test", () =>
    fb
    .init({homeDir: 'src', output: 'build/test.js'})
    .bundle("app")
    .instructions('[*.ts]')
    .test("[**/**.test.ts]"))

Sparky.task("default", ["clean"], () => {
    const build = fb.init({homeDir: 'src', output: 'build/$name.js', sourceMaps: true})

    build
    .bundle('test')
    .instructions("> test.ts")
    .sourceMaps(true)
    .hmr()
    .watch()

    build
    .dev({
        open: true,
        port: 4445
    }, server => {
        const p = path.resolve("./src/test.html")
        const app = server.httpServer.app
        app.get("/", (req, res) => {
            res.sendFile(p)
        })
    })
    
    build.run()
})

Sparky.task("clean", () => Sparky.src("build/*").clean("build/").clean(".fusebox"))
