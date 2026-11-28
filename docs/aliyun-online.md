# 阿里云联机部署

2026-11-28，游戏网页与常驻房间服务部署于现有 ECS。游戏版本为 `0fa9b1cd794f501eec4c4e539e933283055cfc48`，联机兼容标识为 `eca0fd60ee8308dfac83`。

[进入正式游戏](https://47.114.45.241/) · [服务健康检查](https://47.114.45.241/healthz)

## 当前部署

| 项目 | 配置 |
|---|---|
| 公网入口 | `https://47.114.45.241/` |
| 房间长连接 | `wss://47.114.45.241/match` |
| 入站端口 | TCP 80、443 |
| 房间服务 | `meme-rumble-live-online.service`，监听 `127.0.0.1:4187` |
| HTTPS 入口 | `meme-rumble-live-web.service`，由 Caddy 转发房间连接并提供网页 |
| 自动证书 | Let's Encrypt 短期 IP 证书，由 Caddy 自动续期 |
| 发布指针 | `/opt/meme-rumble/live/current` |
| 前一版位置 | `/opt/meme-rumble/live/previous-release.txt` |

房间连接已启用 `permessage-deflate` 消息压缩，浏览器自动协商，普通未压缩客户端仍可接入。新增真实服务集成测试确认两类客户端收到完全一致的战斗状态，完整回归 329 项通过。

两个服务都已启用开机自启与失败重启。证书续期需保持 80、443 端口可达。

房间保存在进程内存中。更新程序或重启服务会结束当前房间，应在无正在进行的比赛时更新。

## Qoder 网页发布

Qoder 负责提供网页，阿里云负责房间与对战。两边使用同一份游戏代码构建，服务端会检查联机兼容标识。

构建前设置房间地址，发布生成的 `site/` 全部内容。

```sh
npm ci
ONLINE_SERVICE_URL=wss://47.114.45.241/match npm run build:site
```

此次已生成配套网页压缩包 `qoder-site-0fa9b1c.zip`，解压后根目录为 `index.html`、`online-version.txt` 与 `assets/`。Qoder 网站维护者可以将这些内容作为站点重新发布。

本次检查时，现有 Qoder 网页仍为旧构建 `a583162043b6ea002ad2`，未配置阿里云地址。阿里云网页可直接使用。旧 Qoder 页面需发布上述配套包后再验收。

需要单文件网页时使用同样的地址运行 `npm run build`，发布 `dist/index.html`。不要把服务器交接包、SSH 私钥或其他凭据加入网页或仓库。

## 验收

公网 HTTPS 健康检查返回 `ok`，证书验证通过。使用实际 Qoder origin 建立两条公网 WSS 连接，已完成以下验证。

- 创建房间，好友加入后再选角色，双方确认后由房主选图。
- 标准对战与双角色车轮战，选择雨夜商街，时限设为 45 秒。
- 冲刺方向与耐力同步，两边分别攻击，双方看到的生命值一致。

最新配套网页包使用两个独立浏览器会话，页面按 Qoder 来源加载，静态文件由本地交付包提供，实际 WSS 连接阿里云公网；完成建房、双方选角、房主选图及实际按键对战，两端生命值同步为 964 / 955，页面运行错误为零，并检查双方的新剧场背景及角色均完整显示。这项验证证明配套包可连接已部署的房间服务，不表示现有 Qoder 网址已经重新发布。

ECS 同时承载大图静态下载时，首次双端冷启动测试出现等待及连接超时；独立公网房间测试与上述配套包对战通过。推荐由 Qoder 提供静态网页，ECS 专门承载房间服务。当前尚未完成 Qoder 正式页面重新发布后的验收。

新版直播擂台使用手绘剧院与可爱动物观众，背景按比例绘制远景视差。角色确认会等待地图及必要角色图像解码完成；联机双方预载四个角色，避免对方临时换角后出现角色缺失。已用浏览器延迟地图请求，验证载入期间不能提前确认、完成后恢复确认。

后续更新后可重新验证上述流程，并检查页面角色、地图和规则与当前版本相符。

## 运维命令

登录已有服务器后，可使用下列命令检查状态。

```sh
systemctl status meme-rumble-live-online.service meme-rumble-live-web.service
journalctl -u meme-rumble-live-online.service -n 50 --no-pager
journalctl -u meme-rumble-live-web.service -n 50 --no-pager
curl --fail https://47.114.45.241/healthz
```

回退时将 `current` 切换到 `previous-release.txt` 记录的目录，再重启上述两个服务。保留 Caddy 的 `/var/lib/meme-rumble-live-caddy` 目录以沿用证书与自动续期状态。
