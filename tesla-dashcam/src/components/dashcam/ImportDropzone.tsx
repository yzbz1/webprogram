import React, { useRef, useState } from 'react';
import {
  FileVideo,
  FolderOpen,
  HardDrive,
  RotateCcw,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  collectFromDirectoryHandle,
  collectFromFileList,
  parseTeslaFiles,
} from '../../utils/teslaParser';
import { DashcamEvent } from '../../types/dashcam';

interface ImportDropzoneProps {
  open: boolean;
  onClose: () => void;
  onLoadedEvents: (events: DashcamEvent[], sourceLabel: string) => void;
  onRestoreDemo: () => void;
}

export const ImportDropzone: React.FC<ImportDropzoneProps> = ({
  open,
  onClose,
  onLoadedEvents,
  onRestoreDemo,
}) => {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleDirectoryPicker = async () => {
    setErrorMsg(null);
    const picker = (
      window as Window & {
        showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;

    if (!picker) {
      folderInputRef.current?.click();
      return;
    }

    try {
      setLoading(true);
      const handle = await picker();
      const rawItems = await collectFromDirectoryHandle(handle);
      const parsed = await parseTeslaFiles(rawItems);
      if (parsed.length === 0) {
        setErrorMsg('未在该目录中找到可播放的 MP4 录像文件，请选择 TeslaCam 目录或包含录像的子文件夹。');
      } else {
        onLoadedEvents(parsed, handle.name);
        onClose();
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setErrorMsg('读取目录失败，请重试或改用下方文件选择器。');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileListChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      const raw = await collectFromFileList(files);
      const parsed = await parseTeslaFiles(raw);
      if (parsed.length === 0) {
        setErrorMsg('未识别到有效的 MP4 / WebM 视频文件。');
      } else {
        onLoadedEvents(parsed, '本地 U 盘');
        onClose();
      }
    } catch {
      setErrorMsg('解析本地文件时发生错误。');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border overflow-hidden shadow-2xl"
        style={{
          backgroundColor: 'var(--tesla-surface)',
          borderColor: 'var(--tesla-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-6 py-4 flex items-center justify-between border-b"
          style={{ borderColor: 'var(--tesla-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-semibold">载入 TeslaCam 行车记录仪 U 盘</h2>
              <p className="text-xs opacity-65">
                100% 本地浏览器离线解码，视频不会上传到任何服务器
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Primary USB Directory Picker Card */}
          <div
            className="rounded-2xl border-2 border-dashed p-6 text-center transition-colors"
            style={{
              backgroundColor: 'var(--tesla-surface-elevated)',
              borderColor: 'rgba(62, 106, 225, 0.45)',
            }}
          >
            <UploadCloud className="w-10 h-10 mx-auto text-blue-400 mb-3" />
            <div className="text-sm font-semibold">
              直接选择特斯拉 U 盘中的 <code className="px-1.5 py-0.5 rounded bg-black/30">TeslaCam</code> 文件夹
            </div>
            <p className="text-xs mt-1.5 opacity-70 leading-relaxed">
              自动识别 <code>SentryClips</code>（哨兵）、<code>SavedClips</code>（保存）、
              <code>RecentClips</code>（最近）以及 <code>event.json</code> 事件触发红点与 4 路/6 路同步视频，
              也可以直接将文件夹拖放到窗口任意位置。
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={handleDirectoryPicker}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--tesla-blue)' }}
              >
                <FolderOpen className="w-4 h-4" />
                <span>{loading ? '正在解析 U 盘目录...' : '选择 TeslaCam 文件夹'}</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer border transition-colors hover:bg-white/10"
                style={{ borderColor: 'var(--tesla-border)' }}
              >
                <FileVideo className="w-4 h-4" />
                <span>选择单个 / 多个 MP4</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-400">
              {errorMsg}
            </div>
          )}

          {/* Hidden fallback inputs */}
          <input
            ref={folderInputRef}
            type="file"
            multiple
            webkitdirectory=""
            className="hidden"
            onChange={handleFileListChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/mp4,video/webm,video/quicktime,.mp4,.json,.png"
            className="hidden"
            onChange={handleFileListChange}
          />

          <div className="flex items-center justify-between pt-2 text-xs">
            <span className="opacity-60">没有随身带 U 盘？可以随时体验内置四路同步演示</span>
            <button
              type="button"
              onClick={() => {
                onRestoreDemo();
                onClose();
              }}
              className="flex items-center gap-1.5 text-blue-400 hover:underline font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              载入内置演示数据
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
