import { Bubble, Sender } from '@ant-design/x';
import { Collapse, Empty, Space, Tag, Typography } from 'antd';
import React, { useEffect, useRef, useState } from 'react';

import type { Citation } from '../api';
import { ChatMessage, useRagChat } from '../useRagChat';

const SUGGESTIONS = [
  '这个知识库里有什么内容？',
  '帮我总结一下要点',
];

function Citations({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;

  return (
    <Collapse
      ghost
      size="small"
      items={[
        {
          key: 'c',
          label: (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {`引用 ${citations.length} 段原文`}
            </Typography.Text>
          ),
          children: (
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              {citations.map((citation, index) => (
                <div key={citation.chunk_id}>
                  <Space size={4} wrap>
                    <Tag>{`[${index + 1}]`}</Tag>
                    <Typography.Text strong style={{ fontSize: 12 }}>
                      {citation.document_title}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {`第 ${citation.chunk_index} 段 · 相似度 ${citation.score}`}
                    </Typography.Text>
                  </Space>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}
                    ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                  >
                    {citation.content}
                  </Typography.Paragraph>
                </div>
              ))}
            </Space>
          ),
        },
      ]}
    />
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <Bubble
      placement={isUser ? 'end' : 'start'}
      loading={message.streaming && !message.content}
      content={message.content}
      variant={isUser ? 'filled' : 'outlined'}
      footer={
        !isUser && !message.streaming && message.citations?.length ? (
          <Citations citations={message.citations} />
        ) : undefined
      }
    />
  );
}

export interface ChatViewProps {
  /** 记录来源，后端存进 conversations.client */
  client?: string;
  /** 精简模式：给 iframe 挂件用 */
  compact?: boolean;
}

export default function ChatView({ client = 'web', compact }: ChatViewProps) {
  const { messages, pending, send, stop } = useRagChat(client);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // 新消息进来滚到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        gap: 12,
        minHeight: 0,
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {messages.length === 0 ? (
          <div style={{ paddingTop: compact ? 24 : 64 }}>
            <Empty
              description="问我关于知识库里文档的问题"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
            <Space
              orientation="vertical"
              size={8}
              style={{ width: '100%', marginTop: 16, alignItems: 'center' }}
            >
              {SUGGESTIONS.map((text) => (
                <Tag
                  key={text}
                  style={{ cursor: 'pointer' }}
                  onClick={() => submit(text)}
                >
                  {text}
                </Tag>
              ))}
            </Space>
          </div>
        ) : (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </Space>
        )}
        <div ref={bottomRef} />
      </div>

      <Sender
        value={input}
        onChange={setInput}
        onSubmit={submit}
        onCancel={stop}
        loading={pending}
        placeholder="问点什么…（Enter 发送）"
      />
    </div>
  );
}
