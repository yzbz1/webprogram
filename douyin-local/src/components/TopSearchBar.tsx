import React, { useState } from 'react';
import { Keyboard, Search, Sparkles, X } from 'lucide-react';

interface TopSearchBarProps {
  query: string;
  onSubmitSearch: (q: string) => void;
  onClearSearch: () => void;
  totalWorks: number;
}

const SHORTCUTS = [
  ['↑ / ↓ 或 W / S', '上一条 / 下一条视频'],
  ['Space / 单击', '播放 / 暂停'],
  ['双击画面 / Z', '点赞（带桃心飞溅动效）'],
  ['长按画面', '临时 2.0x 倍速播放，松手恢复'],
  ['C / G', '收藏作品 / 关注博主'],
  ['K / J', '切换连播模式 / 清屏模式'],
  ['← / →', '快退/快进 5 秒（图文切上下张）'],
  ['R / M / F', 'TA 的作品抽屉 / 静音 / 全屏'],
];

export const TopSearchBar: React.FC<TopSearchBarProps> = ({
  query,
  onSubmitSearch,
  onClearSearch,
  totalWorks,
}) => {
  const [input, setInput] = useState(query);
  const [showHelp, setShowHelp] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) onSubmitSearch(input.trim());
  };

  return (
    <header className="fixed top-0 left-[72px] lg:left-[172px] right-0 h-14 px-5 flex items-center justify-between gap-4 z-30 pointer-events-none">
      {/* Center-Left Douyin Search Pill */}
      <form
        onSubmit={handleSubmit}
        className="pointer-events-auto flex items-center w-full max-w-md h-9 rounded-full bg-white/[0.1] hover:bg-white/[0.14] focus-within:bg-[#1a1d2e] focus-within:ring-1 focus-within:ring-white/25 backdrop-blur-md border border-white/10 pl-3.5 pr-1 transition-all shadow-lg"
      >
        <Search className="w-4 h-4 text-white/55 shrink-0 mr-2" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`搜索 ${totalWorks ? totalWorks.toLocaleString() : '35,000+'} 个本地视频、博主或 #话题...`}
          className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/45 outline-none min-w-0"
        />
        {input && (
          <button
            type="button"
            onClick={() => {
              setInput('');
              onClearSearch();
            }}
            className="p-1 text-white/50 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="submit"
          className="px-3.5 h-7 rounded-full bg-white/12 hover:bg-[#FE2C55] text-xs font-semibold text-white transition-colors cursor-pointer shrink-0 ml-1"
        >
          搜索
        </button>
      </form>

      {/* Right: Recommendation Engine indicator + Keyboard Help */}
      <div className="pointer-events-auto flex items-center gap-2 relative">
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10 text-[11px] text-white/75">
          <Sparkles className="w-3.5 h-3.5 text-[#25F4EE]" />
          <span>本地智能推荐算法已开启</span>
        </div>

        <button
          type="button"
          onClick={() => setShowHelp((s) => !s)}
          title="查看抖音快捷键与手势说明"
          className="w-9 h-9 rounded-full bg-black/45 hover:bg-white/15 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white cursor-pointer transition-colors"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {showHelp && (
          <div className="absolute right-0 top-12 w-80 rounded-2xl bg-[#161826]/98 border border-white/12 p-4 shadow-2xl backdrop-blur-xl z-50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-white">抖音交互与快捷键</span>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="text-white/50 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {SHORTCUTS.map(([k, desc]) => (
                <div key={k} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-white/65">{desc}</span>
                  <kbd className="px-2 py-0.5 rounded bg-white/10 border border-white/10 font-mono text-[10px] text-white shrink-0">
                    {k}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
