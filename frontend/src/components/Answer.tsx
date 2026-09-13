import { CodeHighlighter } from '@ant-design/x';
import XMarkdown, { type ComponentProps } from '@ant-design/x-markdown';
import { Popover } from 'antd';
import React, { useMemo } from 'react';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

import type { Citation } from '../api';
import { color } from '../theme';
import { displayTitle } from './Citations';

/** CodeHighlighter 默认 oneLight，这里换成深色；margin 清掉避免和外壳双重间距 */
const darkPrism = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    margin: 0,
    background: 'transparent',
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: 'transparent',
  },
};

const darkCodeStyles = {
  root: {
    background: '#282c34',
    borderRadius: 8,
    overflow: 'hidden' as const,
  },
  header: {
    background: '#21252b',
    color: 'rgba(255,255,255,0.55)',
  },
  headerTitle: {
    color: 'rgba(255,255,255,0.55)',
  },
  code: {
    background: '#282c34',
    borderColor: '#21252b',
  },
};

export interface AnswerProps {
  content: string;
  streaming?: boolean;
  citations?: Citation[];
  onCiteClick?: (index: number) => void;
}

/** LLM 常写 js/ts/sh，Prism 要的是完整语言名 */
const LANG_ALIAS: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  cs: 'csharp',
  'c++': 'cpp',
  'c#': 'csharp',
};

function normalizeLang(raw?: string): string {
  if (!raw) return '';
  const token = raw.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return LANG_ALIAS[token] || token;
}

function codeText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(codeText).join('');
  if (children == null || typeof children === 'boolean') return '';
  return String(children);
}

function MarkdownCode({ children, className, lang, block }: ComponentProps) {
  // 行内 code：打自己的 class，别依赖 `:not(pre) > code`（会被 x-markdown 默认样式盖掉）
  if (!block) {
    return (
      <code className={['rag-inline-code', className].filter(Boolean).join(' ')}>
        {children}
      </code>
    );
  }

  const text = codeText(children);
  const language =
    normalizeLang(lang) ||
    normalizeLang(className?.match(/(?:^|\s)language-([^\s]+)/)?.[1]);

  if (!language) {
    return (
      <pre className="rag-code-fallback">
        <code>{text.replace(/\n$/, '')}</code>
      </pre>
    );
  }

  return (
    <CodeHighlighter
      lang={language}
      styles={darkCodeStyles}
      highlightProps={{ style: darkPrism }}
    >
      {text}
    </CodeHighlighter>
  );
}

/** 把句末 [1] 变成可点的 markdown 链接，交给自定义 a 渲染 */
function linkifyCitations(content: string): string {
  return content.replace(/\[(\d+)\]/g, '[$1](#rag-cite-$1)');
}

function CiteMark({
  index,
  citation,
  onCiteClick,
}: {
  index: number;
  citation?: Citation;
  onCiteClick?: (index: number) => void;
}) {
  const mark = (
    <button
      type="button"
      className="rag-cite-mark"
      onClick={(e) => {
        e.preventDefault();
        onCiteClick?.(index);
      }}
    >
      {index + 1}
    </button>
  );

  if (!citation) return mark;

  return (
    <Popover
      trigger="hover"
      placement="top"
      mouseEnterDelay={0.15}
      content={
        <div className="rag-cite-pop">
          <div className="rag-cite-pop-title">
            {displayTitle(citation.document_title)}
          </div>
          <div className="rag-cite-pop-meta">{`第 ${citation.chunk_index} 段`}</div>
          <div className="rag-cite-pop-body">{citation.content}</div>
        </div>
      }
    >
      {mark}
    </Popover>
  );
}

/**
 * 回答正文。刻意不套气泡：答案通常有编号列表和代码，
 * 按文章排版比塞进对话框好读。样式在 global.less 的 .rag-answer。
 */
export default function Answer({
  content,
  streaming,
  citations = [],
  onCiteClick,
}: AnswerProps) {
  if (streaming && !content) {
    return (
      <div style={{ fontSize: 15, color: color.textFaint, lineHeight: 1.75 }}>
        正在查资料
        <span className="rag-caret" />
      </div>
    );
  }

  const rendered = useMemo(() => linkifyCitations(content), [content]);

  const components = useMemo(
    () => ({
      code: MarkdownCode,
      pre: ({ children }: ComponentProps) => <>{children}</>,
      a: ({ href, children }: ComponentProps) => {
        const match = href?.match(/^#rag-cite-(\d+)$/);
        if (match) {
          const index = Number(match[1]) - 1;
          return (
            <CiteMark
              index={index}
              citation={citations[index]}
              onCiteClick={onCiteClick}
            />
          );
        }
        return (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        );
      },
    }),
    [citations, onCiteClick],
  );

  return (
    <div className="rag-answer">
      <XMarkdown
        content={rendered}
        openLinksInNewTab
        // 关掉内置 code/pre 样式，避免和深色主题、自定义组件抢优先级
        disableDefaultStyles={['code', 'pre']}
        streaming={{ hasNextChunk: streaming }}
        components={components}
      />
      {streaming && <span className="rag-caret" />}
    </div>
  );
}
