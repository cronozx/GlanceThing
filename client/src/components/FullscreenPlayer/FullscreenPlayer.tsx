import React, {
  KeyboardEvent,
  useContext,
  useEffect,
  useRef,
  useState,
  WheelEvent
} from 'react'

import { MediaContext } from '@/contexts/MediaContext.tsx'
import { SocketContext } from '@/contexts/SocketContext.tsx'

import styles from './FullscreenPlayer.module.css'

interface FullescreenPlayerProps {
  shown: boolean
  setShown: React.Dispatch<React.SetStateAction<boolean>>
}

const FullescreenPlayer: React.FC<FullescreenPlayerProps> = ({
  shown,
  setShown
}) => {
  const { socket } = useContext(SocketContext)
  const { image, playerData, actions } = useContext(MediaContext)
  const playerDataRef = useRef(playerData)
  const playerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (shown) playerRef.current?.focus()
    else playerRef.current?.blur()
  }, [shown])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.preventDefault()

    if (e.key === 'Enter') {
      actions.playPause()
    } else if (e.key === 'ArrowLeft') {
      onWheel({ deltaX: -1 } as WheelEvent<HTMLDivElement>)
    } else if (e.key === 'ArrowRight') {
      onWheel({ deltaX: 1 } as WheelEvent<HTMLDivElement>)
    } else if (e.key === 'Escape') {
      setShown(false)
    }
  }

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    if (e.deltaX < 0) {
      volumeDown()
    } else if (e.deltaX > 0) {
      volumeUp()
    }
  }

  const [volume, setVolume] = useState(0)
  const volumeRef = useRef(volume)
  const lastVolumeChange = useRef(0)
  const [volumeAdjusted, setVolumeAdjusted] = useState(false)

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
    if (socket) {
      const listener = (e: MessageEvent) => {
        const { type, action, data } = JSON.parse(e.data)
        if (type !== 'spotify') return

        if (!data || action || !data.session) return

        if (lastVolumeChange.current < Date.now() - 1000) {
          setVolume(data.device.volume_percent)
          volumeRef.current = data.device.volume_percent
        }
      }
      socket.addEventListener('message', listener)

      socket.send(JSON.stringify({ type: 'spotify' }))

      return () => {
        socket.removeEventListener('message', listener)
      }
    }
  }, [socket])

  if (!shown) {
    return <div>Empty</div>
  }

  return (
    <div
      className={styles.player}
      data-shown={shown}
      ref={playerRef}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      tabIndex={-1}
    >
      <button
        onClick={e => {
          setShown(false)
          e.currentTarget.blur()
        }}
        className={styles.close}
      >
        <span className="material-icons">keyboard_arrow_down</span>
      </button>
      {playerData ? (
        <>
          <img src={image || ''} alt="" className={styles.background} />
          <div className={styles.track}>
            <img src={image || ''} alt="" />
            <div className={styles.info}>
              <div className={styles.title}>{playerData?.name}</div>
              <div className={styles.artist}>
                {playerData?.artists.map(a => a.name).join(', ')}
              </div>
            </div>
          </div>
          <div className={styles.progress}>
            <div
              className={styles.bar}
              style={{
                width: `${((playerData?.duration.current || 0) / (playerData?.duration.total || 1)) * 100}%`
              }}
            ></div>
          </div>
          <div
            className={styles.controls}
            data-hide-buttons={volumeAdjusted}
          >
            {playerData?.device.supports_volume && (
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
            {playerData?.type === 'track' ? (
              <button
                data-shuffle-state={playerData?.shuffle_state}
                onClick={() =>
                  actions.shuffle(playerData?.shuffle_state ? false : true)
                }
              >
                <span className="material-icons">shuffle</span>
              </button>
            ) : null}
            <button onClick={() => actions.skipBackward()}>
              <span className="material-icons">skip_previous</span>
            </button>
            <button onClick={() => actions.playPause()}>
              <span className="material-icons">
                {playerData?.playing ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <button onClick={() => actions.skipForward()}>
              <span className="material-icons">skip_next</span>
            </button>
            {playerData?.type === 'track' ? (
              <button
                data-repeat-state={playerData?.repeat_state !== 'off'}
                onClick={() =>
                  actions.repeat(
                    playerData?.repeat_state === 'off'
                      ? 'context'
                      : playerData?.repeat_state === 'context'
                        ? 'track'
                        : 'off'
                  )
                }
              >
                <span className="material-icons">
                  {playerData?.repeat_state === 'off'
                    ? 'repeat'
                    : playerData?.repeat_state === 'context'
                      ? 'repeat'
                      : 'repeat_one'}
                </span>
              </button>
            ) : null}
          </div>
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
    </div>
  )
}

export default FullescreenPlayer
