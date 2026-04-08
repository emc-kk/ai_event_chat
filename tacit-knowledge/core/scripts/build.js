const esbuild = require('esbuild')
const { getEsbuildConfig, entryPoints } = require('./esbuild-config')

console.log('Entry points:', entryPoints)

esbuild.build(getEsbuildConfig()).catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
