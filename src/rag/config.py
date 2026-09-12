from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "rag"
    app_version: str = "0.1.0"
    database_url: str | None = None
    cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000"
    )

    # 上传与切块
    upload_dir: str = "uploads"
    chunk_size: int = 500
    chunk_overlap: int = 80

    # 嵌入模型（硅基流动，OpenAI 兼容接口）
    siliconflow_api_key: str | None = None
    siliconflow_base_url: str | None = None
    embedding_model: str = "Pro/BAAI/bge-m3"

    # 生成模型（DeepSeek，OpenAI 兼容接口）
    deepseek_api_key: str | None = None
    deepseek_base_url: str | None = None
    llm_model: str = "deepseek-chat"
    llm_temperature: float = 0.3
    llm_timeout: int = 60

    # 检索
    retrieval_top_k: int = 5

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
