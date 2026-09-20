import { useEffect, useRef, useState } from "react"
import {
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { musicPlaylist, siteContent } from "@/config/site"

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00"

  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function MusicPlayerCard() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const shouldPlayAfterTrackChange = useRef(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [hasError, setHasError] = useState(false)
  const currentTrack = musicPlaylist[currentIndex]

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.load()
    if (!shouldPlayAfterTrackChange.current) return

    shouldPlayAfterTrackChange.current = false
    void audio.play().catch(() => {
      setIsPlaying(false)
      setHasError(true)
    })
  }, [currentIndex])

  useEffect(() => {
    const audio = audioRef.current
    return () => audio?.pause()
  }, [])

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      return
    }

    setHasError(false)
    try {
      await audio.play()
      setIsPlaying(true)
    } catch {
      setIsPlaying(false)
      setHasError(true)
    }
  }

  function changeTrack(nextIndex: number) {
    shouldPlayAfterTrackChange.current = true
    setHasError(false)
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(true)
    setCurrentIndex(nextIndex)
  }

  function playPrevious() {
    const previousIndex =
      (currentIndex - 1 + musicPlaylist.length) % musicPlaylist.length
    changeTrack(previousIndex)
  }

  function playNext() {
    const nextIndex = (currentIndex + 1) % musicPlaylist.length
    changeTrack(nextIndex)
  }

  function seek(value: number) {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = value
    setCurrentTime(value)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{currentTrack.title}</CardTitle>
        <CardDescription>{currentTrack.artist}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <audio
          hidden
          onEnded={playNext}
          onError={() => {
            setHasError(true)
            setIsPlaying(false)
          }}
          onLoadedMetadata={(event) => {
            setDuration(event.currentTarget.duration)
          }}
          onTimeUpdate={(event) => {
            setCurrentTime(event.currentTarget.currentTime)
          }}
          preload="metadata"
          ref={audioRef}
          src={currentTrack.src}
        />

        <div className="flex items-center justify-center gap-2">
          <Button
            aria-label={siteContent.ui.sidebar.music.previousTrack}
            onClick={playPrevious}
            size="icon"
            type="button"
            variant="ghost"
          >
            <SkipBackIcon />
          </Button>
          <Button
            aria-label={
              isPlaying
                ? siteContent.ui.sidebar.music.pause
                : siteContent.ui.sidebar.music.play
            }
            onClick={() => void togglePlayback()}
            size="icon"
            type="button"
            variant="ghost"
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <Button
            aria-label={siteContent.ui.sidebar.music.nextTrack}
            onClick={playNext}
            size="icon"
            type="button"
            variant="ghost"
          >
            <SkipForwardIcon />
          </Button>
        </div>

        {hasError ? (
          <p className="text-center text-xs text-destructive">
            {siteContent.ui.sidebar.music.loadError}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <input
            aria-label={siteContent.ui.sidebar.music.seek}
            className="h-1 min-w-0 flex-1 cursor-pointer accent-primary"
            max={duration || 0}
            min="0"
            onChange={(event) => seek(Number(event.target.value))}
            step="0.1"
            type="range"
            value={Math.min(currentTime, duration || 0)}
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
