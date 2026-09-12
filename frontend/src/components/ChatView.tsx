import { Sender } from '@ant-design/x';
import React, { useEffect, useRef, useState } from 'react';

import { color } from '../theme';
import { ChatMessage, useRagChat } from '../useRagChat';
import Answer from './Answer';
import Citations from './Citations';

const SUGGESTIONS = [
  '这个知识库里有什么内容？',
  '帮我总结一下要点',
  '有哪些没提到的局限？',
];

function UserMessage({ content }: { content: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div
        style={{
          maxWidth: '85%',
          padding: '9px 14px',
          fontSize: 15,
          lineHeight: 1.6,
          background: color.bgSubtle,
          borderRadius: 12,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {content}
      </div>
    </div>
  );
}

function Turn({ message }: { message: ChatMessage }) {
  if (message.role === 'user') return <UserMessage content={message.content} />;

  return (
    <div>
      <Answer content={message.content} streaming={message.streaming} />
      {!message.streaming && message.citations?.length ? (
        <Citations citations={message.citations} />
      ) : null}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ fontSize: 15, color: color.textMuted, marginBottom: 14 }}>
        回答只依据已入库的文档，句末编号可展开对照原文。
      </div>
      <div style={{ fontSize: 13, color: color.textFaint, marginBottom: 8 }}>
        试试这些
      </div>
      {SUGGESTIONS.map((text) => (
        <div
          key={text}
          className="rag-quiet-link"
          onClick={() => onPick(text)}
          style={{ fontSize: 14, lineHeight: 2, width: 'fit-content' }}
        >
          {text}
        </div>
      ))}
    </div>
  );
}

export interface ChatViewProps {
  /** 记录来源，后端存进 conversations.client */
  client?: string;
}

export default function ChatView({ client = 'web' }: ChatViewProps) {
  const { messages, pending, send, stop } = useRagChat(client);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 流式输出时内容在长，跟着滚到底
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = (value: string) => {
    send(value);
    setInput('');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      <div
        ref={scrollRef}
        className="rag-scroll"
        style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}
      >
        {messages.length === 0 ? (
          <EmptyState onPick={submit} />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
              paddingBottom: 8,
            }}
          >
            {messages.map((message) => (
              <Turn key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>

      <div style={{ paddingTop: 12 }}>
        <Sender
          value={input}
          onChange={setInput}
          onSubmit={submit}
          onCancel={stop}
          loading={pending}
          placeholder="问点什么"
        />
      </div>
    </div>
  );
}
