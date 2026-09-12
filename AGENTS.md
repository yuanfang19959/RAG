# 项目上下文（给 AI 助手 / 新加入的人）

## 这是什么

FastAPI + LangChain 的知识库问答（RAG）服务，作者是前端转后端，边做边学。  
**先读 `docs/路线图.md`**，里面有完整目标、分期进度和 P2/P3/P4 的需求细节。

## 作者背景（影响解释方式）

前端出身（React / Next.js / TypeScript），Python 刚入门。解释代码时：

- 多用前端类比（Express 中间件、useEffect 清理、Hook 之类）
- 后端术语先解释再用（事务、连接池、依赖注入）
- 不要假设他熟悉 Python 语法糖（装饰器、生成器、推导式）

## 怎么跑

```bash
source "$HOME/.local/bin/env"   # uv 不在默认 PATH 里，必须先执行
cd RAG
uv sync
uv run rag-init-db              # 建表，可重复执行
uv run rag                      # 起服务 :8000
```

## 关键事实

| 项 | 值 |
|----|-----|
| 数据库 | PostgreSQL 16，库名 `rag_db`，已装 pgvector 0.8.6 |
| Embedding | 硅基流动 `Pro/BAAI/bge-m3`，**1024 维** |
| LLM | DeepSeek（OpenAI 兼容），P2 开始用 |
| 密钥 | 全在 `.env`（已 gitignore），示例见 `.env.example` |

换 embedding 模型必须同步改 `src/rag/models.py` 的 `EMBEDDING_DIM` 并重建 `chunks` 表。

## 不要碰的东西

| 库 / 项目 | 原因 |
|-----------|------|
| MySQL `blog_db` | PageIo 博客的生产数据 |
| Postgres `langchain_db` | LangGraph checkpoint 学习库 |
| `~/Desktop/PageIo` | 另一个项目，P4 才通过 HTTP 接入 |
| `~/Desktop/local-agent` | 同上 |

## 开发约定

1. 每期先写需求卡（模板在 `docs/需求卡-模板与P0.md`），明确「做 / 不做 / 验收标准」
2. 开分支 `feat/pX-xxx`，验收全过再合并 main
3. 分层：`api/` 只管 HTTP 与状态码，`services/` 放业务逻辑（方便 P4 复用）
4. 错误码：400 参数、404 不存在、502 外部服务失败、503 依赖未配置
5. 代码注释用中文，解释「为什么」而不是「这行干什么」

## 环境坑

- macOS + Homebrew 装 pgvector：预编译包只有 PG 17/18，PG 16 需源码编译，且要覆盖写死的 SDK 路径（命令见 README）
- 本机 git 是 2.30，某些新参数不支持
- 追加内容到 `.env` 前先确认文件末尾有换行，否则会和最后一行粘在一起
