const esbuild = require('esbuild')
const { getEsbuildConfig, entryPoints } = require('./esbuild-config')

console.log('Entry points:', entryPoints)

esbuild.context(getEsbuildConfig())
  .then(async (ctx) => {
    await ctx.watch()
    console.log('Watch mode started. Watching for changes...')
  })
  .catch((error) => {
    console.error('Build failed:', error)
    process.exit(1)
  })
