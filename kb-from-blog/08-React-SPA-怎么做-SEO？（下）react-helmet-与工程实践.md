# React SPA 怎么做 SEO？（下）react-helmet 与工程实践

- 来源: https://www.yuanfang19959.icu/blog/1781013064184
- 分类: 前端开发
- 作者: 15267081012
- 日期: 2026-06-08
- 标签: 无

> React SPA 怎么做 SEO？（下）react-helmet 与工程实践

## 为什么需要 react-helmet

SPA 路由切换时 `<head>` 不会自动更新。手动改 `document.title` 很快不够用。

react-helmet (https://github.com/nfl/react-helmet) 让你在组件里 **声明式** 描述 head，路由变了由库合并更新 DOM：

包

说明

`react-helmet`

React 16/17 老项目

`react-helmet-async`

**React 18+ 推荐**，Concurrent 安全，SSR 无泄漏

## 三步接入

### 1. 根节点 HelmetProvider

### 2. 封装 Seo 组件

### 3. 页面中使用

**静态页：**

**动态页（等数据就绪再渲染）：**

**关键：** loading 态别设 title 为「加载中……」，爬虫可能缓存错误 head。

### 环境变量

`canonical`、`og:url` 统一走 `absoluteUrl`，避免测试域被收录。

## Helmet 进阶

话题

说明

同名 meta

子级 Helmet 覆盖父级，推荐 Seo 组件一处定义

`html lang`

根组件设一次：`<Helmet htmlAttributes={{ lang: 'zh-CN' }} />`

Next.js

优先 `metadata` API，不必叠 helmet

自定义 SSR

服务端从 `HelmetProvider context` 取出 helmet 插入 HTML

### 国际化 hreflang

多语言站点用 Helmet 输出：

## 架构选型

方案

适合

SEO 效果

CSR + react-helmet

后台、强登录产品

弱

SSG / 预渲染

文档站、博客

很好

SSR

强 SEO 的 C 端

很好

动态渲染

存量 CSR 过渡

中等

**误区：** SSR 只解决「谁能读到 head」，meta 内容仍要你自己写对。

## 工程与运维

### Nginx SPA fallback

History 模式刷新子路由需 fallback，否则 404：

注意

说明

真 404

不存在的路径应 HTTP 404，别一律 200

301

换域名 / 改路径用服务端 301，别只 `navigate()`

规范域

www / 非 www、HTTP / HTTPS 只留一个

### robots.txt 与 sitemap.xml

- 别 Disallow JS/CSS，否则 Google 无法渲染。
- 动态路由用构建脚本从路由表 **自动生成 sitemap**。
- 提交 Google Search Console (https://search.google.com/search-console) 和百度站长。

### Core Web Vitals

指标

常见原因

对策

LCP

大图、慢接口、大 JS

主图优先、code splitting

INP

长任务、频繁 re-render

虚拟列表、debounce

CLS

图片无尺寸、动态 Banner

width/height、预留占位

### React 特有风险

场景

建议

`useEffect` 才渲染正文

关键内容 SSR / 预渲染

`React.lazy` 落地页

核心页可不用 lazy

无限滚动

重要列表加分页 URL

`dangerouslySetInnerHTML`

富文本 img/link 做 SEO 校验

登录墙内容

会员页 `noindex`，与公开 URL 分离

### 社交 OG 缓存

微信、Facebook 会缓存 OG。改图后需用平台调试工具刷新；上线前 OG 域名切到生产。

### 可访问性交叉项

路由切换后 `focus` 到主内容，改善体验信号。

### 持续监控

动作

频率

Search Console 覆盖率

每周

发版后 `site:` 抽查 title

发版后

404 → 301

持续

Lighthouse SEO / Performance

CI 或发版前

## 工具与清单

**控制台：**

**在线工具：**

- Google Rich Results Test (https://search.google.com/test/rich-results)
- Meta Tags Debugger (https://metatags.io/)

**完整 Checklist（上下篇合并）：**

- Seo 组件覆盖 title / description / canonical / OG / JSON-LD
- 动态页数据就绪后再渲染 Seo
- h1 / 链接 / 图片符合上篇规范
- Nginx SPA fallback + 真 404
- robots.txt、sitemap 已部署并提交
- 旧 URL 已 301
- 分页 / 搜索 URL 的 noindex 策略明确

## 常见坑（工程向）

- loading 态 title 为「加载中」被爬虫缓存
- canonical 写死 localhost
- History 模式未配 fallback
- 只用客户端 redirect，旧 URL 长期残留
- robots.txt 误拦 JS/CSS
- 404 返回 HTTP 200（软 404）
- OG 图片用相对路径
- 无 HelmetProvider 导致 title 错乱

## 延伸阅读

- react-helmet-async (https://github.com/staylor/react-helmet-async)
- Google Search Console (https://search.google.com/search-console)
- web.dev — Core Web Vitals (https://web.dev/vitals/)
