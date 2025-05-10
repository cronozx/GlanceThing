import { fetchImage, fetchPlaylistImage, spotify } from '../spotify.js'
import { log, LogLevel } from '../utils.js'

import {
  HandlerAction,
  HandlerFunction
} from '../../types/WebSocketHandler.js'

export const name = 'spotify'

export const hasActions = true

export const actions: HandlerAction[] = [
  {
    action: 'pause',
    handle: async () => {
      const res = await spotify!.setPlaying(false)
      if (res === false) log('Failed to pause', 'Spotify', LogLevel.ERROR)
    }
  },
  {
    action: 'play',
    handle: async () => {
      const res = await spotify!.setPlaying(true)
      if (res === false) log('Failed to play', 'Spotify', LogLevel.ERROR)
    }
  },
  {
    action: 'volume',
    handle: async (_ws, data) => {
      const res = await spotify!.setVolume(
        (data as { amount: number }).amount
      )
      if (res === false)
        log('Failed to set volume', 'Spotify', LogLevel.ERROR)
    }
  },
  {
    action: 'image',
    handle: async (ws, data) => {
      const res = await fetchImage((data as { id: string }).id)
      ws.send(
        JSON.stringify({
          type: 'spotify',
          action: 'image',
          data: res
        })
      )
    }
  },
  {
    action: 'previous',
    handle: async () => {
      const res = await spotify!.previous()
      if (res === false)
        log('Failed to go to previous track', 'Spotify', LogLevel.ERROR)
    }
  },
  {
    action: 'next',
    handle: async () => {
      const res = await spotify!.next()
      if (res === false)
        log('Failed to go to next track', 'Spotify', LogLevel.ERROR)
    }
  },
  {
    action: 'shuffle',
    handle: async (_, data) => {
      const res = await spotify!.shuffle(
        (data as { state: boolean }).state
      )
      if (res === false)
        log('Failed to toggle shuffle', 'Spotify', LogLevel.ERROR)
    }
  },
  {
    action: 'repeat',
    handle: async (_, data) => {
      const res = await spotify!.repeat(
        (data as { state: 'track' | 'context' | 'off' }).state
      )
      if (res === false)
        log('Failed to toggle repeat', 'Spotify', LogLevel.ERROR)
    }
  },
  {
    action: 'playlists',
    handle: async (ws) => {
      const res = await spotify!.getPlaylists()

      const modified = await Promise.all(
        res.items.map(async item => {
          const imageBase64 = await fetchPlaylistImage(item.id)

          return {
            track: {
              id: item.id,
              name: item.name,
              description: item.description, 
              image: imageBase64,
              tracks: item.tracks.total
            }
          }
        })
      )

      ws.send(JSON.stringify({
        type:   'spotify',
        action: 'playlists',
        data:   modified
      }))
    }
  },
  {
    action: 'playPlaylist',
    handle: async (_, data) => {
      const res = await spotify!.playPlaylist(
        (data as { playlistID: string }).playlistID
      )
      if (res === false)
        log('Failed to play playlist', 'Spotify', LogLevel.ERROR)
    }
  }
]

export const handle: HandlerFunction = async ws => {
  const res = await spotify!.getCurrent()
  ws.send(
    JSON.stringify({
      type: 'spotify',
      data: res
    })
  )
}
