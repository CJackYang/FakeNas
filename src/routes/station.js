const express = require('express')
const deviceInfo = require('../lib/device')()

module.exports = (model) => {
  let router = express.Router()

  router.get('/info', (req, res, next) => {
    res.status(200).json({
      deviceSN: deviceInfo.deviceSN,
      deviceModel: deviceInfo.deviceModel,
      mac: deviceInfo.net && deviceInfo.net.mac,
      swVersion: deviceInfo.softwareVersion,
      hwVersion: deviceInfo.hardwareVersion,
      boundUser: model.account.user ? { phicommUserId: model.account.user.phicommUserId} : null,
      netState: model.channel.getState().toUpperCase()
    })
  })
  
  return router
}