import { XStream } from '@ant-design/x-sdk';

/**
 * dev 时走 umi proxy 的 /api 前缀；构建产物由 FastAPI 挂在 /ui 下，
 * 此时接口就在同源根路径上，所以前缀为空。
 */
export const API_BASE = process.env.NODE_ENV === 'production' ? '' : '/api';

export interface Citation {
  chunk_id: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  content: string;
  score: number;
}

export interface StreamHandlers {
  onCitations?: (conversationId: string, citations: Citation[]) => void;
  onToken?: (text: string) => void;
  onDone?: (conversationId: string, messageId: string) => void;
  onError?: (detail: string) => void;
}

/**
 * 调用 SSE 流式问答。
 *
 * 后端事件：citations（先给引用）→ 若干 token → done；出错走 error。
 * XStream 负责把 ReadableStream 切成一帧帧 { event, data }。
 */
export async function streamChat(
  params: { question: string; conversationId?: string; client?: string },
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: params.question,
      conversation_id: params.conversationId,
      client: params.client ?? 'web',
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    handlers.onError?.(`请求失败：HTTP ${response.status}`);
    return;
  }

  for await (const chunk of XStream({ readableStream: response.body })) {
    // chunk 形如 { event: 'token', data: '{"text":"..."}' }
    const { event, data } = chunk as { event?: string; data?: string };
    if (!event || !data) continue;

    let payload: any;
    try {
      payload = JSON.parse(data);
    } catch {
      continue;
    }

    if (event === 'citations') {
      handlers.onCitations?.(payload.conversation_id, payload.citations ?? []);
    } else if (event === 'token') {
      handlers.onToken?.(payload.text ?? '');
    } else if (event === 'done') {
      handlers.onDone?.(payload.conversation_id, payload.message_id);
    } else if (event === 'error') {
      handlers.onError?.(payload.detail ?? '未知错误');
    }
  }
}

export interface DocumentItem {
  id: string;
  title: string;
  status: string;
  chunk_count: number;
}

export async function fetchDocuments(): Promise<DocumentItem[]> {
  const response = await fetch(`${API_BASE}/documents`);
  if (!response.ok) return [];
  return response.json();
}
