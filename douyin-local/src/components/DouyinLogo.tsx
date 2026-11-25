import React from 'react';

export const DouyinNoteIcon: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 36 36" fill="none" className={className}>
    {/* Cyan offset shadow */}
    <path
      d="M24.2 7.2c1.4 2.1 3.6 3.5 6.2 3.8v4.5c-2.3-.1-4.5-.8-6.3-2.1v8.7c0 5-4 9-9 9s-9-4-9-9 4-9 9-9c.5 0 1 .1 1.5.2v4.7c-.5-.2-1-.3-1.5-.3-2.4 0-4.4 2-4.4 4.4s2 4.4 4.4 4.4 4.5-1.9 4.5-4.4V5.6h4.6v1.6z"
      fill="#25F4EE"
      transform="translate(-1.3, -1.1)"
    />
    {/* Red offset shadow */}
    <path
      d="M24.2 7.2c1.4 2.1 3.6 3.5 6.2 3.8v4.5c-2.3-.1-4.5-.8-6.3-2.1v8.7c0 5-4 9-9 9s-9-4-9-9 4-9 9-9c.5 0 1 .1 1.5.2v4.7c-.5-.2-1-.3-1.5-.3-2.4 0-4.4 2-4.4 4.4s2 4.4 4.4 4.4 4.5-1.9 4.5-4.4V5.6h4.6v1.6z"
      fill="#FE2C55"
      transform="translate(1.3, 1.1)"
    />
    {/* Crisp white core */}
    <path
      d="M24.2 7.2c1.4 2.1 3.6 3.5 6.2 3.8v4.5c-2.3-.1-4.5-.8-6.3-2.1v8.7c0 5-4 9-9 9s-9-4-9-9 4-9 9-9c.5 0 1 .1 1.5.2v4.7c-.5-.2-1-.3-1.5-.3-2.4 0-4.4 2-4.4 4.4s2 4.4 4.4 4.4 4.5-1.9 4.5-4.4V5.6h4.6v1.6z"
      fill="#FFFFFF"
    />
  </svg>
);

const AVATAR_GRADIENTS = [
  'from-[#fe2c55] to-[#ff7a45]',
  'from-[#ec4899] to-[#8b5cf6]',
  'from-[#06b6d4] to-[#3b82f6]',
  'from-[#f59e0b] to-[#ef4444]',
  'from-[#10b981] to-[#0ea5e9]',
  'from-[#6366f1] to-[#ec4899]',
  'from-[#f43f5e] to-[#d946ef]',
  'from-[#14b8a6] to-[#6366f1]',
];

export function getAuthorGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

export function getAuthorInitial(name: string): string {
  const clean = name.replace(/[^\p{L}\p{N}]/gu, '');
  if (clean.length > 0) return Array.from(clean)[0].toUpperCase();
  return Array.from(name)[0] || '抖';
}

export const AuthorAvatar: React.FC<{
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ name, size = 'md', className = '' }) => {
  const sizeCls =
    size === 'sm'
      ? 'w-8 h-8 text-xs'
      : size === 'lg'
        ? 'w-14 h-14 text-xl'
        : 'w-11 h-11 text-base';

  return (
    <div
      className={`rounded-full bg-gradient-to-br ${getAuthorGradient(
        name
      )} flex items-center justify-center font-bold text-white shadow-lg border-2 border-white/85 shrink-0 select-none ${sizeCls} ${className}`}
    >
      {getAuthorInitial(name)}
    </div>
  );
};
