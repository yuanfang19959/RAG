import { Bubble, Sender } from '@ant-design/x';
import React, { useEffect, useRef, useState } from 'react';

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
    <Bubble
      placement="end"
      variant="filled"
      shape="corner"
      content={content}
      styles={{
        content: {
          background: '#1677ff',
          color: '#fff',
          maxWidth: '36em',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        },
      }}
    />
  );
}

function AssistantTurn({ message }: { message: ChatMessage }) {
  const [activeCite, setActiveCite] = useState<number | null>(null);

  return (
    <div>
      <Answer
        content={message.content}
        streaming={message.streaming}
        citations={message.citations}
        onCiteClick={(index) =>
          setActiveCite((prev) => (prev === index ? null : index))
        }
      />
      {!message.streaming && message.citations?.length ? (
        <Citations
          citations={message.citations}
          activeIndex={activeCite}
          onActiveIndexChange={setActiveCite}
        />
      ) : null}
    </div>
  );
}

function Turn({ message }: { message: ChatMessage }) {
  if (message.role === 'user') return <UserMessage content={message.content} />;
  return <AssistantTurn message={message} />;
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="rag-empty">
      <p className="rag-empty-lead">基于本站点博客文章做问答</p>
      <div className="rag-empty-label">试试这些</div>
      <div className="rag-empty-suggestions">
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            type="button"
            className="rag-suggest"
            onClick={() => onPick(text)}
          >
            {text}
          </button>
        ))}
      </div>
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
