import React from 'react';
import { Keyboard, Monitor, Moon, Shield, Sun, X } from 'lucide-react';
import { CarOsState } from '../../types/dashcam';

interface CarSettingsModalProps {
  open: boolean;
  carState: CarOsState;
  onClose: () => void;
  onChangeState: (patch: Partial<CarOsState>) => void;
}

const SHORTCUTS = [
  { key: 'Space', desc: '播放 / 暂停' },
  { key: '← / →', desc: '快退 / 快进 5 秒（Shift ±15 秒）' },
  { key: ', / .', desc: '逐帧后退 / 逐帧前进（查车牌）' },
  { key: '1 / 2 / 3 / 4', desc: '快速切换 前 / 后 / 左 / 右 摄像头' },
  { key: 'G', desc: '切换 单主视图 / 四宫格同步视图' },
  { key: 'E', desc: '一键跳转至红色哨兵/事件触发点' },
  { key: 'F', desc: '切换 车机窗口 / 纯全屏视图' },
  { key: 'S', desc: '保存当前画面（或四路合成）高清截图' },
];

export const CarSettingsModal: React.FC<CarSettingsModalProps> = ({
  open,
  carState,
  onClose,
  onChangeState,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border overflow-hidden shadow-2xl"
        style={{
          backgroundColor: 'var(--tesla-surface)',
          borderColor: 'var(--tesla-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between border-b"
          style={{ borderColor: 'var(--tesla-border)' }}
        >
          <div>
            <h2 className="text-base font-semibold tracking-tight">车辆控制与显示</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--tesla-text-secondary)' }}>
              Tesla V12 Infotainment · Model 3 / Model Y 车机界面
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Display & Vehicle Toggles */}
          <div className="space-y-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 opacity-70">
                <Monitor className="w-3.5 h-3.5" /> 外观模式
              </div>
              <div
                className="grid grid-cols-2 p-1 rounded-xl"
                style={{ backgroundColor: 'var(--tesla-surface-elevated)' }}
              >
                <button
                  type="button"
                  onClick={() => onChangeState({ theme: 'dark' })}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    carState.theme === 'dark'
                      ? 'bg-zinc-700 text-white shadow'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" /> 深色模式
                </button>
                <button
                  type="button"
                  onClick={() => onChangeState({ theme: 'light' })}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    carState.theme === 'light'
                      ? 'bg-white text-zinc-900 shadow'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" /> 浅色模式
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-medium opacity-80">屏幕亮度</span>
                <span className="tabular-nums opacity-70">{carState.displayBrightness}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                value={carState.displayBrightness}
                onChange={(e) =>
                  onChangeState({ displayBrightness: Number(e.target.value) })
                }
                className="w-full tesla-slider"
              />
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 opacity-70">
                <Shield className="w-3.5 h-3.5" /> 快捷控制
              </div>

              <label
                className="flex items-center justify-between p-3 rounded-xl cursor-pointer"
                style={{ backgroundColor: 'var(--tesla-surface-elevated)' }}
              >
                <span className="text-xs font-medium">哨兵模式监控</span>
                <input
                  type="checkbox"
                  checked={carState.sentryEnabled}
                  onChange={(e) => onChangeState({ sentryEnabled: e.target.checked })}
                  className="accent-blue-500 w-4 h-4"
                />
              </label>

              <label
                className="flex items-center justify-between p-3 rounded-xl cursor-pointer"
                style={{ backgroundColor: 'var(--tesla-surface-elevated)' }}
              >
                <span className="text-xs font-medium">15.4&quot; 车机屏幕边框效果</span>
                <input
                  type="checkbox"
                  checked={carState.bezelMode}
                  onChange={(e) => onChangeState({ bezelMode: e.target.checked })}
                  className="accent-blue-500 w-4 h-4"
                />
              </label>
            </div>
          </div>

          {/* Right: Keyboard Shortcuts */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 opacity-70">
              <Keyboard className="w-3.5 h-3.5" /> 行车记录仪快捷键
            </div>
            <div
              className="rounded-xl p-3 space-y-2"
              style={{ backgroundColor: 'var(--tesla-surface-elevated)' }}
            >
              {SHORTCUTS.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between text-xs gap-2 py-0.5"
                >
                  <span style={{ color: 'var(--tesla-text-secondary)' }}>{item.desc}</span>
                  <kbd className="px-2 py-0.5 rounded bg-black/30 border border-white/10 font-mono text-[11px] shrink-0">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
