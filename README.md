# RAG

FastAPI + LangChain 知识库问答服务（学习项目）。接口成熟后可接到 PageIo / local-agent。

## 当前阶段：P3 流式问答 + 聊天前端

- `GET /health` 探活（进程 ok 即 200；`db` 字段单独标库状态）
- `POST /documents` 上传 `.txt` / `.md`
- `POST /documents/{id}/ingest` 切块 + 向量化（幂等）
- `GET /documents`、`GET /documents/{id}` 列表与详情
- `GET /search` 只做向量检索（调试用）
- `POST /chat` 检索 + 生成，一次性返回
- `POST /chat/stream` SSE 流式问答，支持多轮追问
- `GET /conversations`、`GET /conversations/{id}`、`DELETE /conversations/{id}` 会话历史
- `GET /ui/` umi + Ant Design X 聊天页（需先构建前端）

## 环境要求

- Python >= 3.13、[uv](https://docs.astral.sh/uv/)
- PostgreSQL 16 + [pgvector](https://github.com/pgvector/pgvector)
- 一个 OpenAI 兼容的 embedding 服务（当前用硅基流动 `Pro/BAAI/bge-m3`，1024 维）
- 前端另需 Node >= 18 与 pnpm

## 快速开始

```bash
# 若 uv 不在 PATH
source "$HOME/.local/bin/env"

cd RAG
cp .env.example .env   # 首次：填数据库与 embedding key
uv sync
uv run rag-init-db     # 建表（可重复执行）
uv run rag             # 等价：uv run uvicorn rag.main:app --reload --port 8000
```

打开 http://127.0.0.1:8000/docs 可以直接在网页上试接口。

## 前端

```bash
cd frontend
pnpm install

# 开发：前端 8001，API 请求经 /api 代理到后端 8000
PORT=8001 pnpm dev

# 构建：产物到 ../static/ui，由 FastAPI 挂在 /ui 下（与 API 同源）
pnpm build
```

| 页面 | 用途 |
|------|------|
| `/` | 全页问答，左侧列出知识库文档 |
| `/#/widget` | 精简挂件，给博客用 iframe 嵌入 |

构建后访问 http://127.0.0.1:8000/ui/ 。注意静态目录是在**应用启动时**挂载的，先起后端再构建的话 `/ui/` 会 404，重启后端即可。嵌入博客的做法见 [docs/嵌入博客.md](docs/嵌入博客.md)。

## 试一遍全流程

```bash
curl -s http://127.0.0.1:8000/health

# 上传（返回 id，status=pending）
curl -s -F "file=@README.md" http://127.0.0.1:8000/documents

# 切块 + 向量化（status 变 ready）
curl -s -X POST http://127.0.0.1:8000/documents/<id>/ingest

curl -s http://127.0.0.1:8000/documents

# 只看检索结果（中文参数要 urlencode，否则检索质量会变差）
curl -s -G --data-urlencode "q=这个项目用什么数据库" http://127.0.0.1:8000/search

# 完整问答
curl -s -X POST http://127.0.0.1:8000/chat \
  -H 'Content-Type: application/json' \
  -d '{"question":"这个项目用什么数据库？"}'

# 流式问答（-N 关掉 curl 缓冲才看得到逐字输出）
curl -N -s -X POST http://127.0.0.1:8000/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"question":"这个项目用什么数据库？"}'

# 带上一轮返回的 conversation_id 就是追问
curl -N -s -X POST http://127.0.0.1:8000/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"question":"为什么这么选？","conversation_id":"<id>"}'

curl -s http://127.0.0.1:8000/conversations
```

`/chat/stream` 的 SSE 事件顺序：`citations`（先给引用，检索比生成快）→ 若干 `token` → `done`；出错发 `error`。

约定：进程正常就返回 HTTP 200；数据库问题只体现在 `/health` 的 `db` 字段（`ok` / `error` / `not_configured`）。

错误码：400 参数或文件不合法、404 文档不存在、502 向量化失败、503 依赖未配置。

## 目录

```text
src/rag/
  main.py             # FastAPI 入口
  config.py           # 读取 .env
  db.py               # 异步引擎 / 会话依赖 / 探活
  models.py           # documents、chunks（含 vector 列）、conversations、messages
  schemas.py          # 请求响应结构
  api/health.py       # /health
  api/documents.py    # /documents
  api/chat.py         # /search、/chat、/chat/stream
  api/conversations.py   # /conversations
  services/embedding.py  # embedding 客户端
  services/ingest.py     # 读文件 → 切块 → 算向量 → 写库
  services/retrieval.py  # 向量检索（pgvector 余弦 Top-K）
  services/llm.py        # DeepSeek 客户端
  services/chat.py       # prompt 组装 + 问答编排（含流式）
  scripts/init_db.py     # 建表：uv run rag-init-db
frontend/             # umi + Ant Design X 聊天前端
  src/api.ts             # SSE 客户端（XStream 解析事件）
  src/useRagChat.ts      # 消息状态 + 流式拼接
  src/components/ChatView.tsx  # 气泡列表 + 输入框 + 引用折叠
  src/pages/index.tsx    # 全页
  src/pages/widget.tsx   # iframe 挂件
docs/                 # 需求卡与规划
```

## 数据库

库：`rag_db`（PostgreSQL + pgvector）

| 表 | 作用 |
|----|------|
| `documents` | 知识源元信息与入库状态（`pending` / `ready` / `failed`） |
| `chunks` | 切块正文 + `embedding vector(1024)`，带 HNSW 余弦索引 |
| `conversations` | 会话，`client` 区分来源（web / pageio / electron） |
| `messages` | 消息，assistant 的引用以 JSONB 快照存在 `citations` |

与其他库的边界：

| 库 | 说明 |
|----|------|
| `rag_db`（Postgres） | 本项目专用 |
| `blog_db`（MySQL） | PageIo，不动 |
| `langchain_db`（Postgres） | 学习 checkpoint，不动 |

换 embedding 模型要同步改 `models.py` 里的 `EMBEDDING_DIM` 并重建 `chunks` 表。

## pgvector 安装备注（macOS + Homebrew）

`brew install pgvector` 的预编译包只对应 PG 17/18。本机是 PG 16，需要源码编译，而 Homebrew 的 `Makefile.global` 里写死了一个不存在的 SDK 路径，需在命令行覆盖：

```bash
git clone --branch v0.8.6 --depth 1 https://github.com/pgvector/pgvector.git
cd pgvector
export PATH="/usr/local/opt/postgresql@16/bin:$PATH"
make PG_SYSROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk
make PG_SYSROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk install
```

## 规划与文档

| 文件 | 内容 |
|------|------|
| [docs/路线图.md](docs/路线图.md) | 总纲：目标、技术选型、P0–P4 进度与后续需求细节 |
| [docs/需求卡-模板与P0.md](docs/需求卡-模板与P0.md) | 需求卡模板 + P0 实例 |
| [docs/需求卡-P1.md](docs/需求卡-P1.md) | P1 文档入库 |
| [docs/需求卡-P2.md](docs/需求卡-P2.md) | P2 检索问答 |
| [docs/需求卡-P3.md](docs/需求卡-P3.md) | P3 流式问答 + 聊天前端 |
| [docs/嵌入博客.md](docs/嵌入博客.md) | iframe 挂件接入 PageIo 的代码与部署注意点 |
| [AGENTS.md](AGENTS.md) | 项目上下文速览 |

## 下一步（P4）

对外开放：鉴权与限流、博客文章同步进知识库、接 local-agent。详见路线图。
