import React, { useState } from 'react';

import type { Citation } from '../api';
import { color } from '../theme';

export interface CitationsProps {
  citations: Citation[];
}

/**
 * 收起状态下的摘要：原文是 markdown 片段，直接截断会露出 `**` 和空行。
 * 这里只压掉排版符号，文字本身保持原样（引用要能对得上原文）。
 */
function preview(content: string): string {
  return content
    .replace(/\s+/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/g, '')
    .trim();
}

/**
 * 引用来源。默认收起成一行安静的文字，不用 Collapse 面板——
 * 面板的边框和背景会把视觉重心从答案上抢走。
 */
export default function Citations({ citations }: CitationsProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!citations.length) return null;

  const toggleItem = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ marginTop: 14 }}>
      <span
        className="rag-quiet-link"
        onClick={() => setOpen((v) => !v)}
        style={{ fontSize: 13, userSelect: 'none' }}
      >
        {open ? '收起引用' : `引用 ${citations.length} 段原文`}
      </span>

      {open && (
        <div
          style={{
            marginTop: 10,
            paddingLeft: 12,
            borderLeft: `2px solid ${color.border}`,
          }}
        >
          {citations.map((citation, index) => {
            const isOpen = expanded.has(citation.chunk_id);
            return (
              <div
                key={citation.chunk_id}
                style={{
                  paddingBottom: 10,
                  marginBottom: 10,
                  borderBottom:
                    index === citations.length - 1
                      ? 'none'
                      : `1px solid ${color.borderLight}`,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: color.textFaint,
                    marginBottom: 3,
                  }}
                >
                  <span style={{ color: color.text }}>{`[${index + 1}]`}</span>
                  {` ${citation.document_title} · 第 ${citation.chunk_index} 段 · ${citation.score}`}
                </div>
                <div
                  onClick={() => toggleItem(citation.chunk_id)}
                  style={{
                    fontSize: 13,
                    lineHeight: 1.65,
                    color: color.textMuted,
                    cursor: 'pointer',
                    // 收起时把换行压成空格，否则原文的空行会让两行截断显示成孤零零一个省略号
                    whiteSpace: isOpen ? 'pre-wrap' : 'normal',
                    wordBreak: 'break-word',
                    ...(isOpen
                      ? {}
                      : {
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical' as const,
                          overflow: 'hidden',
                        }),
                  }}
                >
                  {isOpen ? citation.content : preview(citation.content)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
