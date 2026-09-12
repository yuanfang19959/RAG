import { useCallback, useRef, useState } from 'react';

import { Citation, streamChat } from './api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  streaming?: boolean;
}

let seed = 0;
const nextId = () => `m${++seed}`;

/**
 * 管理一轮轮对话与流式拼接。
 *
 * 思路和普通请求的区别：发出问题后先插入一条空的 assistant 消息，
 * 然后每来一个 token 就往它的 content 上追加，界面自然就是逐字出现。
 */
export function useRagChat(client: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);

  const patchLast = useCallback((patch: (msg: ChatMessage) => ChatMessage) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[next.length - 1] = patch(next[next.length - 1]);
      return next;
    });
  }, []);

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || pending) return;

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', content: trimmed },
        { id: nextId(), role: 'assistant', content: '', streaming: true },
      ]);
      setPending(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChat(
          { question: trimmed, conversationId, client },
          {
            onCitations: (convId, citations) => {
              setConversationId(convId);
              patchLast((msg) => ({ ...msg, citations }));
            },
            onToken: (text) => {
              patchLast((msg) => ({ ...msg, content: msg.content + text }));
            },
            onDone: () => {
              patchLast((msg) => ({ ...msg, streaming: false }));
            },
            onError: (detail) => {
              patchLast((msg) => ({
                ...msg,
                content: msg.content || `出错了：${detail}`,
                streaming: false,
              }));
            },
          },
          controller.signal,
        );
      } catch (error) {
        const aborted = (error as Error)?.name === 'AbortError';
        patchLast((msg) => ({
          ...msg,
          content: msg.content || (aborted ? '已取消' : '网络异常，请重试'),
          streaming: false,
        }));
      } finally {
        setPending(false);
        abortRef.current = null;
      }
    },
    [client, conversationId, patchLast, pending],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(undefined);
  }, []);

  return { messages, pending, conversationId, send, stop, reset };
}
