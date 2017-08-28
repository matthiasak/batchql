const f = require("fuse-box")
    , { Sparky, FuseBox:fb } = f
    , path = require("path")

Sparky.task("test", () =>
    fb
    .init({homeDir: 'src', output: 'build/test.js'})
    .bundle("app")
    .instructions('[*.ts]')
    .test("[**/**.test.ts]"))

Sparky.task("default", ["clean", "test"], () => {})
Sparky.task("clean", () => Sparky.src("build/*").clean("build/").clean(".fusebox"))
