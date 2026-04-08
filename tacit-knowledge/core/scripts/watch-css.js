const { spawn } = require('child_process')
const chokidar = require('chokidar')
const path = require('path')

console.log('Starting CSS watch process...')

const sassProcess = spawn('sass', [
  './app/assets/stylesheets/application.sass.scss:./app/assets/builds/application.css',
  './app/assets/stylesheets/main.sass.scss:./app/assets/builds/main.css',
  './app/assets/stylesheets/chat.sass.scss:./app/assets/builds/chat.css',
  '--no-source-map',
  '--load-path=node_modules',
  '--watch'
], { stdio: 'inherit' })

// 複数のCSSファイルを監視
const cssFiles = [
  './app/assets/builds/application.css',
  './app/assets/builds/main.css',
  './app/assets/builds/chat.css',
]

const watcher = chokidar.watch(cssFiles)

let processing = false

watcher.on('change', async (filePath) => {
  if (processing) return

  processing = true
  console.log(`CSS file changed: ${filePath}, running PostCSS...`)

  const postcssProcess = spawn('postcss', [
    ...cssFiles,
    '--replace'
  ], { stdio: 'inherit' })

  postcssProcess.on('close', (code) => {
    if (code === 0) {
      console.log('PostCSS processing completed')
    } else {
      console.error('PostCSS processing failed')
    }
    processing = false
  })
})

process.on('SIGINT', () => {
  console.log('\nShutting down CSS watch...')
  sassProcess.kill()
  watcher.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  sassProcess.kill()
  watcher.close()
  process.exit(0)
})
