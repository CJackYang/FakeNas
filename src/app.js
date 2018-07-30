const Model = require('./models/index')
const path = require('path')
const createApp = require('./lib/express')
const appifiRouter = require('./routes/appifi')
const stationRouter = require('./routes/station')

const rootarg = process.argv
  .find((arg, idx, arr) => {
    if (idx === 0) return false
    if (arr[idx - 1] === '--root') return true
    return false
  })

const root = (rootarg && path.resolve(rootarg)) || '/phi'

console.log(`root is ${root}`)

const createApp1 = (router, model) => {
  let opts = {
    setttings: { json: { spaces: 2 } },
    log: { skip: 'selected' },
    routers: []
  }

  opts.routers.push(['/v1', router(model)])

  return createApp(opts)
}

const createApp2 = (router, model) => {
  let opts = {
    setttings: { json: { spaces: 2 } },
    log: { skip: 'selected' },
    routers: []
  }

  opts.routers.push(['/', router(model)])

  return createApp(opts)
}

const model = new Model(root)

const app = createApp2(appifiRouter, model)

app.listen(3000, err => {
  if (err) {
    console.log('failed to listen on port 3001, process exit')
    return process.exit(1)
  } else {
    console.log('Bootstrap started')
  }
})

const appifiApp = createApp1(stationRouter, model)

appifiApp.listen(3001, err => {
  if (err) {
    console.log('failed to listen on port 3001, process exit')
    return process.exit(1)
  } else {
    console.log('Bootstrap started')
  }
})