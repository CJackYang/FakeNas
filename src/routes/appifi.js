const express = require('express')
const deviceInfo = require('../lib/device')()

module.exports = (model) => {
  let router = express.Router()

  router.get('/boot', (req, res) => {
    res.status(200).json()
  })

  return router
}