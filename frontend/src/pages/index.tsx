import { Drawer } from 'antd';
import React, { useEffect, useState } from 'react';

import { DocumentItem, fetchDocuments } from '../api';
import ChatView from '../components/ChatView';
import { color } from '../theme';
import { useIsMobile } from '../useMediaQuery';

const STATUS_TEXT: Record<string, string> = {
  ready: '已入库',
  pending: '待处理',
  failed: '失败',
};

function DocumentList({ documents }: { documents: DocumentItem[] }) {
  if (!documents.length) {
    return (
      <div style={{ fontSize: 14, color: color.textFaint }}>
        还没有文档，先用 POST /documents 上传再 ingest。
      </div>
    );
  }

  return (
    <div>
      {documents.map((item, index) => (
        <div
          key={item.id}
          style={{
            padding: '12px 0',
            borderTop: index === 0 ? 'none' : `1px solid ${color.borderLight}`,
          }}
        >
          <div style={{ fontSize: 14, marginBottom: 3 }}>{item.title}</div>
          <div style={{ fontSize: 12, color: color.textFaint }}>
            {`${STATUS_TEXT[item.status] ?? item.status} · ${item.chunk_count} 段`}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchDocuments().then(setDocuments);
  }, []);

  const chunkTotal = documents.reduce((sum, d) => sum + d.chunk_count, 0);

  return (
    <div className="rag-fullheight">
      <div style={{ borderBottom: `1px solid ${color.border}`, flexShrink: 0 }}>
        <div
          className="rag-container"
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 24px',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600 }}>知识库问答</span>
          <span
            className="rag-quiet-link"
            onClick={() => setOpen(true)}
            style={{ fontSize: 13, whiteSpace: 'nowrap' }}
          >
            {`${documents.length} 篇文档 · ${chunkTotal} 段`}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div
          className="rag-container rag-safe-bottom"
          style={{ display: 'flex', flexDirection: 'column', paddingTop: 20, paddingBottom: 20 }}
        >
          <ChatView client="web" />
        </div>
      </div>

      <Drawer
        title="知识库"
        open={open}
        onClose={() => setOpen(false)}
        placement={isMobile ? 'bottom' : 'right'}
        // antd 6 用 size 统一取代 width / height，按 placement 决定作用于哪个方向
        size={isMobile ? '65%' : 360}
      >
        <DocumentList documents={documents} />
      </Drawer>
    </div>
  );
}
