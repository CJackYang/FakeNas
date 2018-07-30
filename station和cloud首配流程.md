# Station与Cloud首配流程

## 登录斐讯云账户

获取云token资源

获取station列表，包括已绑定，待接受邀请，提供服务等状态的设备列表

## 搜索MDNS

发现同网段的设备，找到可以被绑定的设备。

可绑定的设备判定如下: 

+ GET ip:3001/info 可正常拿到***deviceSN***，且设备网络状态为在线
+ GET ip:3000/boot 拿回信息无boundUser

## 绑定流程

+ 通过携带deviceSN访问云绑定api 发起绑定


+ polling云绑定状态api
+ 云向设备发起物理按键请求
+ 设备返回物理按键结果(success, failed)
+ 如果设备返回成功，客户端发现绑定状态成功　停止polling
+ 云绑定成功
+ 云向NAS 发送绑定成功消息，绑定用户uid, phoneNumber
+ NAS建立***user.json***资源,保存绑定用户信息
+ NAS boot api 可以拿到　boundUser信息

## 创建磁盘卷及初始化

+ 访问boot/boundVolume api创建磁盘卷
+ 客户端通过云pip api远程获取***设备token***
+ 引导用户远程设置离线密码和samba密码
+ 设置白金计划开关
+ 首配完成





## 参考文档

[云对客户端接口]: https://github.com/wisnuc/phi-doc/blob/master/cloud/N2%E4%BA%91%E6%9C%8D%E5%8A%A1App%E6%8E%A5%E5%8F%A3.md
[云和设备SSL消息]: <https://github.com/wisnuc/phi-doc/blob/master/cloud/N2%E4%BA%91%E6%9C%8D%E5%8A%A1SSL%E7%AE%A1%E7%90%86%E9%80%9A%E9%81%93%E5%8D%8F%E8%AE%AE.md>
[云和设备http接口(pipe消息　response)]: https://github.com/wisnuc/phi-doc/blob/master/cloud/N2%E4%BA%91%E6%9C%8D%E5%8A%A1Station%E6%8E%A5%E5%8F%A3.md
[station 接口]: https://github.com/wisnuc/phi-doc/blob/master/api/station.html