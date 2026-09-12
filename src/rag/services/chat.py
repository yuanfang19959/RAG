from collections.abc import AsyncIterator

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from sqlalchemy.ext.asyncio import AsyncSession

from rag.models import Message
from rag.services.retrieval import SearchHit, has_indexed_content, search

EMPTY_KB_ANSWER = "知识库还没有内容，先上传文档并执行 ingest 之后再来问我。"

# 带进 prompt 的历史消息条数（3 轮问答）；太多会挤掉参考资料
MAX_HISTORY_MESSAGES = 6

SYSTEM_PROMPT = """你是一个知识库问答助手。请严格按下面的要求回答：

1. 只依据「参考资料」里的内容回答，不要使用资料之外的知识。
2. 如果资料里没有相关信息，直接说「资料里没有提到这一点」，不要编造。
3. 引用了某段资料时，在句末标注它的编号，例如 [1]。
4. 用中文回答，简洁清楚，不要重复问题。"""


def build_context(hits: list[SearchHit]) -> str:
    """把检索到的片段拼成带编号的参考资料，编号与 citations 顺序一致。"""
    blocks = [
        f"[{index}] 来自《{hit.document.title}》第 {hit.chunk.chunk_index} 段\n"
        f"{hit.chunk.content}"
        for index, hit in enumerate(hits, start=1)
    ]
    return "\n\n".join(blocks)


def build_messages(
    question: str,
    hits: list[SearchHit],
    history: list[Message] | None = None,
) -> list[tuple[str, str]]:
    """系统提示 + 最近几轮对话 + 本轮（参考资料 + 问题）。"""
    messages: list[tuple[str, str]] = [("system", SYSTEM_PROMPT)]

    for message in (history or [])[-MAX_HISTORY_MESSAGES:]:
        messages.append((message.role, message.content))

    messages.append(
        ("user", f"参考资料：\n\n{build_context(hits)}\n\n问题：{question}")
    )
    return messages


def _text_of(content) -> str:
    """模型返回可能是字符串，也可能是分段列表。"""
    if isinstance(content, str):
        return content
    return "".join(str(part) for part in content)


async def answer_question(
    session: AsyncSession,
    embeddings: OpenAIEmbeddings,
    llm: ChatOpenAI,
    question: str,
    top_k: int,
    history: list[Message] | None = None,
) -> tuple[str, list[SearchHit]]:
    """非流式：检索 + 生成，返回（答案，命中片段）。"""
    hits = await retrieve(session, embeddings, question, top_k)
    if not hits:
        return EMPTY_KB_ANSWER, []

    response = await llm.ainvoke(build_messages(question, hits, history))
    return _text_of(response.content).strip(), hits


async def retrieve(
    session: AsyncSession,
    embeddings: OpenAIEmbeddings,
    question: str,
    top_k: int,
) -> list[SearchHit]:
    """检索，库里没有可用内容时返回空列表（上层据此跳过 LLM）。"""
    if not await has_indexed_content(session):
        return []
    return await search(session, embeddings, question, top_k)


async def stream_answer(
    llm: ChatOpenAI,
    question: str,
    hits: list[SearchHit],
    history: list[Message] | None = None,
) -> AsyncIterator[str]:
    """流式：逐段产出模型输出的文本。检索结果由调用方先准备好。"""
    async for chunk in llm.astream(build_messages(question, hits, history)):
        text = _text_of(chunk.content)
        if text:
            yield text
