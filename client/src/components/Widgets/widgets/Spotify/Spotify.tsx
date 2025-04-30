import {
  KeyboardEvent,
  useContext,
  useEffect,
  useRef,
  useState,
  WheelEvent
} from 'react'

import { FilteredSpotifyCurrentPlayingResponse } from '@/types/spotify'
import { formatTime, getClosestImage } from '@/lib/utils.ts'

import BaseWidget from '../BaseWidget/BaseWidget.tsx'

import { SocketContext } from '@/contexts/SocketContext.tsx'

import styles from './Spotify.module.css'

const Spotify: React.FC = () => {
  const { ready, socket } = useContext(SocketContext)

  const spotifyRef = useRef<HTMLDivElement>(null)

  const [playerData, setPlayerData] =
    useState<FilteredSpotifyCurrentPlayingResponse | null>(null)
  const playerDataRef = useRef(playerData)

  const [volume, setVolume] = useState(0)
  const volumeRef = useRef(volume)
  const lastVolumeChange = useRef(0)
  const [volumeAdjusted, setVolumeAdjusted] = useState(false)

  const [image, setImage] = useState('')
  const imageRef = useRef(image)

  const coverClicks = useRef(0)
  const coverClickTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  const [coverAction, setCoverAction] = useState<
    'play' | 'pause' | 'forward' | 'back' | null
  >(null)

  function playPause() {
    if (playerDataRef.current === null) return

    socket?.send(
      JSON.stringify({
        type: 'spotify',
        action: playerDataRef.current?.playing ? 'pause' : 'play'
      })
    )
    setPlayerData({
      ...playerDataRef.current!,
      playing: !playerDataRef.current?.playing
    })
  }

  function volumeUp() {
    if (playerDataRef.current === null) return

    const volume = volumeRef.current

    if (volume < 100) {
      const newVolume = Math.min(volume + 10, 100)

      socket?.send(
        JSON.stringify({
          type: 'spotify',
          action: 'volume',
          data: {
            amount: newVolume
          }
        })
      )
      setVolume(newVolume)
      volumeRef.current = newVolume
      lastVolumeChange.current = Date.now()
    }
  }

  function volumeDown() {
    if (playerDataRef.current === null) return

    const volume = volumeRef.current

    if (volume > 0) {
      const newVolume = Math.max(volume - 10, 0)
      socket?.send(
        JSON.stringify({
          type: 'spotify',
          action: 'volume',
          data: {
            amount: newVolume
          }
        })
      )

      setVolume(newVolume)
      volumeRef.current = newVolume
      lastVolumeChange.current = Date.now()
    }
  }

  function skipForward() {
    if (playerDataRef.current === null) return

    socket?.send(
      JSON.stringify({
        type: 'spotify',
        action: 'next'
      })
    )
  }

  function skipBackward() {
    if (playerDataRef.current === null) return

    socket?.send(
      JSON.stringify({
        type: 'spotify',
        action: 'previous'
      })
    )
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter') {
      playPause()
    } else if (e.key === 'ArrowLeft') {
      onWheel({ deltaX: -1 } as WheelEvent<HTMLDivElement>)
    } else if (e.key === 'ArrowRight') {
      onWheel({ deltaX: 1 } as WheelEvent<HTMLDivElement>)
    }
  }

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    if (e.deltaX < 0) {
      volumeDown()
    } else if (e.deltaX > 0) {
      volumeUp()
    }
  }

  function handleCoverPress() {
    coverClicks.current++

    if (coverClickTimer.current !== null)
      clearTimeout(coverClickTimer.current)

    coverClickTimer.current = setTimeout(() => {
      if (coverClicks.current === 1) {
        setCoverAction(playerDataRef.current?.playing ? 'pause' : 'play')
        playPause()
      } else if (coverClicks.current === 2) {
        setCoverAction('forward')
        skipForward()
      } else if (coverClicks.current === 3) {
        setCoverAction('back')
        skipBackward()
      }

      coverClicks.current = 0
    }, 200)
  }

  useEffect(() => {
    if (coverAction) {
      const timer = setTimeout(() => {
        setCoverAction(null)
      }, 500)

      return () => {
        clearTimeout(timer)
      }
    }
  }, [coverAction])

  useEffect(() => {
    if (!playerData?.playing) return
    const interval = setInterval(() => {
      setPlayerData(p => ({
        ...p!,
        duration: {
          ...p!.duration,
          current: p!.duration.current + 200
        }
      }))
    }, 200)

    return () => {
      clearInterval(interval)
    }
  }, [playerData])

  useEffect(() => {
    playerDataRef.current = playerData
  }, [playerData])

  useEffect(() => {
    setVolumeAdjusted(true)
    const timer = setTimeout(() => {
      setVolumeAdjusted(false)
    }, 2000)

    return () => {
      clearTimeout(timer)
    }
  }, [volume])

  useEffect(() => {
    if (ready === true && socket) {
      const listener = (e: MessageEvent) => {
        const { type, action, data } = JSON.parse(e.data)
        if (type !== 'spotify' || action == 'playlists') return

        if (action === 'image') {
          if (!data) return
          setImage(data)
        } else {
          if (!data) return

          if (data.session == false) {
            return setPlayerData(null)
          }
          setPlayerData(data)

          if (lastVolumeChange.current < Date.now() - 1000) {
            setVolume(data.device.volume_percent)
            volumeRef.current = data.device.volume_percent
          }

          const img = getClosestImage(data.covers, 120)
          const id = img.url.split('/').pop()!
          if (imageRef.current !== id) {
            imageRef.current = id
            socket.send(
              JSON.stringify({
                type: 'spotify',
                action: 'image',
                data: { id }
              })
            )
          }
        }
      }
      socket.addEventListener('message', listener)

      socket.send(JSON.stringify({ type: 'spotify' }))

      return () => {
        socket.removeEventListener('message', listener)
      }
    }
  }, [ready, socket])

  useEffect(() => {
    const listener = (e: globalThis.WheelEvent) => {
      if (spotifyRef.current!.matches(':focus-within')) {
        e.preventDefault()
        onWheel({
          deltaX: e.deltaX
        } as WheelEvent<HTMLDivElement>)
      }
    }

    document.addEventListener('wheel', listener, {
      passive: false
    })

    return () => {
      document.removeEventListener('wheel', listener)
    }
  })

  return (
    <BaseWidget
      className={styles.spotify}
      onKeyDown={onKeyDown}
      ref={spotifyRef}
    >
      {playerData ? (
        <>
          <button onMouseDown={handleCoverPress} className={styles.cover}>
            <div
              className={styles.action}
              data-shown={coverAction !== null}
            >
              <span
                className="material-icons"
                data-shown={coverAction === 'play'}
              >
                play_arrow
              </span>
              <span
                className="material-icons"
                data-shown={coverAction === 'pause'}
              >
                pause
              </span>
              <span
                className="material-icons"
                data-shown={coverAction === 'forward'}
              >
                skip_next
              </span>
              <span
                className="material-icons"
                data-shown={coverAction === 'back'}
              >
                skip_previous
              </span>
            </div>
            <img
              src={image}
              onLoad={e =>
                (e.currentTarget.style.width = `${e.currentTarget.parentElement!.clientHeight}px`)
              }
            />
          </button>
          <span className={styles.name}>{playerData.name}</span>
          <span className={styles.artists}>
            {playerData.artists.map(artist => artist.name).join(', ')}
          </span>
          <div className={styles.controls}>
            <button onMouseDown={skipBackward}>
              <span className="material-icons">skip_previous</span>
            </button>
            <button onMouseDown={playPause}>
              <span className="material-icons">
                {playerData.playing ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <button onMouseDown={skipForward}>
              <span className="material-icons">skip_next</span>
            </button>
          </div>
          <div className={styles.progress}>
            <p>{formatTime(playerData.duration.current)}</p>
            <div className={styles.slider}>
              <div
                className={styles.fill}
                style={{
                  width: `${
                    (playerData.duration.current /
                      playerData.duration.total) *
                    100
                  }%`
                }}
              ></div>
            </div>
            <p>{formatTime(playerData.duration.total)}</p>
          </div>
          {playerData.device.supports_volume && (
            <div className={styles.volume} data-shown={volumeAdjusted}>
              <button onMouseDown={volumeDown}>
                <span className="material-icons"> volume_down </span>
              </button>
              <div className={styles.slider}>
                <div
                  className={styles.fill}
                  style={{ width: `${volume}%` }}
                ></div>
              </div>
              <button onMouseDown={volumeUp}>
                <span className="material-icons"> volume_up </span>
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.notPlaying}>
          <span className="material-icons">music_note</span>
          <p className={styles.title}>Nothing playing!</p>
          <p className={styles.note}>
            Open Spotify on your computer and start playing something.
          </p>
        </div>
      )}
    </BaseWidget>
  )
}

export default Spotify
