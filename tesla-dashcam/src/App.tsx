import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CarOsState, DashcamEvent } from './types/dashcam';
import { createDemoEvents } from './utils/demoData';
import { TopStatusBar } from './components/car-os/TopStatusBar';
import { CarDesktop } from './components/car-os/CarDesktop';
import { BottomDock } from './components/car-os/BottomDock';
import { CarSettingsModal } from './components/car-os/CarSettingsModal';
import { DashcamApp } from './components/dashcam/DashcamApp';
import { ImportDropzone } from './components/dashcam/ImportDropzone';

export function App() {
  const [carState, setCarState] = useState<CarOsState>({
    theme: 'dark',
    gear: 'P',
    batteryPercent: 82,
    rangeKm: 418,
    showPercent: true,
    locked: true,
    sentryEnabled: true,
    driverTemp: 22.5,
    passengerTemp: 22.0,
    driverSeatHeat: 0,
    passengerSeatHeat: 0,
    volume: 5,
    displayBrightness: 100,
    bezelMode: false,
  });

  const [events, setEvents] = useState<DashcamEvent[]>(() => createDemoEvents());
  const [activeEventId, setActiveEventId] = useState<string | null>(
    () => createDemoEvents()[0]?.id ?? null
  );
  const [usbLoaded, setUsbLoaded] = useState(false);

  const [dashcamOpen, setDashcamOpen] = useState(true);
  const [dashcamFullscreen, setDashcamFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  // Apply Tesla dark/light class to root <html>
  useEffect(() => {
    const html = document.documentElement;
    if (carState.theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [carState.theme]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const activeEvent = useMemo(
    () => events.find((e) => e.id === activeEventId) ?? events[0] ?? null,
    [events, activeEventId]
  );

  const sentryCount = useMemo(
    () => events.filter((e) => e.category === 'sentry').length,
    [events]
  );

  const handleLoadedEvents = useCallback(
    (loaded: DashcamEvent[], sourceLabel: string) => {
      // Revoke any previous thumb blob URLs
      events.forEach((ev) => {
        if (ev.thumbUrl) URL.revokeObjectURL(ev.thumbUrl);
      });
      setEvents(loaded);
      setActiveEventId(loaded[0]?.id ?? null);
      setUsbLoaded(true);
      setDashcamOpen(true);
      showToast(`已从「${sourceLabel}」成功载入 ${loaded.length} 条行车记录仪事件`);
    },
    [events, showToast]
  );

  const handleRestoreDemo = useCallback(() => {
    const demo = createDemoEvents();
    setEvents(demo);
    setActiveEventId(demo[0]?.id ?? null);
    setUsbLoaded(false);
    setDashcamOpen(true);
    showToast('已恢复内置 4 路同步特斯拉演示数据');
  }, [showToast]);

  const handleDeleteEvent = useCallback(
    (id: string) => {
      setEvents((prev) => {
        const next = prev.filter((e) => e.id !== id);
        if (activeEventId === id) {
          setActiveEventId(next[0]?.id ?? null);
        }
        return next;
      });
      showToast('已从当前播放列表移除该剪辑（未删除磁盘原文件）');
    },
    [activeEventId, showToast]
  );

  const handleUpdateSegmentDuration = useCallback(
    (eventId: string, segmentIndex: number, actualDuration: number) => {
      setEvents((prev) =>
        prev.map((ev) => {
          if (ev.id !== eventId) return ev;
          const seg = ev.segments[segmentIndex];
          if (!seg || Math.abs(seg.duration - actualDuration) < 0.5) return ev;
          const nextSegs = ev.segments.map((s, idx) =>
            idx === segmentIndex ? { ...s, duration: actualDuration } : s
          );
          const totalDuration = nextSegs.reduce((sum, s) => sum + s.duration, 0);
          return { ...ev, segments: nextSegs, totalDuration };
        })
      );
    },
    []
  );

  const patchCar = useCallback((patch: Partial<CarOsState>) => {
    setCarState((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleAdjustTemp = (side: 'driver' | 'passenger', delta: number) => {
    setCarState((prev) => {
      const key = side === 'driver' ? 'driverTemp' : 'passengerTemp';
      const next = Math.min(28, Math.max(15, Number((prev[key] + delta).toFixed(1))));
      return { ...prev, [key]: next };
    });
  };

  const handleCycleSeatHeat = (side: 'driver' | 'passenger') => {
    setCarState((prev) => {
      const key = side === 'driver' ? 'driverSeatHeat' : 'passengerSeatHeat';
      // Real Tesla cycles 0 -> 3 -> 2 -> 1 -> 0
      const order: Array<0 | 1 | 2 | 3> = [3, 0, 1, 2];
      const next = order[prev[key]];
      return { ...prev, [key]: next };
    });
  };

  const handleAdjustVolume = (delta: number) => {
    setCarState((prev) => ({
      ...prev,
      volume: Math.min(10, Math.max(0, prev.volume + delta)),
    }));
  };

  return (
    <div
      className={`w-screen h-screen overflow-hidden flex items-center justify-center transition-colors ${
        carState.bezelMode ? 'bg-zinc-950 p-3 sm:p-5' : ''
      }`}
    >
      {/* Tesla 15.4" Touchscreen Frame */}
      <div
        className={`w-full h-full flex flex-col overflow-hidden relative transition-all ${
          carState.bezelMode
            ? 'rounded-[22px] ring-[8px] ring-zinc-900 shadow-[0_30px_90px_rgba(0,0,0,0.95)] border border-white/10'
            : ''
        }`}
        style={{
          backgroundColor: 'var(--tesla-bg)',
          filter:
            carState.displayBrightness < 100
              ? `brightness(${carState.displayBrightness}%)`
              : undefined,
        }}
      >
        {/* Top Tesla Infotainment Status Bar */}
        <TopStatusBar
          carState={carState}
          usbLoaded={usbLoaded}
          usbClipCount={events.length}
          onToggleBatteryUnit={() => patchCar({ showPercent: !carState.showPercent })}
          onToggleLock={() => {
            patchCar({ locked: !carState.locked });
            showToast(carState.locked ? '车门已解锁' : '车门已锁定');
          }}
          onToggleSentry={() => {
            patchCar({ sentryEnabled: !carState.sentryEnabled });
            showToast(carState.sentryEnabled ? '哨兵模式已关闭' : '哨兵模式已开启');
          }}
          onOpenDashcam={() => setDashcamOpen(true)}
          onOpenImport={() => setImportOpen(true)}
        />

        {/* Center Main Screen Stage: Car Desktop underneath + Floating/Fullscreen Dashcam Viewer */}
        <main className="relative flex-1 flex min-h-0 overflow-hidden">
          <CarDesktop
            carState={carState}
            activeEvent={activeEvent}
            sentryCount={sentryCount}
            onOpenDashcam={() => setDashcamOpen(true)}
            onOpenImport={() => setImportOpen(true)}
          />

          {dashcamOpen && (
            <DashcamApp
              events={events}
              activeEvent={activeEvent}
              isFullscreen={dashcamFullscreen}
              onSelectEvent={(ev) => setActiveEventId(ev.id)}
              onDeleteEvent={handleDeleteEvent}
              onUpdateEventSegmentDuration={handleUpdateSegmentDuration}
              onLoadedEvents={handleLoadedEvents}
              onToggleFullscreen={() => setDashcamFullscreen((f) => !f)}
              onClose={() => {
                setDashcamFullscreen(false);
                setDashcamOpen(false);
              }}
              onOpenImport={() => setImportOpen(true)}
              onShowToast={showToast}
            />
          )}
        </main>

        {/* Persistent Tesla V12 Bottom Dock */}
        <BottomDock
          carState={carState}
          dashcamOpen={dashcamOpen}
          settingsOpen={settingsOpen}
          onToggleSettings={() => setSettingsOpen((s) => !s)}
          onToggleDashcam={() => setDashcamOpen((o) => !o)}
          onShowMap={() => {
            setDashcamFullscreen(false);
            setDashcamOpen(false);
          }}
          onOpenImport={() => setImportOpen(true)}
          onToggleSentry={() => {
            patchCar({ sentryEnabled: !carState.sentryEnabled });
            showToast(carState.sentryEnabled ? '哨兵模式已关闭' : '哨兵模式已开启');
          }}
          onAdjustTemp={handleAdjustTemp}
          onCycleSeatHeat={handleCycleSeatHeat}
          onAdjustVolume={handleAdjustVolume}
          onShowToast={showToast}
        />

        {/* Modals */}
        <CarSettingsModal
          open={settingsOpen}
          carState={carState}
          onClose={() => setSettingsOpen(false)}
          onChangeState={patchCar}
        />

        <ImportDropzone
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onLoadedEvents={handleLoadedEvents}
          onRestoreDemo={handleRestoreDemo}
        />

        {/* Tesla-style Bottom-Center Pill Toast */}
        {toast && (
          <div className="fixed bottom-20 left-1/2 z-50 px-4 py-2 rounded-full bg-zinc-900/95 text-white text-xs font-medium border border-white/15 shadow-2xl backdrop-blur-md animate-toast pointer-events-none">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
