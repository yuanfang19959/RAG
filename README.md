# RAG

FastAPI + LangChain 知识库问答服务（学习项目）。接口成熟后可接到 PageIo / local-agent。

## 当前阶段：P1 文档入库

- `GET /health` 探活（进程 ok 即 200；`db` 字段单独标库状态）
- `POST /documents` 上传 `.txt` / `.md`
- `POST /documents/{id}/ingest` 切块 + 向量化（幂等）
- `GET /documents`、`GET /documents/{id}` 列表与详情

检索问答（`/chat`、流式）在 P2 / P3。

## 环境要求

- Python >= 3.13、[uv](https://docs.astral.sh/uv/)
- PostgreSQL 16 + [pgvector](https://github.com/pgvector/pgvector)
- 一个 OpenAI 兼容的 embedding 服务（当前用硅基流动 `Pro/BAAI/bge-m3`，1024 维）

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

## 试一遍全流程

```bash
curl -s http://127.0.0.1:8000/health

# 上传（返回 id，status=pending）
curl -s -F "file=@README.md" http://127.0.0.1:8000/documents

# 切块 + 向量化（status 变 ready）
curl -s -X POST http://127.0.0.1:8000/documents/<id>/ingest

curl -s http://127.0.0.1:8000/documents
```

约定：进程正常就返回 HTTP 200；数据库问题只体现在 `/health` 的 `db` 字段（`ok` / `error` / `not_configured`）。

错误码：400 参数或文件不合法、404 文档不存在、502 向量化失败、503 依赖未配置。

## 目录

```text
src/rag/
  main.py             # FastAPI 入口
  config.py           # 读取 .env
  db.py               # 异步引擎 / 会话依赖 / 探活
  models.py           # documents、chunks（含 vector 列）
  schemas.py          # 请求响应结构
  api/health.py       # /health
  api/documents.py    # /documents
  services/embedding.py  # embedding 客户端
  services/ingest.py     # 读文件 → 切块 → 算向量 → 写库
  scripts/init_db.py     # 建表：uv run rag-init-db
docs/                 # 需求卡与规划
```

## 数据库

库：`rag_db`（PostgreSQL + pgvector）

| 表 | 作用 |
|----|------|
| `documents` | 知识源元信息与入库状态（`pending` / `ready` / `failed`） |
| `chunks` | 切块正文 + `embedding vector(1024)`，带 HNSW 余弦索引 |

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
| [AGENTS.md](AGENTS.md) | 项目上下文速览 |

## 下一步（P2）

检索 + 拼 prompt + 非流式 `/chat`，返回引用片段。详见路线图。
