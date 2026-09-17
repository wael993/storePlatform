const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '../../../packages/store-domain/src')
const dest = path.join(__dirname, '../src/shared/store-domain')

fs.rmSync(dest, { recursive: true, force: true })
fs.cpSync(src, dest, { recursive: true })
