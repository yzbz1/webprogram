import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { LocalMusicLibrary, MediaState, MusicSourceMode } from '../shared/types.ts'
import { NextTrackIcon, PauseIcon, PlayIcon, PrevTrackIcon } from './icons.tsx'

const EMPTY_MEDIA: MediaState = {
  available: true,
  hasSession: false,
  title: '',
  artist: '',
  status: 'idle',
  thumbnailDataUrl: null,
}

const EMPTY_LIBRARY: LocalMusicLibrary = {
  folderPath: '',
  tracks: [],
}

const DROPLET_LEAVE_GRACE_MS = 160
const VOLUME_HUD_TIMEOUT_MS = 1200
const HUD_RING_RADIUS = 41
const HUD_RING_CIRCUMFERENCE = 2 * Math.PI * HUD_RING_RADIUS

// Period = 100 units across 0..200 for seamless -100px horizontal loop
const WAVE_FRONT_STROKE_PATH =
  'M 0 0 C 16 -8, 34 -8, 50 0 C 66 8, 84 8, 100 0 C 116 -8, 134 -8, 150 0 C 166 8, 184 8, 200 0'
const WAVE_FRONT_FILL_PATH = `${WAVE_FRONT_STROKE_PATH} L 200 130 L 0 130 Z`

// Period = 120 units across 0..240 in opposite phase/direction for organic wave interference
const WAVE_BACK_STROKE_PATH =
  'M 0 2 C 20 8, 40 8, 60 2 C 80 -4, 100 -4, 120 2 C 140 8, 160 8, 180 2 C 200 -4, 220 -4, 240 2'
const WAVE_BACK_FILL_PATH = `${WAVE_BACK_STROKE_PATH} L 240 130 L 0 130 Z`

function clampVolume(vol: number): number {
  return Math.max(0, Math.min(100, Math.round(vol)))
}

/** Two-layer SVG liquid-glass pearl whose meniscus level tracks volume and waves animate smoothly. */
function LiquidPearlSvg({ uid, volume }: { readonly uid: string; readonly volume: number }) {
  const clampedVol = clampVolume(volume)
  const waterY = 93 - (clampedVol / 100) * 85

  return (
    <svg className="st-orb-pearl-svg" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <clipPath id={`${uid}-clip`}>
          <circle cx="50" cy="50" r="49" />
        </clipPath>

        <radialGradient id={`${uid}-dome`} cx="38%" cy="28%" r="72%" fx="34%" fy="22%">
          <stop offset="0%" className="st-orb-stop-dome-top" />
          <stop offset="56%" className="st-orb-stop-dome-mid" />
          <stop offset="100%" className="st-orb-stop-dome-edge" />
        </radialGradient>

        <radialGradient id={`${uid}-core`} cx="50%" cy="62%" r="54%">
          <stop offset="0%" className="st-orb-stop-cyan" stopOpacity="0.65" />
          <stop offset="55%" className="st-orb-stop-iris" stopOpacity="0.32" />
          <stop offset="100%" className="st-orb-stop-violet" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={`${uid}-wave-back`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" className="st-orb-stop-cyan" stopOpacity="0.58" />
          <stop offset="45%" className="st-orb-stop-iris" stopOpacity="0.72" />
          <stop offset="100%" className="st-orb-stop-violet" stopOpacity="0.88" />
        </linearGradient>

        <linearGradient id={`${uid}-wave-front`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" className="st-orb-stop-cyan" stopOpacity="0.92" />
          <stop offset="32%" className="st-orb-stop-azure" stopOpacity="0.95" />
          <stop offset="68%" className="st-orb-stop-iris" stopOpacity="0.98" />
          <stop offset="100%" className="st-orb-stop-violet" stopOpacity="1" />
        </linearGradient>

        <linearGradient id={`${uid}-meniscus`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" className="st-orb-stop-cyan" stopOpacity="0.85" />
          <stop offset="25%" className="st-orb-stop-white" stopOpacity="0.96" />
          <stop offset="50%" className="st-orb-stop-violet" stopOpacity="0.85" />
          <stop offset="75%" className="st-orb-stop-white" stopOpacity="0.96" />
          <stop offset="100%" className="st-orb-stop-cyan" stopOpacity="0.85" />
        </linearGradient>

        <radialGradient id={`${uid}-rim`} cx="50%" cy="50%" r="50%">
          <stop offset="74%" className="st-orb-stop-rim-shadow" stopOpacity="0" />
          <stop offset="93%" className="st-orb-stop-rim-shadow" stopOpacity="0.26" />
          <stop offset="100%" className="st-orb-stop-white" stopOpacity="0.38" />
        </radialGradient>

        <filter id={`${uid}-glow`} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="2.1" />
        </filter>
      </defs>

      <g clipPath={`url(#${uid}-clip)`}>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-dome)`} />
        <circle cx="50" cy="64" r="46" className="st-orb-core-glow" fill={`url(#${uid}-core)`} />

        <g className="st-orb-water-level" style={{ transform: `translateY(${waterY.toFixed(1)}px)` }}>
          <g className="st-orb-wave-back-group">
            <g className="st-orb-wave-back">
              <path d={WAVE_BACK_FILL_PATH} fill={`url(#${uid}-wave-back)`} />
              <path
                d={WAVE_BACK_STROKE_PATH}
                fill="none"
                stroke="var(--st-orb-violet)"
                strokeWidth="1.5"
                opacity="0.55"
              />
            </g>
          </g>

          <g className="st-orb-wave-front-group">
            <g className="st-orb-wave-front">
              <path d={WAVE_FRONT_FILL_PATH} fill={`url(#${uid}-wave-front)`} />
              <path
                d={WAVE_FRONT_STROKE_PATH}
                fill="none"
                stroke="var(--st-orb-cyan)"
                strokeWidth="4.6"
                className="st-orb-wave-subglow"
                filter={`url(#${uid}-glow)`}
              />
              <path
                d={WAVE_FRONT_STROKE_PATH}
                fill="none"
                stroke={`url(#${uid}-meniscus)`}
                strokeWidth="2.1"
                strokeLinecap="round"
                className="st-orb-wave-meniscus"
              />
            </g>
          </g>
        </g>

        <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-rim)`} />
      </g>
    </svg>
  )
}

/** Circular ring-arc volume HUD rendered inside the sphere while scrolling. */
function VolumeHudOverlay({
  uid,
  volume,
  visible,
}: {
  readonly uid: string
  readonly volume: number
  readonly visible: boolean
}) {
  const clampedVol = clampVolume(volume)
  const dashOffset = HUD_RING_CIRCUMFERENCE * (1 - clampedVol / 100)

  return (
    <span className="st-orb-vol-hud" data-visible={visible ? 'true' : undefined} aria-hidden="true">
      <svg className="st-orb-hud-svg" viewBox="0 0 100 100">
        <defs>
          <linearGradient id={`${uid}-hud-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="st-orb-stop-cyan" />
            <stop offset="55%" className="st-orb-stop-azure" />
            <stop offset="100%" className="st-orb-stop-violet" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={HUD_RING_RADIUS} className="st-orb-hud-track" />
        <circle
          cx="50"
          cy="50"
          r={HUD_RING_RADIUS}
          className="st-orb-hud-arc"
          stroke={`url(#${uid}-hud-grad)`}
          strokeDasharray={HUD_RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          opacity={clampedVol === 0 ? 0 : 1}
        />
      </svg>
      <span className="st-orb-hud-label">
        {clampedVol === 0 ? (
          <span className="st-orb-hud-mute">静音</span>
        ) : (
          <>
            <span className="st-orb-hud-num">{clampedVol}</span>
            <span className="st-orb-hud-pct">%</span>
          </>
        )}
      </span>
    </span>
  )
}

export interface MusicOrbProps {
  readonly musicSource: MusicSourceMode
  readonly musicWebUrl: string
  readonly musicVolume: number
}

export function MusicOrb({ musicSource, musicWebUrl, musicVolume }: MusicOrbProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const svgUid = `st-orb-${rawId}`

  const [smtcMedia, setSmtcMedia] = useState<MediaState>(EMPTY_MEDIA)
  const [webMedia, setWebMedia] = useState<MediaState>(EMPTY_MEDIA)
  const [localLib, setLocalLib] = useState<LocalMusicLibrary>(EMPTY_LIBRARY)
  const [trackIndex, setTrackIndex] = useState(0)
  const [localPlaying, setLocalPlaying] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [volume, setVolume] = useState(() => clampVolume(musicVolume))
  const [volHudVisible, setVolHudVisible] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const clusterRef = useRef<HTMLDivElement | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const volHudTimerRef = useRef<number | null>(null)
  const volSaveTimerRef = useRef<number | null>(null)
  const pendingVolRef = useRef<number>(clampVolume(musicVolume))
  const lastWheelAtRef = useRef<number>(0)
  const wheelHandlerRef = useRef<(e: WheelEvent) => void>(() => {})

  useEffect(() => {
    if (Date.now() - lastWheelAtRef.current < 450) return
    const clean = clampVolume(musicVolume)
    setVolume(clean)
    pendingVolRef.current = clean
  }, [musicVolume])

  const setHoveredWithGrace = useCallback((enter: boolean) => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    if (enter) {
      setHovered(true)
    } else {
      hoverTimerRef.current = window.setTimeout(() => {
        hoverTimerRef.current = null
        setHovered(false)
      }, DROPLET_LEAVE_GRACE_MS)
    }
  }, [])

  useEffect(
    () => () => {
      if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current)
      if (volHudTimerRef.current !== null) window.clearTimeout(volHudTimerRef.current)
      if (volSaveTimerRef.current !== null) window.clearTimeout(volSaveTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    void window.stageApi.getMediaState().then(setSmtcMedia).catch(() => undefined)
    void window.stageApi.getWebMusicState().then(setWebMedia).catch(() => undefined)
    void window.stageApi.getLocalMusic().then(setLocalLib).catch(() => undefined)
    const offMedia = window.stageApi.onMediaState(setSmtcMedia)
    const offWeb = window.stageApi.onWebMusicState(setWebMedia)
    const offLocal = window.stageApi.onLocalMusicChanged((lib) => {
      setLocalLib(lib)
      setTrackIndex(0)
      if (!lib.folderPath || lib.tracks.length === 0) {
        setLocalPlaying(false)
      }
    })
    return () => {
      offMedia()
      offWeb()
      offLocal()
    }
  }, [])

  const isLocalMode = musicSource === 'local'
  const isWebMode = musicSource === 'web'
  const tracks = localLib.tracks
  const safeTrackIdx = tracks.length > 0 ? trackIndex % tracks.length : 0
  const currentTrack = tracks[safeTrackIdx] ?? null

  // Sync HTMLAudioElement playback & volume in local mode
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !isLocalMode || !currentTrack) return
    audio.volume = Math.max(0, Math.min(1, volume / 100))
    audio.muted = volume === 0
    if (localPlaying) {
      void audio.play().catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setLocalPlaying(false)
        }
      })
    } else {
      audio.pause()
    }
  }, [isLocalMode, currentTrack?.streamUrl, localPlaying, volume])

  const isPlaying = isWebMode
    ? webMedia.status === 'playing'
    : isLocalMode
      ? localPlaying && Boolean(currentTrack)
      : smtcMedia.status === 'playing'

  const coverUrl = isWebMode
    ? webMedia.thumbnailDataUrl
    : isLocalMode
      ? (currentTrack?.coverDataUrl ?? null)
      : smtcMedia.thumbnailDataUrl

  const showAlbumCover = isPlaying && Boolean(coverUrl)

  const trackLabel = isWebMode
    ? webMedia.title
      ? `${webMedia.title}${webMedia.artist ? ` · ${webMedia.artist}` : ''}`
      : webMedia.hasSession
        ? '网页音乐已就绪 · 左键播放/暂停'
        : musicWebUrl
          ? '网页音乐 · 左键打开登录/选歌'
          : '网页音乐 · 右键/点击打开音乐网址'
    : isLocalMode
      ? currentTrack
        ? `${currentTrack.title}${currentTrack.artist ? ` · ${currentTrack.artist}` : ''}`
        : '文件夹暂无音频 · 右键更换播放文件夹'
      : smtcMedia.title
        ? `${smtcMedia.title}${smtcMedia.artist ? ` · ${smtcMedia.artist}` : ''}`
        : smtcMedia.hasSession
          ? '系统媒体会话已连接 · 右键选音乐源'
          : '点击播放/暂停 · 滚轮调音量 · 右键设置'

  const handleWheelVolume = useCallback(
    (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 0.5) return
      e.preventDefault()
      e.stopPropagation()

      lastWheelAtRef.current = Date.now()
      const up = e.deltaY < 0
      const step = musicSource === 'smtc' ? 4 : 5
      const nextVol = clampVolume(pendingVolRef.current + (up ? step : -step))
      pendingVolRef.current = nextVol
      setVolume(nextVol)

      setVolHudVisible(true)
      if (volHudTimerRef.current !== null) window.clearTimeout(volHudTimerRef.current)
      volHudTimerRef.current = window.setTimeout(() => {
        volHudTimerRef.current = null
        setVolHudVisible(false)
      }, VOLUME_HUD_TIMEOUT_MS)

      if (musicSource === 'local') {
        const audio = audioRef.current
        if (audio) {
          audio.volume = nextVol / 100
          audio.muted = nextVol === 0
        }
      } else if (musicSource === 'smtc') {
        void window.stageApi.adjustSystemVolume(up ? 'up' : 'down', 2)
      }

      if (volSaveTimerRef.current !== null) window.clearTimeout(volSaveTimerRef.current)
      volSaveTimerRef.current = window.setTimeout(() => {
        volSaveTimerRef.current = null
        void window.stageApi.setMusicVolume(pendingVolRef.current)
      }, 60)
    },
    [musicSource],
  )

  wheelHandlerRef.current = handleWheelVolume

  useEffect(() => {
    const el = clusterRef.current
    if (!el) return
    const onNativeWheel = (e: WheelEvent) => {
      wheelHandlerRef.current(e)
    }
    el.addEventListener('wheel', onNativeWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onNativeWheel)
    }
  }, [])

  const handlePrev = () => {
    if (isWebMode) {
      void window.stageApi.webMusicControl('prev')
      return
    }
    if (isLocalMode) {
      if (tracks.length === 0) return
      setTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length)
      setLocalPlaying(true)
      return
    }
    void window.stageApi.mediaControl('prev')
  }

  const handleNext = () => {
    if (isWebMode) {
      void window.stageApi.webMusicControl('next')
      return
    }
    if (isLocalMode) {
      if (tracks.length === 0) return
      setTrackIndex((prev) => (prev + 1) % tracks.length)
      setLocalPlaying(true)
      return
    }
    void window.stageApi.mediaControl('next')
  }

  const handleTogglePlay = async () => {
    if (isWebMode) {
      if (!webMedia.hasSession && webMedia.status === 'idle') {
        await window.stageApi.openWebMusicWindow(musicWebUrl || undefined)
        return
      }
      await window.stageApi.webMusicControl('toggle')
      return
    }
    if (isLocalMode) {
      if (tracks.length === 0) {
        await window.stageApi.pickMusicFolder()
        return
      }
      setLocalPlaying((p) => !p)
      return
    }
    await window.stageApi.mediaControl('toggle')
  }

  const tooltipVisible = hovered || volHudVisible

  return (
    <div className="st-orb-dock">
      {isLocalMode && currentTrack && (
        <audio
          ref={audioRef}
          src={currentTrack.streamUrl}
          preload="metadata"
          onEnded={() => {
            if (tracks.length === 0) return
            if (tracks.length === 1 && audioRef.current) {
              audioRef.current.currentTime = 0
              void audioRef.current.play().catch(() => {
                setLocalPlaying(false)
              })
              return
            }
            setTrackIndex((prev) => (prev + 1) % tracks.length)
            setLocalPlaying(true)
          }}
        />
      )}

      <div
        className="st-orb-tooltip st-glass"
        data-visible={tooltipVisible ? 'true' : undefined}
        title={trackLabel}
        aria-hidden={!tooltipVisible}
      >
        <span className="st-orb-status-dot" data-playing={isPlaying ? 'true' : undefined} />
        <span className="st-orb-track">{trackLabel}</span>
        <span className="st-orb-vol-badge" data-active={volHudVisible ? 'true' : undefined}>
          {volume === 0 ? '静音' : `${volume}%`}
        </span>
      </div>

      <div
        ref={clusterRef}
        className="st-orb-cluster"
        data-interactive="true"
        data-hovered={hovered ? 'true' : undefined}
        data-playing={isPlaying ? 'true' : undefined}
        onMouseEnter={() => setHoveredWithGrace(true)}
        onMouseLeave={() => setHoveredWithGrace(false)}
      >
        <div className="st-orb-side st-orb-left">
          <button
            type="button"
            className="st-orb-mini-btn st-glass"
            title="上一首"
            aria-label="上一首"
            tabIndex={hovered ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation()
              handlePrev()
            }}
          >
            <PrevTrackIcon />
          </button>
        </div>

        <button
          type="button"
          className="st-orb-sphere"
          title={`${trackLabel}（音量 ${volume}% · 滚轮调节 · 右键切换音乐源/网页登录）`}
          aria-label="播放或暂停音乐，滚轮调节音量与水位，右键选择音乐源或网页登录"
          onClick={() => void handleTogglePlay()}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void window.stageApi.showMusicContextMenu()
          }}
        >
          <span className="st-orb-caustic" aria-hidden="true" />
          <span className="st-orb-halo" aria-hidden="true" />
          <span className="st-orb-audio-aura" aria-hidden="true" />
          <span className="st-orb-refraction" aria-hidden="true" />

          <span className="st-orb-body">
            <LiquidPearlSvg uid={svgUid} volume={volume} />
            {coverUrl && (
              <img
                className="st-orb-cover"
                data-visible={showAlbumCover ? 'true' : undefined}
                data-dimmed={volHudVisible ? 'true' : undefined}
                src={coverUrl}
                alt={currentTrack?.title || (isWebMode ? webMedia.title : smtcMedia.title) || 'Album Cover'}
                draggable={false}
              />
            )}
            <span className="st-orb-glass-overlay" aria-hidden="true" />
            <span
              className="st-orb-play-overlay"
              data-vol-hud={volHudVisible ? 'true' : undefined}
              data-paused={!isPlaying ? 'true' : undefined}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </span>
            <VolumeHudOverlay uid={svgUid} volume={volume} visible={volHudVisible} />
          </span>
        </button>

        <div className="st-orb-side st-orb-right">
          <button
            type="button"
            className="st-orb-mini-btn st-glass"
            title="下一首"
            aria-label="下一首"
            tabIndex={hovered ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation()
              handleNext()
            }}
          >
            <NextTrackIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
