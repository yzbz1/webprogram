import { useCallback, useEffect, useRef, useState } from 'react'
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

const WAVE_FRONT_STROKE_PATH =
  'M 0 0 C 18 -12, 32 -12, 50 0 C 68 12, 82 12, 100 0 C 118 -12, 132 -12, 150 0 C 168 12, 182 12, 200 0'
const WAVE_FRONT_FILL_PATH = `${WAVE_FRONT_STROKE_PATH} L 200 120 L 0 120 Z`
const WAVE_BACK_FILL_PATH =
  'M 0 3 C 18 10, 32 10, 50 3 C 68 -7, 82 -7, 100 3 C 118 10, 132 10, 150 3 C 168 -7, 182 -7, 200 3 L 200 120 L 0 120 Z'

/** Animated Liquid-Horizon Glass Sphere: water level rises/falls with volume and undulates smoothly. */
function HorizonPearlSvg({ volume, playing }: { volume: number; playing: boolean }) {
  const clampedVol = Math.max(0, Math.min(100, volume))
  const waterY = 92 - (clampedVol / 100) * 82

  return (
    <svg className="stg-horizon-orb" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <clipPath id="stg-pearl-clip">
          <circle cx="50" cy="50" r="49" />
        </clipPath>
        <radialGradient id="stg-pearl-dark" cx="55%" cy="22%" r="68%">
          <stop offset="0%" stopColor="#3c424d" />
          <stop offset="48%" stopColor="#1b1f27" />
          <stop offset="100%" stopColor="#090b0f" />
        </radialGradient>
        <linearGradient id="stg-pearl-silver" x1="25%" y1="0%" x2="72%" y2="85%">
          <stop offset="0%" stopColor="#6a7585" />
          <stop offset="28%" stopColor="#a7b2c0" />
          <stop offset="56%" stopColor="#e5ebf3" />
          <stop offset="82%" stopColor="#aeb8c7" />
          <stop offset="100%" stopColor="#4f5866" />
        </linearGradient>
        <radialGradient id="stg-pearl-rim" cx="50%" cy="50%" r="50%">
          <stop offset="76%" stopColor="rgba(0,0,0,0)" />
          <stop offset="94%" stopColor="rgba(12,16,24,0.36)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.42)" />
        </radialGradient>
        <filter id="stg-horizon-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.4" />
        </filter>
        <filter id="stg-horizon-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      <g clipPath="url(#stg-pearl-clip)">
        {/* Upper obsidian dome */}
        <rect x="0" y="0" width="100" height="100" fill="url(#stg-pearl-dark)" />

        {/* Vertically positioned liquid water level (driven by volume 0..100%) */}
        <g
          className="stg-water-level"
          data-playing={playing ? 'true' : undefined}
          style={{ transform: `translateY(${waterY.toFixed(1)}px)` }}
        >
          {/* Secondary translucent back wave sliding in reverse for liquid depth */}
          <g className="stg-water-wave-back">
            <path d={WAVE_BACK_FILL_PATH} fill="rgba(56, 189, 248, 0.24)" />
          </g>

          {/* Primary liquid-silver dome & chromatic dispersion crest sliding forward */}
          <g className="stg-water-wave-front">
            <path d={WAVE_FRONT_FILL_PATH} fill="url(#stg-pearl-silver)" />
            <g transform="translate(0, -3)">
              <path
                d={WAVE_FRONT_STROKE_PATH}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="6.5"
                opacity="0.82"
                filter="url(#stg-horizon-blur)"
              />
            </g>
            <g transform="translate(0, 3)">
              <path
                d={WAVE_FRONT_STROKE_PATH}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="6.5"
                opacity="0.78"
                filter="url(#stg-horizon-blur)"
              />
            </g>
            <path
              d={WAVE_FRONT_STROKE_PATH}
              fill="none"
              stroke="#ffffff"
              strokeWidth="3.6"
              opacity="0.96"
              filter="url(#stg-horizon-glow)"
            />
          </g>
        </g>

        {/* Soft bottom reflection highlight & optical glass inner rim */}
        <ellipse cx="48" cy="86" rx="30" ry="9" fill="rgba(255,255,255,0.28)" filter="url(#stg-horizon-blur)" />
        <rect x="0" y="0" width="100" height="100" fill="url(#stg-pearl-rim)" />
      </g>
    </svg>
  )
}

export interface SiriMusicOrbProps {
  readonly musicSource: MusicSourceMode
  readonly musicWebUrl: string
  readonly musicVolume: number
}

export function SiriMusicOrb({ musicSource, musicWebUrl, musicVolume }: SiriMusicOrbProps) {
  const [smtcMedia, setSmtcMedia] = useState<MediaState>(EMPTY_MEDIA)
  const [webMedia, setWebMedia] = useState<MediaState>(EMPTY_MEDIA)
  const [localLib, setLocalLib] = useState<LocalMusicLibrary>(EMPTY_LIBRARY)
  const [trackIndex, setTrackIndex] = useState(0)
  const [localPlaying, setLocalPlaying] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [volume, setVolume] = useState(() => Math.max(0, Math.min(100, Math.round(musicVolume))))
  const [volHudVisible, setVolHudVisible] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const clusterRef = useRef<HTMLDivElement | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const volHudTimerRef = useRef<number | null>(null)
  const volSaveTimerRef = useRef<number | null>(null)
  const pendingVolRef = useRef<number>(musicVolume)
  const lastWheelAtRef = useRef<number>(0)
  const wheelHandlerRef = useRef<(e: WheelEvent) => void>(() => {})

  useEffect(() => {
    if (Date.now() - lastWheelAtRef.current < 450) return
    const clean = Math.max(0, Math.min(100, Math.round(musicVolume)))
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

  useEffect(() => () => {
    if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current)
    if (volHudTimerRef.current !== null) window.clearTimeout(volHudTimerRef.current)
    if (volSaveTimerRef.current !== null) window.clearTimeout(volSaveTimerRef.current)
  }, [])

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
      void audio.play().catch(() => {
        setLocalPlaying(false)
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

  const handleWheelVolume = useCallback((e: WheelEvent) => {
    if (Math.abs(e.deltaY) < 0.5) return
    e.preventDefault()
    e.stopPropagation()

    lastWheelAtRef.current = Date.now()
    const up = e.deltaY < 0
    const step = musicSource === 'smtc' ? 4 : 5
    const nextVol = Math.max(0, Math.min(100, pendingVolRef.current + (up ? step : -step)))
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
  }, [musicSource])

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
      setTrackIndex(prev => (prev - 1 + tracks.length) % tracks.length)
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
      setTrackIndex(prev => (prev + 1) % tracks.length)
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
      setLocalPlaying(p => !p)
      return
    }
    await window.stageApi.mediaControl('toggle')
  }

  return (
    <div className="stg-orb-dock">
      {isLocalMode && currentTrack && (
        <audio
          ref={audioRef}
          src={currentTrack.streamUrl}
          preload="metadata"
          onEnded={() => {
            if (tracks.length > 0) {
              setTrackIndex(prev => (prev + 1) % tracks.length)
              setLocalPlaying(true)
            }
          }}
        />
      )}

      {(hovered || volHudVisible) && (
        <div className="stg-orb-tooltip" title={trackLabel}>
          <span className="stg-orb-status-dot" data-playing={isPlaying ? 'true' : undefined} />
          <span className="stg-orb-track">{trackLabel}</span>
          <span className="stg-orb-vol-badge" data-active={volHudVisible ? 'true' : undefined}>
            {volume === 0 ? '静音' : `${volume}%`}
          </span>
        </div>
      )}

      <div
        ref={clusterRef}
        className="stg-drop-cluster"
        data-interactive="true"
        data-hovered={hovered ? 'true' : undefined}
        data-playing={isPlaying ? 'true' : undefined}
        onMouseEnter={() => setHoveredWithGrace(true)}
        onMouseLeave={() => setHoveredWithGrace(false)}
      >
        <div className="stg-drop-side stg-drop-left">
          <button
            type="button"
            className="stg-orb-mini-btn"
            title="上一首"
            aria-label="上一首"
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
          className="stg-drop-sphere"
          title={`${trackLabel}（音量 ${volume}% · 滚轮调节 · 右键切换音乐源/网页登录）`}
          aria-label="播放或暂停音乐，滚轮调节音量与水位，右键选择音乐源或网页登录"
          onClick={() => void handleTogglePlay()}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void window.stageApi.showMusicContextMenu()
          }}
        >
          <span className="stg-blackhole-halo" aria-hidden="true" />
          <span className="stg-blackhole-disk" aria-hidden="true" />

          <span className="stg-drop-body">
            <HorizonPearlSvg volume={volume} playing={isPlaying} />
            {coverUrl && (
              <img
                className="stg-drop-cover"
                data-visible={showAlbumCover ? 'true' : undefined}
                data-dimmed={volHudVisible ? 'true' : undefined}
                src={coverUrl}
                alt={currentTrack?.title || (isWebMode ? webMedia.title : smtcMedia.title) || 'Album Cover'}
                draggable={false}
              />
            )}
            <span className="stg-drop-meniscus" />
            <span className="stg-drop-play-overlay" data-vol-hud={volHudVisible ? 'true' : undefined}>
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </span>
          </span>
        </button>

        <div className="stg-drop-side stg-drop-right">
          <button
            type="button"
            className="stg-orb-mini-btn"
            title="下一首"
            aria-label="下一首"
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
