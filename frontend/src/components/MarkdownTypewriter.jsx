import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import TypewriterText from './TypewriterText';

export default function MarkdownTypewriter({
  source,
  enabled = true,
  speed = 50,
  by = 'word',
  sanitize,
}) {
  const defaultSanitize = (text) => {
    if (!text) return '';
    let t = String(text);
    // 移除末尾意外的 undefined（包含 $$undefined 或换行后的 undefined）
    t = t.replace(/(?:\s|\n)*\$\$undefined\s*$/i, '');
    t = t.replace(/(?:\s|\n)*undefined\s*$/i, '');
    return t;
  };
  const applySanitize = typeof sanitize === 'function' ? sanitize : defaultSanitize;
  return (
    <TypewriterText
      text={source}
      enabled={enabled}
      speed={speed}
      by={by}
      render={(display) => (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          linkTarget="_blank"
          components={{
            a: ({node, ...props}) => <a {...props} rel="noopener noreferrer" />,
            code: ({inline, className, children, ...props}) => (<code className={className} {...props}>{children}</code>)
          }}
        >
          {applySanitize(display)}
        </ReactMarkdown>
      )}
    />
  );
}
