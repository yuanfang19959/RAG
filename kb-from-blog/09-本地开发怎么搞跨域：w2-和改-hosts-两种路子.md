# 本地开发怎么搞跨域：w2 和改 hosts 两种路子

- 来源: https://www.yuanfang19959.icu/blog/1780667068850
- 分类: 前端开发
- 作者: 15267081012
- 日期: 2026-06-04
- 标签: 跨域

> 做前端久了，跨域这事谁都躲不掉。接口在别的域名上，本地 localhost:3000 一请求就报 CORS，控制台红一片。线上有 Nginx、网关统一配，本地没人给你配。
我这边主要用两种方式：w2（Whistle） 和 macOS 改 hosts。不算银弹，但日常够用，而且不用动后端代码。

# 本地开发怎么搞跨域：w2 和改 hosts 两种路子

做前端久了，跨域这事谁都躲不掉。接口在别的域名上，本地 `localhost:3000` 一请求就报 CORS，控制台红一片。线上有 Nginx、网关统一配，本地没人给你配。

我这边主要用两种方式：**w2（Whistle）** 和 **macOS 改 hosts**。不算银弹，但日常够用，而且不用动后端代码。

## 先说清楚：本地跨域到底在卡什么

浏览器同源策略：协议、域名、端口有一个不一样就算跨域。本地常见是：

•页面：`http://localhost:5173`

•接口：`https://api.xxx.com`

域名、协议都对不上，预检 OPTIONS 直接拦。后端没配 `Access-Control-Allow-Origin`，前端只能干瞪眼。

本地要解决，思路就两类：

1.**让浏览器觉得「同源」** — 改 hosts，把线上域名指到本机

2.**中间加一层代理** — 页面还是 localhost，请求先走代理再转发

w2 是第二种，改 hosts 是第一种。下面按我实际用法写。

## 方案一：用 w2（Whistle）做本地代理

w2 (https://wproxy.org/whistle/) 就是 Whistle，前端圈很多人叫 w2。本地代理，规则用文本配，改完立刻生效，比折腾 webpack devServer 省心。

### 安装

浏览器开 `http://127.0.0.1:8899`，就是管理界面。

这里需要科学上网 然后安装  Proxy SwitchyOmega 3 (ZeroOmega) (https://chromewebstore.google.com/detail/proxy-switchyomega-3-zero/pfnededegaaopdmhkdmcofjmoldfiped?hl=zh-CN)

### 系统代理

Whistle 要拦请求，得走它的代理：

•系统设置 → 网络 → 代理 → HTTP/HTTPS 填 `127.0.0.1:8899`

•或者只给 Chrome 开：SwitchyOmega 指到 8899

**只调试某个项目时开代理，完事关掉**，不然别的软件也可能被拦，怪事多。

### 我常用的跨域规则

假设本地 Vite 跑在 `localhost:5173`，接口是 `https://api.example.com`。

**做法 A：接口域名直接代理到真实后端**

这种适合页面已经通过 hosts 绑到 `api.example.com` 的情况，下面 hosts 那节会串起来讲。

**做法 B：localhost 路径转发（我更常用）**

页面请求写成 `/api/xxx`，w2 把 `/api` 转到真实域名：

Vite 里可以不用再配 `proxy`，规则全在 w2，换环境只改 w2 面板。

**做法 C：注入 CORS 响应头**

后端动不了、又必须跨域时，在 w2 里加：

或者只允许本地：

带 cookie 时 `origin` 不能写 `*`，要具体域名。

### 踩过的坑

1.**规则顺序**：Whistle 从上到下匹配，细规则放上面，别被宽泛规则盖掉。

2.**HTTPS**：没装根证书就一堆 `NET::ERR_CERT_AUTHORITY_INVALID`，先 `w2 ca`。

3.**WebSocket**：要单独写 `ws://` / `wss://` 规则，和普通 HTTP 不是一条。

4.**和 Charles 冲突**：别两个代理同时开，端口、证书都乱。

### 什么时候用 w2

•要模拟线上域名、改请求头、Mock 数据

•多人协作，规则导出 JSON 发群里就能复现

•项目多，不想每个仓库 `vite.config` 里写一遍 proxy

## 方案二：macOS 改 hosts，从域名层面「同源」

第二种思路：**让本地页面和接口在浏览器眼里同一个域**。

比如线上是 `https://www.example.com`，本地 dev server 跑在 `5173`。把 `www.example.com` 指到 `127.0.0.1`，浏览器访问 `http://www.example.com:5173`，再配合 w2 把 `/api` 转到真实后端——页面和接口请求都是 `www.example.com` 这个域，同源，跨域没了。

### 改 hosts

加一行：

保存后刷新 DNS：

Chrome 有时还缓存 DNS，打不开就无痕试一次，或者 `chrome://net-internals/#dns` 清缓存。

### 本地服务要听的地址

只绑 `localhost` 的话，用 `www.example.com` 可能进不去。Vite 示例：

然后访问 `http://www.example.com:5173`。

要完全贴近线上（连端口都不想带），本地再起 Nginx 监听 80，反代到 5173——我小项目懒得搞，带端口能接受。

### 和 w2 怎么配合

hosts 解决「页面域名像线上」，w2 解决「接口还是打真实后端」。

典型组合：

1.hosts：`www.example.com` → `127.0.0.1`

2.浏览器访问 `http://www.example.com:5173`

3.w2 规则：

页面里 axios 写 `baseURL: '/api'`，同源路径，浏览器不拦。

Cookie 场景也更顺：线上域是 `.example.com`，本地 hosts 绑同一套子域，Set-Cookie 域能对上（Secure、SameSite 那些还得自己核对）。

### hosts 方案的缺点

•**只在本机生效**，同事得各自改 hosts

•**域名冲突**：真访问线上同域时，hosts 还在指 127.0.0.1，调试完记得注释掉

•**HTTPS 本地证书**：想用 `https://www.example.com` 得 mkcert 之类自签，又一套配置

所以我长期绑 hosts 的一般是固定一两个项目；临时联调更常单用 w2 规则，不动系统文件。

## 两种方案怎么选

w2

hosts

上手

装包、开代理、写规则

改一行文件

影响范围

开代理时生效，关了就没事

全系统解析该域名

灵活度

高，改头、Mock、转发

低，主要是域名指向

团队协作

规则可共享

每人改 hosts

我现在的习惯：

•**纯跨域、接口域名固定** → 只 w2，Vite proxy 都不写

•**要复现 Cookie、登录态、子域逻辑** → hosts + w2 一起上

•**后端本地也起了**（如 `localhost:8080`）→ w2 一条转发就够，hosts 犯不上

## 结尾

跨域不是前端 alone 的事，理想情况还是后端/网关配好 CORS。但本地联调、赶进度、后端排期靠后时，上面两套能顶很久。

w2 我基本天天开；hosts 看项目，需要「像线上一样」才改。工具是死的，场景是活的，别为了本地开发去生产改 CORS 配成 `*`，那种坑我踩过一次，够记一辈子。

*写于某个调接口调到半夜的晚上。*
