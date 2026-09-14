# 从前端视角做一个 RAG 知识库问答

> 技术栈：FastAPI · LangChain · PostgreSQL + pgvector · DeepSeek · 硅基流动 Embedding · umi 4 · Ant Design X  
> 项目：RAG——一个能「基于你自己文档回答」的知识库问答服务

## 写在前面

我是一名前端，日常更熟 React、Next.js、工程化。最近招聘 JD 里 RAG、向量库、流式输出出现得很频繁——不只是「会调 ChatGPT」，还要讲清：

**文档怎么变成可检索的知识 → 提问时怎么捞出相关片段 → 再交给模型生成答案**

于是我边学 Python 边做了一个小项目：**RAG 知识库问答服务**。上传 `.md` / `.txt`，切块、向量化、入库；前端像 ChatGPT 一样流式出字，还能看到引用来源。后面打算嵌进自己的博客（PageIo），并给桌面 Agent（local-agent）当 tool。

不会我学还不行嘛，学学学！！！

这篇文章用前端能听懂的方式，把 RAG 是什么、**整体架构怎么拆**、用了什么技术、前端侧踩了哪些坑记下来。

## 先分清：普通 Chatbot ≠ RAG

| | 普通 Chatbot | RAG |
|---|---|---|
| 知识从哪来 | 模型训练时背下来的 | 你自己的文档（实时检索） |
| 典型行为 | 直接生成文字 | 先「搜资料」，再「照着答」 |
| 前端类比 | 调一个返回字符串的接口 | 先 search，再把结果塞进 prompt 调 LLM |
| 瞎编风险 | 高（自信胡说） | 低一些——prompt 里要求「资料没有就说没有」 |

RAG = **Retrieval-Augmented Generation**（检索增强生成）。

用前端话翻译：

1. **入库**：把文档切成小块，每块算一个「语义指纹」（embedding 向量），存进向量库——类似给文章建可语义搜索的索引。
2. **提问**：用户问题也算成同样的向量，在库里找最像的 Top-K 块。
3. **生成**：把这些块拼进 prompt，交给 LLM，让它**只依据资料**回答，并标出引用。

模型本身不「记住」你的文档；它每次回答前都先「查库」。这和 Agent 调 tool 读文件有点像，只不过这里的 tool 是**向量检索**，不是 `read_file`。

## 为什么要单独做一套 RAG 服务？

我已经有：

- **PageIo**：Next.js 博客
- **local-agent**：Electron 桌面助手

两者都需要「问我自己的文章 / 笔记」。如果把 LangChain 直接塞进博客或 Electron：

- 依赖重、Python / Node 混在一起难维护
- 两个客户端会重复实现同一套入库与检索

本仓只做 **RAG 服务本体 + 可选调试前端**，不把 LangChain 塞进博客或 Agent。接口稳定后再接入——和「先抽公共 BFF，再让多个前端调」是一个思路。下面把架构摊开讲。

## 整体架构

可以把整个系统想成三层：**多个客户端 → 一套 RAG API → 存储 + 外部模型**。  
客户端只负责 UI 和 SSE；检索、切块、调模型全在 RAG 服务里——前端同学熟悉的「BFF / 中台」味道。

### 1. 系统全景（谁调谁）

```text
┌─────────────────────────────────────────────────────────┐
│  客户端（只调 HTTP / SSE）                                │
│  · umi 调试前端（全页 /ui · 挂件 /ui/#/widget）            │
│  · PageIo 博客（iframe 嵌挂件）                           │
│  · local-agent（Electron tool）                          │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP / SSE
                           ▼
┌─────────────────────────────────────────────────────────┐
│  RAG 服务 :8000（本仓）                                   │
│  FastAPI api/  ──►  services/（入库 · 检索 · 问答编排）    │
└───────┬─────────────┬──────────────┬────────────┬───────┘
        │             │              │            │
        ▼             ▼              ▼            ▼
   PostgreSQL    硅基流动         DeepSeek     本地上传文件
   rag_db        Embedding       Chat         .md / .txt
   + pgvector    bge-m3 1024维   OpenAI 兼容
```

几个边界故意画清楚：

| 边界 | 为什么 |
|---|---|
| 博客 / Agent **不**直接连 Postgres | 向量检索和 prompt 编排集中在一处，改一次全端受益 |
| 博客库 `blog_db`（MySQL）**不动** | 同步文章是 P4 的事；现在知识源是手动上传 |
| Embedding / LLM 都走 **OpenAI 兼容 HTTP** | 换厂商主要改 `base_url` + key，服务内部接口不用跟着改 |

`conversations.client` 字段会记 `web` / `pageio` / `electron`，方便以后按来源看用量——类似埋点里的 `source`。

### 2. 仓内分层（像前端拆 pages / hooks / api）

后端目录不是「一锅粥写在 route 里」，而是刻意拆成和前端类似的层次：

```text
api/          ≈ pages + route handlers
  health · documents · chat/search · conversations
        │
        ▼
services/     ≈ hooks + 业务逻辑
  ingest（读文件→切块→embedding→写库）
  retrieval（问题向量化→Top-K）
  chat（拼 prompt→调 LLM→流式）
  embedding / llm（客户端工厂）
        │
        ▼
持久化        ≈ Prisma schema
  models.py（表） · schemas.py（请求响应） · db.py（引擎/会话）
```

| 目录 | 职责 | 前端类比 |
|---|---|---|
| `api/` | 解析请求、选状态码、调 service | 路由组件 + `loader`，不写业务细节 |
| `services/` | 入库、检索、prompt、流式编排 | 可复用的 hooks / domain 函数 |
| `models` + `schemas` | 表结构 / JSON 形状 | Prisma schema + zod |
| `main.py` | 组装 app、CORS、挂载 `/ui` 静态资源 | `app.tsx` + 静态资源托管 |

这样拆的直接好处：**P4 接 local-agent 时**，Agent 调的还是同一套 `services/`，不用复制一份切块和检索逻辑。

应用生命周期也和 React 很像：`lifespan` 里启动时建引擎 / embedding / LLM 客户端，关闭时 `dispose` 连接池——对应 mount 时初始化、unmount 时清理。

### 3. 数据模型（四张表）

知识库和聊天会话分开存，前端可以想成「文档库」+「会话列表」两套状态：

```text
documents 1 ─── * chunks
  id, title, status(pending/ready/failed), source_type, file_path
                 └── chunk_index, content, embedding vector(1024)

conversations 1 ─── * messages
  id, title, client(web/pageio/electron), external_uid?
                 └── role(user/assistant), content, citations(JSONB)
```

要点：

- **`chunks.embedding`**：真正被检索的是块，不是整篇文档；上面挂 HNSW 余弦索引，类似给语义字段建了专用索引。
- **`messages.citations`**：JSON 快照。刷新页面还原历史时，引用还在，不必重新检索。
- **system prompt 不进 `messages`**：每次请求由代码拼，改提示词不用迁库（配置放代码里，不放 localStorage 的那种思路）。

### 4. 一次流式问答的时序

用户在聊天框点发送之后，链路大概是这样（前端最该关心事件顺序）：

```text
前端 useRagChat                FastAPI /chat/stream         外部依赖
      │                              │
      │  POST {question, conv_id?}   │
      │─────────────────────────────►│
      │                              ├──► Embedding：问题 → 向量
      │                              ├──► pgvector：余弦 Top-K（ready）
      │  event: citations（先推引用） │
      │◄─────────────────────────────│
      │                              ├──► DeepSeek astream(...)
      │  event: token  × N           │◄── 每个文本片段
      │◄─────────────────────────────│
      │                              ├──► 写入 user / assistant 消息
      │  event: done (ids)           │
      │◄─────────────────────────────│
      │
      └── token 进缓冲，rAF 打字机渲染
```

为什么 **citations 先于 token**？  
检索往往比生成快；UI 可以先展开「来自哪些文档」，再看字一个个出来——体感上更像「有据可查」，而不是盲等。

### 5. 部署形态（和博客怎么拼在一起）

线上和博客同机，**安全组不开 8000**，Nginx 把主域上的几条路径反代到本机 FastAPI：

```text
浏览器
  │
  ▼
Nginx  www.yuanfang19959.icu
  ├── /          → PageIo Next    :3000
  ├── /api/      → PageIo Express :3002
  └── /ui/ + /chat|/documents|… → RAG FastAPI :8000 (pm2)
                                      │
                                      ├──► Postgres rag_db
                                      ▲
博客页面 ──iframe src=/ui/#/widget────┘（同源，不跨域）
```

| 路径 | 落到哪 |
|---|---|
| `/` | 博客 Next |
| `/api/` | 博客 Express（**别和 RAG 抢**） |
| `/ui/` + `/chat` `/documents` `/conversations`… | RAG |

挂件在 iframe 里请求的是**同源**根路径上的 API，所以不用 CORS；开发时则是 umi `proxy`：`8001/api/*` → `8000/*`。  
SSE 必须在 Nginx 关掉 `proxy_buffering`，否则「流式」会变成一次性蹦出来——部署层和前端体验绑在一起。

---

## 技术选型（以及为什么这么选）

| 层 | 选择 | 前端类比 / 备注 |
|---|---|---|
| Web 框架 | FastAPI | 像 Express，但异步更舒服；自带 `/docs` 可当 Postman |
| 包管理 | uv | 比 pip + venv 爽，接近 pnpm 的体感 |
| ORM | SQLAlchemy 2.0（async） | 类似 Prisma / TypeORM，不过是 Python |
| 数据库 | PostgreSQL 16 + **pgvector** | 普通关系库 + 向量列；不用单独上专用向量库也能起步 |
| 切块 | LangChain `RecursiveCharacterTextSplitter` | 长文切成带 overlap 的 chunk，避免一句话被拦腰斩断 |
| Embedding | 硅基流动 `Pro/BAAI/bge-m3`（1024 维） | OpenAI 兼容接口，换 base_url 就能用 |
| LLM | DeepSeek（`deepseek-chat`） | 同样 OpenAI 兼容，前端视角就是换个 endpoint |
| 前端 | umi 4 + **antd 6** + **Ant Design X** | X 的 peer 要求 antd 6；博客还是 antd 5，所以用 iframe 隔离 |

换 embedding 模型要注意：维度变了，`chunks` 表的 `vector(N)` 要一起改并重建——不是改个环境变量就完事。

## 整条链路长什么样？

一次「从上传到回答」，可以想成流水线：

```
上传 .md/.txt
  → 切块（chunk_size + overlap）
  → 每块算 embedding（1024 维）
  → 写入 documents / chunks（status: pending → ready）
  → 用户提问
  → 问题也 embedding
  → pgvector 余弦距离 Top-K
  → 拼 system prompt + 参考资料 + 历史轮次
  → DeepSeek 流式生成
  → 前端 SSE 收 token，打字机渲染 + 展示 citations
```

### 入库（Ingest）

对应接口：

- `POST /documents`：上传文件，先落盘，status = `pending`
- `POST /documents/{id}/ingest`：切块 + 向量化，幂等；成功变 `ready`

切块为什么要 **overlap**？  
想象把一篇博客按字数硬切：边界正好落在一句中间，检索时两边都「缺半句」。overlap 让相邻块有重叠，语义更完整——有点像图片切块时留一点 padding。

### 检索（Retrieval）

调试时强烈建议先打：

```bash
curl -s -G --data-urlencode "q=这个项目用什么数据库" \
  http://127.0.0.1:8000/search
```

只检索、不调 LLM，能先确认「库里到底捞没捞到相关块」。  
相似度用余弦距离（pgvector 的 `<=>`），距离越小越相似；前端展示的 score 可以是 `1 - distance`。

### 问答（Chat）

- `POST /chat`：一次性返回 `answer` + `citations`
- `POST /chat/stream`：SSE 流式，事件顺序大致是：

| 事件 | 含义 |
|---|---|
| `citations` | 先把引用推过去（检索比生成快，UI 可以先展示来源） |
| `token` | 每个文本片段 |
| `done` | 结束，带 conversation / message id |
| `error` | 出错 |

多轮追问：带上上一轮的 `conversation_id`，后端把最近几轮拼进 prompt。  
system prompt **不入库**——每次由代码拼，改提示词不用迁数据（有点像前端把 system 配置放代码里，而不是写进 localStorage）。

## 前端视角：我真正写的部分

后端用 Python 学，前端我熟，所以调试页和挂件是自己做的。

### 技术栈与页面

- **umi 4**：路由 + 构建；hash 路由，方便挂在 `/ui` 子路径下
- **Ant Design X**：气泡、发送框等聊天 UI
- **`@ant-design/x-sdk` 的 `XStream`**：把 `ReadableStream` 切成一帧帧 `{ event, data }`

两个页面：

| 路由 | 用途 |
|---|---|
| `/` | 全页问答，左侧可看知识库文档 |
| `/#/widget` | 精简挂件，给博客 iframe 嵌入 |

dev 时前端跑在 **8001**（umi 默认也是 8000，会和 FastAPI 撞车），通过 proxy 把 `/api` 转到后端。  
生产构建产物丢到 `static/ui`，由 FastAPI 挂在 `/ui`，和 API **同源**——iframe 里不用折腾 CORS。

### SSE 流式：比普通 fetch 多想一层

普通接口：`await res.json()`，等整包。  
流式：`response.body` 是 ReadableStream，要边收边渲染。

伪代码心智模型：

```ts
const res = await fetch('/chat/stream', { method: 'POST', body: ... });
for await (const chunk of XStream({ readableStream: res.body })) {
  if (chunk.event === 'citations') /* 先展示引用 */;
  if (chunk.event === 'token') /* 往气泡里追加字 */;
  if (chunk.event === 'done') /* 收尾、记下 conversation_id */;
}
```

还有一个体感问题：**模型吐字太快**。实测可能一秒一百多个 token，直接 `setState` 等于整段瞬间出现，根本没有「打字」感。

做法：token 先进缓冲队列，再用 `requestAnimationFrame` 按帧匀速往 UI 上贴——积压多时每帧多吐一点，空了且流结束才把 loading 关掉。  
卸载时 `cancelAnimationFrame`，和 `useEffect` 里清定时器同理。

### 为什么嵌博客要用 iframe？

博客是 **antd 5**，Ant Design X 要 **antd 6**，同仓会打架。  
iframe 的好处：

- 样式与依赖完全隔离
- 聊天应用可独立部署、独立更新
- 同源反代后，挂件里请求 `/chat/stream` 不跨域

代价：父子页靠 `postMessage` 同步主题等；Nginx 要对 SSE 关掉 `proxy_buffering`，否则流式会被攒成一坨一次性吐出来——线上必踩。

## 分层与错误码（约定备忘）

分层细节见上文「仓内分层」。这里只记错误码约定：

- **400** 参数或文件不合法
- **404** 文档不存在
- **502** 外部服务（embedding / LLM）失败
- **503** 依赖未配置（比如没填 key）

`/health`：进程活着就 200，数据库状态单独放在 `db` 字段——探活和依赖健康拆开，前端或运维好判断。

## 我学到的几件事

1. **RAG 的核心不是「会调 LLM」**，是「检索质量」。先把 `/search` 调通，再谈生成。
2. **OpenAI 兼容接口是胶水**：Embedding 和 Chat 都可以换厂商，前端 / 后端都是换 `base_url` + key。
3. **流式体验一半在后端一半在前端**：SSE 协议要对；前端还要自己做打字机缓冲，否则「流式」看起来像整段闪现。
4. **iframe 是依赖隔离的实用解法**：antd 大版本冲突时，不必硬融进博客 monorepo。
5. **Python 入门可以靠前端类比**：依赖注入 ≈ 中间件里注入的 ctx；异步生成器 ≈ 边读流边 yield；事务 ≈ 一次要成功或一起回滚的写操作。

## 当前进度与下一步

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | 服务骨架 + `/health` + 建库 | ✅ |
| P1 | 上传 → 切块 → embedding → 入库 | ✅ |
| P2 | 检索 + 非流式 `/chat` + 引用 | ✅ |
| P3 | SSE `/chat/stream` + 会话历史 + umi 前端 | ✅ |
| P4 | 鉴权、博客文章同步、接 PageIo / local-agent | ⬜ |

P4 之后，博客里点「问这篇文章」、Agent 里加一个 `ask_knowledge_base` tool，打的都是同一套 API——这才是当初拆成独立服务的意义。

## 小结

RAG 听起来玄，拆开就是：

**切块建索引 → 提问时语义检索 → 把资料塞进 prompt → 流式返回答案和引用。**

对前端来说，最熟的部分是：SSE 消费、打字机体验、同源部署、iframe 嵌入；后端那半边用 FastAPI + pgvector + LangChain 拼起来，OpenAI 兼容协议降低了换模型的成本。

如果你也是前端转着学后端，不妨先做一个「能上传自己笔记再提问」的最小闭环——比空看概念扎实得多。

---

仓库与接口说明见项目 README；分期细节见 `docs/路线图.md`。
