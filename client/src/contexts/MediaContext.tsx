import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'

import { getClosestImage } from '@/lib/utils.ts'
import { SocketContext } from './SocketContext.tsx'

import { FilteredSpotifyCurrentPlayingResponse } from '@/types/spotify.js'

interface MediaContextProps {
  image: string
  playerData: FilteredSpotifyCurrentPlayingResponse | null
  actions: {
    playPause: () => void
    skipForward: () => void
    skipBackward: () => void
    shuffle: (state: boolean) => void
    repeat: (state: 'off' | 'context' | 'track') => void
  }
}

const MediaContext = createContext<MediaContextProps>({
  image: '',
  playerData: null,
  actions: {
    playPause: () => {},
    skipForward: () => {},
    skipBackward: () => {},
    shuffle: () => {},
    repeat: () => {}
  }
})

interface MediaContextProviderProps {
  children: React.ReactNode
}

const MediaContextProvider = ({ children }: MediaContextProviderProps) => {
  const { ready, socket } = useContext(SocketContext)
  const [image, setImage] = useState('')
  const imageRef = useRef('')
  const [playerData, setPlayerData] =
    useState<FilteredSpotifyCurrentPlayingResponse | null>(null)
  const playerDataRef =
    useRef<FilteredSpotifyCurrentPlayingResponse | null>(null)

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

          if (data.session == false) return setPlayerData(null)

          setPlayerData(data)

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

  const actions = {
    playPause: () => {
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
    },
    skipForward: () => {
      if (playerDataRef.current === null) return

      socket?.send(
        JSON.stringify({
          type: 'spotify',
          action: 'next'
        })
      )
    },
    skipBackward: () => {
      if (playerDataRef.current === null) return

      socket?.send(
        JSON.stringify({
          type: 'spotify',
          action: 'previous'
        })
      )
    },
    shuffle: (state: boolean) => {
      if (playerDataRef.current === null) return
      socket?.send(
        JSON.stringify({
          type: 'spotify',
          action: 'shuffle',
          data: {
            state
          }
        })
      )

      setPlayerData({
        ...playerDataRef.current!,
        shuffle_state: state
      })
    },
    repeat: (state: 'off' | 'context' | 'track') => {
      if (playerDataRef.current === null) return

      socket?.send(
        JSON.stringify({
          type: 'spotify',
          action: 'repeat',
          data: {
            state
          }
        })
      )

      setPlayerData({
        ...playerDataRef.current!,
        repeat_state: state
      })
    },
  }

  return (
    <MediaContext.Provider
      value={{
        image,
        playerData,
        actions
      }}
    >
      {children}
    </MediaContext.Provider>
  )
}

export { MediaContext, MediaContextProvider }
