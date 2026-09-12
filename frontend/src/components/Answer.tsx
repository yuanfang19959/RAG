import XMarkdown from '@ant-design/x-markdown';
import React from 'react';

import { color } from '../theme';

export interface AnswerProps {
  content: string;
  streaming?: boolean;
}

/**
 * 回答正文。刻意不套气泡：答案通常有编号列表和代码，
 * 按文章排版比塞进对话框好读。样式在 global.less 的 .rag-answer。
 */
export default function Answer({ content, streaming }: AnswerProps) {
  if (streaming && !content) {
    return (
      <div style={{ fontSize: 15, color: color.textFaint, lineHeight: 1.75 }}>
        正在查资料
        <span className="rag-caret" />
      </div>
    );
  }

  return (
    <div className="rag-answer">
      <XMarkdown
        content={content}
        openLinksInNewTab
        streaming={{ hasNextChunk: streaming }}
      />
      {streaming && <span className="rag-caret" />}
    </div>
  );
}
