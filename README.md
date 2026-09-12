# RAG

FastAPI + LangChain 知识库问答服务（学习项目）。接口成熟后可接到 PageIo / local-agent。

## 当前阶段：P0 骨架

- `GET /health` 探活（进程 ok 即 200；`db` 字段单独标库状态）
- CORS / `.env` 配置
- Postgres 库：`rag_db`（表结构从 P1 开始）

## 环境要求

- Python >= 3.13
- [uv](https://docs.astral.sh/uv/)
- PostgreSQL 16（本机已有即可）

## 快速开始

```bash
# 若 uv 不在 PATH
source "$HOME/.local/bin/env"

cd RAG
cp .env.example .env   # 首次
uv sync
uv run rag
# 等价：uv run uvicorn rag.main:app --reload --port 8000
```

打开：

- 探活：http://127.0.0.1:8000/health
- 文档：http://127.0.0.1:8000/docs

```bash
curl -s http://127.0.0.1:8000/health
```

期望示例：

```json
{
  "status": "ok",
  "service": "rag",
  "version": "0.1.0",
  "db": "ok",
  "db_detail": null
}
```

约定：进程正常就返回 HTTP 200；数据库问题只体现在 `db` 字段（`ok` / `error` / `not_configured`）。

## 目录

```text
src/rag/
  main.py       # FastAPI 入口
  config.py     # 读取 .env
  db.py         # 异步引擎 / 探活
  api/health.py # /health
docs/           # 需求卡与规划
```

## 数据库边界

| 库 | 说明 |
|----|------|
| `rag_db`（Postgres） | 本项目专用 |
| `blog_db`（MySQL） | PageIo，不动 |
| `langchain_db`（Postgres） | 学习 checkpoint，不动 |

## 下一步（P1）

上传文档 → 切块 → embedding → `documents` / `chunks` 表。  
（向量检索需 pgvector；本机若尚未装上扩展，P1 开始前再处理。）
