import { Badge, Card, Space, Typography } from 'antd';
import React, { useEffect, useState } from 'react';

import { DocumentItem, fetchDocuments } from '../api';
import ChatView from '../components/ChatView';

const STATUS_COLOR: Record<string, string> = {
  ready: 'green',
  pending: 'gold',
  failed: 'red',
};

/** 调试用的完整页面：左边看知识库里有什么，右边聊天。 */
export default function HomePage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  useEffect(() => {
    fetchDocuments().then(setDocuments);
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <Typography.Title level={3} style={{ marginBottom: 4 }}>
        RAG 问答
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        回答只依据已入库的文档，答案后的编号对应下方引用原文。
      </Typography.Paragraph>

      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <Card
          title="知识库"
          size="small"
          style={{ width: 260, flexShrink: 0 }}
          styles={{ body: { padding: 8 } }}
        >
          {documents.length === 0 ? (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              还没有文档
            </Typography.Text>
          ) : (
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              {documents.map((item) => (
                <Space
                  key={item.id}
                  orientation="vertical"
                  size={2}
                  style={{ width: '100%' }}
                >
                  <Typography.Text ellipsis style={{ fontSize: 13 }}>
                    {item.title}
                  </Typography.Text>
                  <Space size={6}>
                    <Badge
                      color={STATUS_COLOR[item.status] ?? 'default'}
                      text={
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {item.status}
                        </Typography.Text>
                      }
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {`${item.chunk_count} 块`}
                    </Typography.Text>
                  </Space>
                </Space>
              ))}
            </Space>
          )}
        </Card>

        <Card
          size="small"
          style={{ flex: 1, height: 'calc(100vh - 220px)', minHeight: 420 }}
          styles={{ body: { height: '100%', padding: 16 } }}
        >
          <ChatView client="web" />
        </Card>
      </div>
    </div>
  );
}
