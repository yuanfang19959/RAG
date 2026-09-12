from langchain_openai import ChatOpenAI

from rag.config import Settings


def create_chat_model(settings: Settings) -> ChatOpenAI | None:
    """没配 key 就返回 None，让上层返回 503 而不是启动失败。"""
    if not (settings.deepseek_api_key and settings.deepseek_base_url):
        return None

    return ChatOpenAI(
        model=settings.llm_model,
        base_url=settings.deepseek_base_url,
        api_key=settings.deepseek_api_key,
        temperature=settings.llm_temperature,
        timeout=settings.llm_timeout,
    )
