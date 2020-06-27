// @ts-check

/**  To work on this script:
  rm -rf test-template template && git clone sveltejs/template test-template && node scripts/setupTypeScript.js test-template
*/

const fs = require("fs")
const path = require("path")
const { argv } = require("process")

const projectRoot = argv[2] || path.join(__dirname, "..")

// Add deps to pkg.json
const packageJSON = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"))
packageJSON.dependencies = Object.assign(packageJSON.dependencies, {
  "svelte-check": "^1.0.0",
  "svelte-preprocess": "^3.0.0",
  "@rollup/plugin-typescript": "^4.0.0",
  "typescript": "^3.9.3",
  "@tsconfig/svelte": "^1.0.0"
})

// Add script for checking
packageJSON.scripts = Object.assign(packageJSON.scripts, {
  "validate": "svelte-check",
})

// mv src/main.js to main.ts - note, we need to edit rollup.config.js for this too
const beforeMainJSPath = path.join(projectRoot, "src", "main.js")
const afterMainTSPath = path.join(projectRoot, "src", "main.ts")
fs.renameSync(beforeMainJSPath, afterMainTSPath)

// Switch the app.svelte file to use TS
const appSveltePath = path.join(projectRoot, "src", "App.svelte")
let appFile = fs.readFileSync(appSveltePath, "utf8")
appFile = appFile.replace("<script>", '<script lang="ts">')
appFile = appFile.replace("export let name;", 'export let name: string;')
fs.writeFileSync(appSveltePath, appFile)

// Edit rollup config
const rollupConfigPath = path.join(projectRoot, "rollup.config.js")
let rollupConfig = fs.readFileSync(rollupConfigPath, "utf8")

// Edit imports
rollupConfig = rollupConfig.replace(`'rollup-plugin-terser';`, `'rollup-plugin-terser';
import sveltePreprocess from 'svelte-preprocess';
import typescript from '@rollup/plugin-typescript';`)

// Add preprocess to the svelte config, this is tricky because there's no easy signifier.
// Instead we look for `css:` then the next `}` and add the preprocessor to that
let foundCSS = false
let match

// https://regex101.com/r/OtNjwo/1
const configEditor = new RegExp(/css:.|\n*}/gmi)
while (( match = configEditor.exec(rollupConfig)) != null) {
  if (foundCSS) {
    const endOfCSSIndex = match.index + 1
    rollupConfig = rollupConfig.slice(0, endOfCSSIndex) + ",\n			preprocess: sveltePreprocess()," + rollupConfig.slice(endOfCSSIndex);
    break
  }
  if (match[0].includes("css:")) foundCSS = true
}


// Add TypeScript
rollupConfig = rollupConfig.replace("commonjs(),", 'commonjs(),\n\t\ttypescript({ sourceMap: !production }),')
fs.writeFileSync(rollupConfigPath, rollupConfig)

// Add TSConfig
const tsconfig = `{
  "extends": "@tsconfig/svelte/tsconfig.json"
}`
const tsconfigPath =  path.join(projectRoot, "tsconfig.json")
fs.writeFileSync(tsconfigPath, tsconfig)

// Delete this script, but not during testing
if (!argv[2]) {
  // Remove the script
  fs.unlinkSync(path.join(__filename))
  // Remove the scripts folder
  fs.rmdirSync(path.join(__dirname))
}
