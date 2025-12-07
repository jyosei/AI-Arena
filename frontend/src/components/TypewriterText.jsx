import React, { useEffect, useRef, useState } from 'react';

// 将打字机效果应用于文本（默认按词逐步显示）
export default function TypewriterText({
  text = '',
  enabled = true,
  speed = 60, // 毫秒/词
  by = 'word', // 'word' | 'char'
  render,
}) {
  const [display, setDisplay] = useState('');
  const timerRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    // 重置
    if (!enabled) {
      setDisplay(text || '');
      return;
    }
    const source = String(text || '');
    chunksRef.current = by === 'char'
      ? [...source]
      : source.split(/(\s+)/); // 保留空白，避免丢失间隔
    setDisplay('');

    let i = 0;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (i >= chunksRef.current.length) {
        clearInterval(timerRef.current);
        return;
      }
      setDisplay(prev => prev + chunksRef.current[i]);
      i += 1;
    }, Math.max(10, speed));

    return () => clearInterval(timerRef.current);
  }, [text, enabled, speed, by]);

  if (typeof render === 'function') {
    return render(display);
  }
  return <span>{display}</span>;
}
