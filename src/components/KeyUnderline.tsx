import React from 'react';

interface KeyUnderlineProps {
  text: string;
  hotkey?: string;
  className?: string;
}

/**
 * Renders text with the designated hotkey letter visually underlined,
 * indicating keyboard navigation shortcuts without touching the mouse.
 */
export function KeyUnderline({ text, hotkey, className = '' }: KeyUnderlineProps) {
  if (!hotkey) {
    return <span className={className}>{text}</span>;
  }

  const lowerText = text.toLowerCase();
  const lowerKey = hotkey.toLowerCase();
  const idx = lowerText.indexOf(lowerKey);

  if (idx === -1) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {text.slice(0, idx)}
      <span className="underline decoration-2 underline-offset-[3px] font-extrabold text-emerald-700 decoration-emerald-500">
        {text.charAt(idx)}
      </span>
      {text.slice(idx + 1)}
    </span>
  );
}

export default KeyUnderline;
