import { CloseOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import React from 'react';

import ChatView from '../components/ChatView';

/**
 * 给博客用 iframe 嵌入的精简聊天窗。
 *
 * 和父页面的通信走 postMessage：点关闭时通知父页面收起窗口，
 * 父页面自己决定是隐藏还是卸载 iframe。
 */
export default function WidgetPage() {
  const close = () => {
    window.parent?.postMessage({ type: 'rag-widget:close' }, '*');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        padding: 12,
        boxSizing: 'border-box',
        background: 'var(--ant-color-bg-container, #fff)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Typography.Text strong>问问这个博客</Typography.Text>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={close}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <ChatView client="pageio" compact />
      </div>
    </div>
  );
}
