const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')

const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

const Account = require('./account')
const Channel = require('./channel')
const Config = require('../lib/config')
const Cmd = Config.cmd
const ServerConf =  Config.server

const getDeviceInfo = require('../lib/device')
let deviceInfo = getDeviceInfo()

const debug = () => {}

class Model extends EventEmitter {

  constructor(root) {
    super()

    this.root = root
    this.tmpDir = path.join(this.root, 'tmp')
    this.appBallsDir = path.join(this.root, 'appifi-tarballs')
    this.appifiDir = path.join(this.root, 'appifi')

    rimraf.sync(this.tmpDir)
    mkdirp.sync(this.tmpDir)
    mkdirp.sync(this.appifiDir)
    mkdirp.sync(this.appBallsDir)

    this.conf = {}
    this.conf.secret = 'Lord, we need a secret'
    this.conf.useFakeDevice = process.argv.includes('--useFakeDevice')
    this.conf.useDevCloud = process.argv.includes('--devCloud')

    this.account = new Account(this, path.join(Config.chassis.dir, 'user.json'), path.join(Config.chassis.dir, 'btmp', 'account'))

    Object.defineProperty(this, 'boundUser', {
      get () {
        return this.account.user
      }
    })


    let channelHandles = new Map()

    channelHandles.set(Cmd.FROM_CLOUD_TOUCH_CMD, this.handleCloudTouchReq.bind(this))
    // channelHandles.set(Cmd.CLOUD_CHANGE_PASSWARD_MESSAGE, this.handleCloudChangePwdMessage.bind(this))
    channelHandles.set(Cmd.FROM_CLOUD_BIND_CMD, this.handleCloudBindReq.bind(this))

    let options = deviceInfo.deviceSecret
    
    let noticeHandles = new Map()

    noticeHandles.set(Cmd.FROM_CLOUD_UNBIND_NOTICE, this.handleCloudUnbindNotice.bind(this))

    let addr = this.conf.useDevCloud ? ServerConf.devAddr : ServerConf.addr
    
    this.channel = new Channel(this, addr, ServerConf.port, options, channelHandles, noticeHandles)

    this.channel.on('Connected', this.handleChannelConnected.bind(this))
    
    this.cloudToken = undefined
    this.receiveBindedUser = false // record is received cloud bindedUid
  }

  sendBoundUserToAppifi(user) {

  }

  /**
   * handle cloud touch req, response 'ok' or 'timeout'
   * @param {object} message 
   */
  handleCloudTouchReq (message) {
    debug('handleCloudTouchReq')
    let msgId = message.msgId
    setTimeout(() => {
      let status = 'ok'  // 强制ok
      return this.channel.send(this.channel.createAckMessage(msgId, { status }))
    })
  }

  /**
   * 1. req 发送设备接入请求 to Cloud
   * 2. 返回结果　包括　boundUser
   * 3. 发送boundUser to Appifi 
   * 4. req 发送Token请求 To Cloud
   * 5. 返回Token
   * 6. 发送Token To Appifi
   */
  handleChannelConnected () {
    // create connect message
    deviceInfo = getDeviceInfo()
    let connectBody = this.channel.createReqMessage(Cmd.TO_CLOUD_CONNECT_CMD, {
      deviceModel: deviceInfo.deviceModel,
      deviceSN: deviceInfo.deviceSN,
      MAC: deviceInfo.net.mac,
      localIp: deviceInfo.net.address,
      swVer: deviceInfo.softwareVersion,
      hwVer: deviceInfo.hardwareVersion
    })
    this.channel.send(connectBody, message => {
      // message inclouds boundUserInfo
      this.handleCloudBoundUserMessage(message)
      this.channel.send(this.channel.createReqMessage(Cmd.TO_CLOUD_GET_TOKEN_CMD, {}), message => {
        // message inclouds Token
        this.cloudToken = message.data.token
      })
    })
  }

  /**
   * 
   * @param {obj} message
   * {
   *    type: 'ack'
   *    msgId: 'xxx'
   *    data: {
   *       uid: "" //　设备绑定用户phicomm bindedUid, 未绑定时值为０
   *       phoneNumber:"" // 设备绑定用户手机号,未绑定为空字串
   *    }
   * } 
   */
  handleCloudBoundUserMessage (message) {
    console.log('handle device bind info', message.data)
    let data = message.data
    if (!data) return
    if (!data.hasOwnProperty('bindedUid')) {
      return console.log('====bindedUid not found====')
    }
    if (!data.hasOwnProperty('phoneNumber')) {
      return console.log('==== phoneNumber not found ====')
    }
    let props = {
      phicommUserId: data.bindedUid,
      phoneNumber: data.phoneNumber
    }

    if (props.phicommUserId === '0') console.log('device not bind')

    //check boundUser id match
    if (this.account.user && (props.phicommUserId === '0' || props.phicommUserId !== this.account.user.phicommUserId)) {
      // boundUser unbind
    }

    this.account.updateUser(props, (err, d) => {
      this.receiveBindedUser = true
      if (!err) this.sendBoundUserToAppifi(this.account.user)
    })
  }

  /**
   * handle cloud user unbind message 
   * use for unbind user message
   * @param {object} message
   * @param {object} message.data
   * @param {string} message.data.uid
   * @param {string} message.data.deviceSN 
   */
  handleCloudUnbindNotice (message) {
    if (!message.data || !message.data.uid || !message.data.deviceSN) return debug("Error Unbind Message", message)
    if (message.data.uid !== this.account.user.phicommUserId) return debug('Error Unbind: uid mismatch')
    if (message.data.deviceSN !== deviceInfo.deviceSN) return debug('Error Unbind: deviceSn mismatch')

    let props = { phicommUserId: '0' }

    console.log('unbind message comming')
    this.account.updateUser(props, (err, data) => {
      if (!err) this.appifi && this.appifi.sendMessage({ type: Cmd.TO_APPIFI_UNBIND_CMD, data: {} })
    })
  }

  /**
   * use for bind new user message
   * @param {object} message 
   * {
   *    type: 'req'
   *    reqCmd: 'bind'
   *    msgId: 'xxx'
   *    data: {
   *      uid: 'xxxx'  //required
   *    }
   * }
   */
  handleCloudBindReq(message) {
    if (!message.data || typeof message.data !== 'object' || !message.data.hasOwnProperty('uid') || !message.data.hasOwnProperty('phoneNumber')) {
      console.log('=====  bind failed ====')
      console.log(message)
      console.log('=======================')
      return this.channel.send(this.channel.createAckMessage(message.msgId, { status: 'failure' }))
    }
    let props = { phicommUserId: message.data.uid, phoneNumber: message.data.phoneNumber }

    console.log('bind message comming ', props)
    this.account.updateUser(props, (err, data) => {
      if (err) return this.channel.send(this.channel.createAckMessage(message.msgId, { status: 'failure' }))
      this.sendBoundUserToAppifi(this.account.user)
      return this.channel.send(this.channel.createAckMessage(message.msgId, { status: 'success' }))
    })
  }
}

module.exports = Model