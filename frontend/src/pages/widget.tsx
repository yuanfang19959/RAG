import React from 'react';

import ChatView from '../components/ChatView';
import { color } from '../theme';

/**
 * 给博客用 iframe 嵌入的聊天窗。
 *
 * 和父页面的通信走 postMessage：点关闭时通知父页面收起窗口，
 * 父页面自己决定是隐藏还是卸载 iframe。
 */
export default function WidgetPage() {
  const close = () => {
    window.parent?.postMessage({ type: 'rag-widget:close' }, '*');
  };

  return (
    <div className="rag-fullheight">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          padding: '12px 16px',
          borderBottom: `1px solid ${color.border}`,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600 }}>问问这个博客</span>
        <span
          className="rag-quiet-link"
          onClick={close}
          aria-label="关闭"
          style={{ fontSize: 18, lineHeight: 1, padding: '0 2px' }}
        >
          ×
        </span>
      </div>

      <div
        className="rag-safe-bottom"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '14px 16px',
        }}
      >
        <ChatView client="pageio" />
      </div>
    </div>
  );
}
