import { useContext, useEffect, useRef } from 'react'
import type { KeyboardEvent, WheelEvent } from 'react'

import BaseWidget from '../BaseWidget/BaseWidget.tsx'

import { SocketContext } from '@/contexts/SocketContext.tsx'

import styles from './Controls.module.css'

interface ControlsProps {
  setPlaylistsShown: React.Dispatch<React.SetStateAction<boolean>>
}

const Controls: React.FC<ControlsProps> = ({setPlaylistsShown}) => {
  const { socket } = useContext(SocketContext)

  const controlsRef = useRef<HTMLDivElement>(null)

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') {
      onWheel({ deltaX: -1 } as WheelEvent<HTMLDivElement>)
    } else if (e.key === 'ArrowRight') {
      onWheel({ deltaX: 1 } as WheelEvent<HTMLDivElement>)
    }
  }

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    const focused = document.activeElement as HTMLElement
    if (e.deltaX < 0) {
      const prev = focused.previousElementSibling as HTMLElement
      if (prev) {
        prev.focus()
      } else {
        const last = controlsRef.current?.lastElementChild as HTMLElement
        last.focus()
      }
    } else if (e.deltaX > 0) {
      const next = focused.nextElementSibling as HTMLElement
      if (next) {
        next.focus()
      } else {
        const first = controlsRef.current?.firstElementChild as HTMLElement
        first.focus()
      }
    }
  }

  function onFocus() {
    if (document.activeElement !== controlsRef.current) return
    const first = controlsRef.current?.firstElementChild as HTMLElement
    first.focus()
  }

  function lock() {
    socket?.send(
      JSON.stringify({
        type: 'lock'
      })
    )
  }

  useEffect(() => {
    const listener = (e: globalThis.WheelEvent) => {
      if (controlsRef.current?.querySelector(':focus-within')) {
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
  }, [])

  return (
    <BaseWidget
      className={styles.controls}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      ref={controlsRef}
    >
      <div
        className={styles.control}
        tabIndex={-1}
        data-type="lock"
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.stopPropagation()
            lock()
          }
        }}
        onClick={() => lock()}
      >
        <span className="material-icons">lock</span>
        <p>Lock</p>
      </div>
      <div
        className={styles.control}
        tabIndex={-1}
        data-type="playlists"
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.stopPropagation()
            setPlaylistsShown(true)
          }
        }}
        onClick={() => setPlaylistsShown(true)}
      >
        <span className="material-icons">menu</span>
        <p>Playlists</p>
      </div>
    </BaseWidget>
  )
}

export default Controls
