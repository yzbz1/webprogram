import React, { useMemo, useState } from 'react';
import {
  Clock,
  FolderOpen,
  MapPin,
  Search,
  ShieldAlert,
  Trash2,
  Video,
} from 'lucide-react';
import { ClipCategory, DashcamEvent } from '../../types/dashcam';
import { formatDuration, formatTeslaDateTime } from '../../utils/teslaParser';
import { TeslaSentryIcon } from '../icons/TeslaIcons';

type TabFilter = 'all' | ClipCategory;

interface ClipsSidebarProps {
  events: DashcamEvent[];
  activeEventId: string | null;
  onSelectEvent: (event: DashcamEvent) => void;
  onDeleteEvent: (id: string) => void;
  onOpenImport: () => void;
}

export const ClipsSidebar: React.FC<ClipsSidebarProps> = ({
  events,
  activeEventId,
  onSelectEvent,
  onDeleteEvent,
  onOpenImport,
}) => {
  const [tab, setTab] = useState<TabFilter>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const c = { all: events.length, saved: 0, sentry: 0, recent: 0 };
    for (const ev of events) c[ev.category]++;
    return c;
  }, [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((ev) => {
      if (tab !== 'all' && ev.category !== tab) return false;
      if (!q) return true;
      return (
        ev.locationLabel.toLowerCase().includes(q) ||
        ev.reasonLabel.toLowerCase().includes(q) ||
        ev.folderName.toLowerCase().includes(q)
      );
    });
  }, [events, tab, query]);

  const tabs: { id: TabFilter; label: string; count: number; red?: boolean }[] = [
    { id: 'all', label: '全部', count: counts.all },
    { id: 'sentry', label: '哨兵', count: counts.sentry, red: true },
    { id: 'saved', label: '记录仪', count: counts.saved },
    { id: 'recent', label: '最近', count: counts.recent },
  ];

  return (
    <aside
      className="w-[300px] xl:w-[330px] shrink-0 h-full flex flex-col border-r transition-colors"
      style={{
        backgroundColor: 'var(--tesla-surface)',
        borderColor: 'var(--tesla-border)',
      }}
    >
      {/* Tesla Segmented Tabs */}
      <div className="p-3 pb-2 space-y-2.5 border-b" style={{ borderColor: 'var(--tesla-border)' }}>
        <div
          className="grid grid-cols-4 p-1 rounded-xl gap-0.5"
          style={{ backgroundColor: 'var(--tesla-surface-elevated)' }}
        >
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative py-1.5 px-1 rounded-lg text-[12px] font-medium transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  active ? 'shadow-sm' : 'opacity-65 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: active ? 'var(--tesla-surface-hover)' : 'transparent',
                  color: active ? 'var(--tesla-text)' : 'var(--tesla-text-secondary)',
                }}
              >
                <span>{t.label}</span>
                {t.count > 0 && (
                  <span
                    className={`text-[10px] px-1 rounded-full tabular-nums ${
                      t.red
                        ? 'bg-red-500/20 text-red-400 font-semibold'
                        : 'opacity-65'
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border"
          style={{
            backgroundColor: 'var(--tesla-surface-elevated)',
            borderColor: 'var(--tesla-border)',
          }}
        >
          <Search className="w-3.5 h-3.5 opacity-50 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索地点、日期或事件类型..."
            className="bg-transparent text-xs outline-none w-full placeholder:opacity-50"
          />
        </div>
      </div>

      {/* Clips List */}
      <div className="flex-1 overflow-y-auto tesla-scroll p-2.5 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-10 opacity-65">
            <Video className="w-8 h-8 mb-2 opacity-40" />
            <div className="text-xs font-medium">暂无匹配的录像片段</div>
            <button
              type="button"
              onClick={onOpenImport}
              className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer"
              style={{ backgroundColor: 'var(--tesla-blue)' }}
            >
              导入 TeslaCam 文件夹
            </button>
          </div>
        ) : (
          filtered.map((ev) => {
            const isActive = ev.id === activeEventId;
            const { dateLabel, timeLabel } = formatTeslaDateTime(ev.startDate);
            const isSentry = ev.category === 'sentry';
            const isRecent = ev.category === 'recent';

            return (
              <div
                key={ev.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectEvent(ev)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelectEvent(ev);
                }}
                className={`group relative rounded-xl p-2.5 transition-all cursor-pointer border ${
                  isActive ? 'shadow-md' : 'hover:opacity-95'
                }`}
                style={{
                  backgroundColor: isActive
                    ? 'var(--tesla-surface-hover)'
                    : 'var(--tesla-surface-elevated)',
                  borderColor: isActive
                    ? isSentry
                      ? 'rgba(227, 25, 55, 0.55)'
                      : 'rgba(62, 106, 225, 0.65)'
                    : 'transparent',
                }}
              >
                <div className="flex gap-2.5">
                  {/* Thumbnail Box */}
                  <div className="relative w-20 h-[52px] rounded-lg overflow-hidden shrink-0 bg-zinc-900 border border-white/10 flex items-center justify-center">
                    {ev.thumbUrl ? (
                      <img
                        src={ev.thumbUrl}
                        alt={ev.folderName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex flex-col items-center justify-center"
                        style={{
                          background: isSentry
                            ? 'linear-gradient(135deg, #2b1116, #111318)'
                            : isRecent
                              ? 'linear-gradient(135deg, #172536, #0f172a)'
                              : 'linear-gradient(135deg, #18233a, #10141d)',
                        }}
                      >
                        {isSentry ? (
                          <TeslaSentryIcon className="w-6 h-6" active />
                        ) : isRecent ? (
                          <Clock className="w-5 h-5 text-sky-400 opacity-85" />
                        ) : (
                          <Video className="w-5 h-5 text-blue-400 opacity-85" />
                        )}
                      </div>
                    )}

                    {/* Duration pill */}
                    <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/75 text-[9px] font-mono text-white leading-none tabular-nums">
                      {formatDuration(ev.totalDuration)}
                    </span>

                    {/* Category dot */}
                    {isSentry && (
                      <span className="absolute top-1 left-1 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[13px] font-semibold tabular-nums truncate">
                        {dateLabel} {timeLabel}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteEvent(ev.id);
                        }}
                        title="从列表移除此片段"
                        className="opacity-0 group-hover:opacity-75 hover:!opacity-100 p-1 rounded hover:bg-red-500/20 hover:text-red-400 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div
                      className="text-[11px] flex items-center gap-1 truncate"
                      style={{ color: 'var(--tesla-text-secondary)' }}
                    >
                      <MapPin className="w-3 h-3 shrink-0 opacity-65" />
                      <span className="truncate">{ev.locationLabel}</span>
                    </div>

                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span
                        className={`text-[10px] truncate flex items-center gap-1 ${
                          isSentry ? 'text-red-400 font-medium' : 'opacity-65'
                        }`}
                      >
                        {isSentry && <ShieldAlert className="w-3 h-3 shrink-0" />}
                        {ev.reasonLabel}
                      </span>
                      <span className="text-[10px] opacity-45 shrink-0 tabular-nums">
                        {ev.availableCameras.length}路
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom USB Import CTA */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--tesla-border)' }}>
        <button
          type="button"
          onClick={onOpenImport}
          className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer hover:opacity-95"
          style={{
            backgroundColor: 'var(--tesla-surface-elevated)',
            color: 'var(--tesla-text)',
          }}
        >
          <FolderOpen className="w-4 h-4 text-blue-400" />
          <span>载入 TeslaCam 文件夹 / 本地 MP4</span>
        </button>
      </div>
    </aside>
  );
};
