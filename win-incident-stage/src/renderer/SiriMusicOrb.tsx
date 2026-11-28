import { useCallback, useEffect, useRef, useState } from 'react'
import type { LocalMusicLibrary, MediaState } from '../shared/types.ts'
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

/** Reference Image 2 Chromatic-Horizon Glass Sphere (used when idle/paused or no album art). */
function HorizonPearlSvg() {
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
        <linearGradient id="stg-pearl-silver" x1="25%" y1="35%" x2="72%" y2="96%">
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

        {/* Lower liquid-silver dome along smooth S-curve horizon */}
        <path
          d="M -6 44 C 18 33, 38 40, 56 50 C 74 59, 88 53, 106 47 L 106 106 L -6 106 Z"
          fill="url(#stg-pearl-silver)"
        />

        {/* Warm copper/amber top chromatic dispersion band */}
        <path
          d="M -6 41 C 18 30, 38 37, 56 47 C 74 56, 88 50, 106 44"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="6.5"
          opacity="0.82"
          filter="url(#stg-horizon-blur)"
        />

        {/* Cool cyan-blue lower chromatic dispersion band */}
        <path
          d="M -6 47 C 18 36, 38 43, 56 53 C 74 62, 88 56, 106 50"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="6.5"
          opacity="0.78"
          filter="url(#stg-horizon-blur)"
        />

        {/* Luminous white chromatic horizon core crest */}
        <path
          d="M -6 44 C 18 33, 38 40, 56 50 C 74 59, 88 53, 106 47"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.6"
          opacity="0.96"
          filter="url(#stg-horizon-glow)"
        />

        {/* Soft bottom reflection highlight & optical glass inner rim */}
        <ellipse cx="48" cy="86" rx="30" ry="9" fill="rgba(255,255,255,0.28)" filter="url(#stg-horizon-blur)" />
        <rect x="0" y="0" width="100" height="100" fill="url(#stg-pearl-rim)" />
      </g>
    </svg>
  )
}

export function SiriMusicOrb() {
  const [media, setMedia] = useState<MediaState>(EMPTY_MEDIA)
  const [localLib, setLocalLib] = useState<LocalMusicLibrary>(EMPTY_LIBRARY)
  const [trackIndex, setTrackIndex] = useState(0)
  const [localPlaying, setLocalPlaying] = useState(false)
  const [hovered, setHovered] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hoverTimerRef = useRef<number | null>(null)

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
  }, [])

  useEffect(() => {
    void window.stageApi.getMediaState().then(setMedia).catch(() => undefined)
    void window.stageApi.getLocalMusic().then(setLocalLib).catch(() => undefined)
    const offMedia = window.stageApi.onMediaState(setMedia)
    const offLocal = window.stageApi.onLocalMusicChanged((lib) => {
      setLocalLib(lib)
      setTrackIndex(0)
      if (!lib.folderPath || lib.tracks.length === 0) {
        setLocalPlaying(false)
      }
    })
    return () => {
      offMedia()
      offLocal()
    }
  }, [])

  const isLocalMode = localLib.folderPath.trim() !== ''
  const tracks = localLib.tracks
  const safeTrackIdx = tracks.length > 0 ? trackIndex % tracks.length : 0
  const currentTrack = tracks[safeTrackIdx] ?? null

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !isLocalMode || !currentTrack) return
    if (localPlaying) {
      void audio.play().catch(() => {
        setLocalPlaying(false)
      })
    } else {
      audio.pause()
    }
  }, [isLocalMode, currentTrack?.streamUrl, localPlaying])

  const isPlaying = isLocalMode ? localPlaying && Boolean(currentTrack) : media.status === 'playing'
  const coverUrl = isLocalMode ? (currentTrack?.coverDataUrl ?? null) : media.thumbnailDataUrl
  const showAlbumCover = isPlaying && Boolean(coverUrl)

  const trackLabel = isLocalMode
    ? currentTrack
      ? `${currentTrack.title}${currentTrack.artist ? ` · ${currentTrack.artist}` : ''}`
      : '文件夹暂无音频 · 右键更换播放文件夹'
    : media.title
      ? `${media.title}${media.artist ? ` · ${media.artist}` : ''}`
      : media.hasSession
        ? '系统媒体会话已连接 · 右键选本地文件夹'
        : '点击播放/暂停 · 右键选择播放文件夹'

  const handlePrev = () => {
    if (isLocalMode) {
      if (tracks.length === 0) return
      setTrackIndex(prev => (prev - 1 + tracks.length) % tracks.length)
      setLocalPlaying(true)
      return
    }
    void window.stageApi.mediaControl('prev')
  }

  const handleNext = () => {
    if (isLocalMode) {
      if (tracks.length === 0) return
      setTrackIndex(prev => (prev + 1) % tracks.length)
      setLocalPlaying(true)
      return
    }
    void window.stageApi.mediaControl('next')
  }

  const handleTogglePlay = async () => {
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

      {hovered && (
        <div className="stg-orb-tooltip" title={trackLabel}>
          <span className="stg-orb-status-dot" data-playing={isPlaying ? 'true' : undefined} />
          <span className="stg-orb-track">{trackLabel}</span>
        </div>
      )}

      <div
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
          title={`${trackLabel}（左键播放/暂停 · 右键打开/更换播放文件夹）`}
          aria-label="播放或暂停音乐，右键打开播放文件夹"
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
            <HorizonPearlSvg />
            {coverUrl && (
              <img
                className="stg-drop-cover"
                data-visible={showAlbumCover ? 'true' : undefined}
                src={coverUrl}
                alt={currentTrack?.title || media.title || 'Album Cover'}
                draggable={false}
              />
            )}
            <span className="stg-drop-meniscus" />
            <span className="stg-drop-play-overlay">
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
