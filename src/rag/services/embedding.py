from langchain_openai import OpenAIEmbeddings

from rag.config import Settings


def create_embeddings(settings: Settings) -> OpenAIEmbeddings | None:
    """没配 key 就返回 None，让上层返回 503 而不是启动失败。"""
    if not (settings.siliconflow_api_key and settings.siliconflow_base_url):
        return None

    return OpenAIEmbeddings(
        model=settings.embedding_model,
        base_url=settings.siliconflow_base_url,
        api_key=settings.siliconflow_api_key,
        # 非 OpenAI 官方服务：直接把文本发过去，不要先用 tiktoken 切成 token 数组
        check_embedding_ctx_length=False,
    )
