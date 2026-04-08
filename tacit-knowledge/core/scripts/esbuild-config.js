const dotenv = require('dotenv')
const path = require('path')
const fs = require('fs')

dotenv.config()

const defineEnv = {
  'process.env.AI_SERVER_URL': JSON.stringify(process.env.AI_SERVER_URL || 'http://localhost:8000'),
}

const aliasPlugin = {
  name: 'alias',
  setup(build) {
    build.onResolve({ filter: /^@\// }, (args) => {
      const aliasPath = args.path.replace(/^@\//, '')
      const basePath = path.resolve(__dirname, '..', 'app', 'javascript', 'src', aliasPath)
      
      const extensions = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js']
      
      if (path.extname(basePath)) {
        return { path: basePath }
      }
      
      for (const ext of extensions) {
        const tryPath = basePath + ext
        if (fs.existsSync(tryPath)) {
          return { path: tryPath }
        }
      }
      
      return { path: basePath }
    })
  },
}

const jsDir = 'app/javascript'
const files = fs.readdirSync(jsDir)
const entryPoints = files
  .filter(file => file.endsWith('.js') || file.endsWith('.tsx'))
  .map(file => path.join(jsDir, file))

function getEsbuildConfig() {
  return {
    entryPoints: entryPoints,
    bundle: true,
    sourcemap: true,
    format: 'esm',
    outdir: 'app/assets/builds',
    publicPath: '/assets',
    loader: {
      '.tsx': 'tsx',
      '.ts': 'ts'
    },
    external: ['*.scss', '*.css'],
    define: defineEnv,
    plugins: [aliasPlugin],
  }
}

module.exports = {
  getEsbuildConfig,
  entryPoints,
}

