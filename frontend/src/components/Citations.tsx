import { Popover } from 'antd';
import React, { useEffect, useState } from 'react';

import type { Citation } from '../api';

export interface CitationsProps {
  citations: Citation[];
  /** 外部点了句末 [n] 时，打开对应来源 */
  activeIndex?: number | null;
  onActiveIndexChange?: (index: number | null) => void;
}

/** 上传文件名常是 `05-长假之后.md`，展示时去掉序号和后缀 */
export function displayTitle(title: string): string {
  return (
    title
      .replace(/^\d+-/, '')
      .replace(/\.md$/i, '')
      .replace(/-/g, ' ')
      .trim() || title
  );
}

function CitationPopoverBody({ citation }: { citation: Citation }) {
  return (
    <div className="rag-cite-pop">
      <div className="rag-cite-pop-title">
        {displayTitle(citation.document_title)}
      </div>
      <div className="rag-cite-pop-meta">{`第 ${citation.chunk_index} 段`}</div>
      <div className="rag-cite-pop-body">{citation.content}</div>
    </div>
  );
}

/**
 * 来源默认收起；点「来源 N」或句末编号再展开。
 */
export default function Citations({
  citations,
  activeIndex = null,
  onActiveIndexChange,
}: CitationsProps) {
  const [open, setOpen] = useState(false);

  // 点了句末编号 → 自动展开来源区
  useEffect(() => {
    if (activeIndex != null) setOpen(true);
  }, [activeIndex]);

  if (!citations.length) return null;

  return (
    <div className="rag-sources">
      <button
        type="button"
        className="rag-sources-toggle"
        onClick={() => {
          setOpen((v) => {
            if (v) onActiveIndexChange?.(null);
            return !v;
          });
        }}
      >
        {open ? '收起来源' : `来源 ${citations.length} 处`}
      </button>

      {open && (
        <ul className="rag-sources-list">
          {citations.map((citation, index) => {
            const n = index + 1;
            const active = activeIndex === index;
            return (
              <li key={citation.chunk_id}>
                <Popover
                  trigger="click"
                  placement="topLeft"
                  open={active}
                  onOpenChange={(next) =>
                    onActiveIndexChange?.(next ? index : null)
                  }
                  content={<CitationPopoverBody citation={citation} />}
                >
                  <button
                    type="button"
                    className={`rag-source-item${active ? ' is-active' : ''}`}
                  >
                    <span className="rag-source-item-n">{n}</span>
                    <span className="rag-source-item-title">
                      {displayTitle(citation.document_title)}
                    </span>
                  </button>
                </Popover>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
