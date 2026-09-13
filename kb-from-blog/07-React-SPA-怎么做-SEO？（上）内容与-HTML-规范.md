# React SPA 怎么做 SEO？（上）内容与 HTML 规范

- 来源: https://www.yuanfang19959.icu/blog/1781012840807
- 分类: 前端开发
- 作者: 15267081012
- 日期: 2026-06-08
- 标签: seo

> react seo

用 React 搭单页应用很顺手，但上线后常遇到：Google 搜不到、百度收录差、分享链接没有标题和预览图。

根因往往不在 React 本身，而在 **爬虫读到的 HTML 不完整**——缺 meta、标题层级乱、链接和图片不规范。上篇聚焦 **「页面该有什么内容、HTML 该怎么写」**；下篇讲如何用 **react-helmet** 管理 head，以及部署、监控等工程实践。

## SPA 的 SEO 困境

React SPA 默认 **客户端渲染（CSR）**：

访问者

可能的结果

普通浏览器

正常

Googlebot

收录延迟，首抓可能缺 meta

百度等爬虫

可能只看到空壳

微信 / Slack

分享无标题、无图

无论最终是否上 SSR，**前端都要按规范产出可被读取的元信息与正文结构**。下篇会讲架构选型；本篇先把「写什么」定清楚。

## 页面级 SEO：每个路由该有什么

### 常说的TDK：基础 meta

元素

建议

`<title>`

全站唯一，中文 ≤ 30 字，`核心关键词 - 品牌名`

`<meta name="description">`

唯一，120–160 字，自然写

`<link rel="canonical">`

标准 URL，避免参数重复收录

`<meta name="robots">`

登录页、搜索结果页用 `noindex,nofollow`

`<html lang="zh-CN">`

根布局设一次

### Open Graph（分享卡片）

- `og:image` 必须 **绝对 HTTPS URL**，建议 1200×630。
- `og:url` 与 `canonical` 保持一致。

### JSON-LD 结构化数据

- 一页一种主类型；字段与可见内容一致。
- 动态页等数据到了再注入，loading 态别写占位 meta（下篇 Seo 组件会细讲）。

## 正文 HTML 规范：h1、`<a>`、`<img>`

### 标题 h1 ~ h6

规则

说明

每页一个 h1

与 title 语义一致

不跳级

h2 后直接 h3，别接 h4

标题不当样式

装饰性文字用 `<p>`，别滥用 h4

组件库

Ant Design `Title level={1}` 即 h1，别出现多个

### 链接 `<a>`

爬虫靠 `<a href>` 发现 URL。React 里别全用 `div + onClick`。

场景

写法

站内

`<Link to="...">` 或 `<a href="...">`

站外

`<a href="https://...">`

纯 UI 切换

`<button>`

`target="_blank"`** 必须配 rel：**

rel

作用

`noopener`

防 Tabnabbing

`noreferrer`

不发送 Referer，现代浏览器常隐含 noopener

`nofollow`

单链不传递权重

`sponsored` / `ugc`

广告 / 用户内容链接

链接文案用描述性文字（`查看 React 性能指南`），别写「点击这里」。

### 图片 `<img>`

属性

说明

`alt`

语义图必填；装饰图 `alt=""`

`width` / `height`

防 CLS

`loading`

首屏 LCP 图不 lazy，其余 `lazy`

`srcset` + `sizes`

响应式别加载过大图

- 文件名语义化：`react-code-splitting.webp`。
- 信息图用 `<img>`，别用 `background-image`（无 alt）。
- 可选 `<figure>` + `<figcaption>` 作说明，不替代 alt。

### 语义标签与 URL

标签

用途

`<main>`

主内容，每页一个

`<nav>`

导航，配合真实 href

`<article>`

独立内容单元

- 路由用 **History 模式**（`/blog/post`），少用 Hash（`#/blog/post`）。
- 路径语义化：`/blog/react-performance` 优于 `/p?id=42`。

## 内容结构与内链

### 面包屑

配合 `BreadcrumbList` JSON-LD（字段与可见面包屑一致）。

### 内链原则

- 重要页从首页 **3 次点击内** 可达。
- 相关文章用 `<Link>` 互链，别只靠「加载更多」。
- 新页至少有一条内链指向它。

### 分页 / 筛选 / 搜索 URL

## 本篇自测清单

- 每路由唯一 title + description + canonical
- OG 三件套完整，og:image 为绝对 URL
- 仅一个 h1，层级不跳级
- 站内 `<Link>` / `<a href>`，无纯 div 导航
- 站外 `target="_blank"` 带 `noopener noreferrer`
- 图片 alt 准确，LCP 图有宽高、不 lazy
- 登录页 / 404 / 站内搜索 noindex
- 分页 / 筛选 URL 策略明确

## 本篇常见坑

- 全站同一个 title / description
- 用 div 代替链接和标题
- 站外链接不加 rel
- 图片缺 alt 或全写 `alt="图片"`
- 重要正文在 Canvas / 纯图片里
- 用 CSS 隐藏堆关键词
- 无限滚动无分页 URL，深层内容无法收录

## 小结

上篇解决 **「写什么」**：

- **Meta 层**：title、description、canonical、OG、JSON-LD
- **结构层**：h1 唯一、语义标签、URL 设计
- **元素层**：`<a>` 可爬且安全，`<img>` alt 与性能兼顾

这些字段在 React 里不会自动出现——下篇讲如何用 **react-helmet-async** 封装 Seo 组件、配 Nginx fallback、sitemap 和监控。

## 延伸阅读

- Google：JavaScript SEO 基础 (https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- Open Graph Protocol (https://ogp.me/)
- Schema.org (https://schema.org/)
