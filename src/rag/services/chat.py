from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from sqlalchemy.ext.asyncio import AsyncSession

from rag.services.retrieval import SearchHit, has_indexed_content, search

EMPTY_KB_ANSWER = "知识库还没有内容，先上传文档并执行 ingest 之后再来问我。"

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


async def answer_question(
    session: AsyncSession,
    embeddings: OpenAIEmbeddings,
    llm: ChatOpenAI,
    question: str,
    top_k: int,
) -> tuple[str, list[SearchHit]]:
    """检索 + 生成，返回（答案，命中片段）。"""
    if not await has_indexed_content(session):
        return EMPTY_KB_ANSWER, []

    hits = await search(session, embeddings, question, top_k)
    if not hits:
        return EMPTY_KB_ANSWER, []

    messages = [
        ("system", SYSTEM_PROMPT),
        (
            "user",
            f"参考资料：\n\n{build_context(hits)}\n\n问题：{question}",
        ),
    ]
    response = await llm.ainvoke(messages)

    # content 可能是字符串，也可能是分段列表（取决于模型返回）
    answer = (
        response.content
        if isinstance(response.content, str)
        else "".join(str(part) for part in response.content)
    )
    return answer.strip(), hits
