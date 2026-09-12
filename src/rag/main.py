from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from rag.api.health import router as health_router
from rag.config import get_settings
from rag.db import create_engine


# 应用生命周期：yield 之前 = 启动时；yield 之后 = 关闭时（类似 React mount/unmount）
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- 启动 ---
    settings = get_settings()  # 读取 .env / 环境变量
    app.state.settings = settings  # 挂到全局，路由里可用 request.app.state.settings
    app.state.engine = create_engine(settings)  # 创建 Postgres 异步引擎（可能为 None）
    yield  # 这里开始对外提供服务
    # --- 关闭 ---
    engine = getattr(app.state, "engine", None)  # 安全取属性，没有就返回 None
    if engine is not None:
        await engine.dispose()  # 释放数据库连接池


def create_app() -> FastAPI:
    """工厂函数：组装 FastAPI 应用（类似 Express 里 new app + 挂中间件/路由）。"""
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,  # 注册上面的启动/关闭钩子
    )
    # 跨域：允许前端（localhost:3000 等）调本 API，类似 Express 的 cors()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # 挂载路由模块（health.py 里的 /health）
    app.include_router(health_router)

    # 装饰器注册路由：GET /  → 下面这个函数处理（类似 app.get('/', ...)）
    @app.get("/")
    async def root() -> dict:
        return {
            "service": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
            "endpoints": {
                "health": "GET /health",
            },
        }

    return app


# 模块加载时创建 app；uvicorn 用 rag.main:app 找到这个变量
app = create_app()
