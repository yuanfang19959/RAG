import { useCallback, useEffect, useRef, useState } from 'react';

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
 * 收到的 token 先进缓冲，再按动画帧匀速追加到它的 content 上。
 * 中间加这层缓冲是因为模型吐字太快，直接渲染会整段一起冒出来。
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

  // 打字机缓冲。模型吐字远快于人眼能跟上的速度（实测 127 个 token / 1.07 秒，
  // 约 8ms 一个，一帧就能塞进两个），直接渲染等于整段瞬间出现。
  // 所以 token 先进队列，再按动画帧匀速放出来。
  const bufferRef = useRef('');
  const frameRef = useRef<number | null>(null);
  const endedRef = useRef(false);

  const stopDrain = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  /** 每帧从缓冲取一小段贴到末尾；缓冲空了且流已结束，才算真的写完。 */
  const drain = useCallback(() => {
    if (frameRef.current !== null) return; // 已经在跑，别开第二个循环

    const step = () => {
      const buffer = bufferRef.current;

      if (!buffer) {
        frameRef.current = null;
        // 流结束不等于写完，收尾统一放在这里，光标和 loading 才不会提前消失
        if (endedRef.current) {
          patchLast((msg) => ({ ...msg, streaming: false }));
          setPending(false);
        }
        return;
      }

      // 积压越多每帧放越多，否则长回答会拖很久；至少 1 个字保证画面一直在动
      const size = Math.max(1, Math.ceil(buffer.length / 60));
      bufferRef.current = buffer.slice(size);
      patchLast((msg) => ({
        ...msg,
        content: msg.content + buffer.slice(0, size),
      }));

      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
  }, [patchLast]);

  // 卸载时别把动画帧留着，和 useEffect 里清定时器同理
  useEffect(() => stopDrain, [stopDrain]);

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

      bufferRef.current = '';
      endedRef.current = false;

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
              bufferRef.current += text;
              drain();
            },
            // done 不在这里收尾：缓冲可能还没放完，交给 drain 判断
            onError: (detail) => {
              bufferRef.current = ''; // 没显示的部分作废，直接给错误信息
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
        bufferRef.current = ''; // 取消或断网，没放完的别再往外吐
        patchLast((msg) => ({
          ...msg,
          content: msg.content || (aborted ? '已取消' : '网络异常，请重试'),
          streaming: false,
        }));
      } finally {
        // 流结束了，但 pending 要等缓冲放完才关，由 drain 收尾
        endedRef.current = true;
        drain();
        abortRef.current = null;
      }
    },
    [client, conversationId, drain, patchLast, pending],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    // 网络流可能已经收完、只剩缓冲在慢慢放，这时点停止也得立刻停住
    stopDrain();
    bufferRef.current = '';
    endedRef.current = true;
    patchLast((msg) => ({ ...msg, streaming: false }));
    setPending(false);
  }, [patchLast, stopDrain]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    stopDrain();
    bufferRef.current = '';
    endedRef.current = false;
    setMessages([]);
    setConversationId(undefined);
    setPending(false);
  }, [stopDrain]);

  return { messages, pending, conversationId, send, stop, reset };
}
