import { filterData, setupSpotify } from '../spotify.js'
import { getSpotifyCS, getSpotifyCID, getSpotifyToken } from '../storage.js'
import { wss } from '../server.js'
import { log } from '../utils.js'

import { AuthenticatedWebSocket } from '../../types/WebSocketServer.js'
import { SetupFunction } from '../../types/WebSocketSetup.js'

export const name = 'spotify'

export const setup: SetupFunction = async () => {
  const spotify = setupSpotify(getSpotifyCID(), getSpotifyCS(), getSpotifyToken())

  spotify.on('PLAYER_STATE_CHANGED', data => {
    if (!wss) return
    wss.clients.forEach(async (ws: AuthenticatedWebSocket) => {
      if (!ws.authenticated) return

      if (ws.readyState === 1) {
        if (data.state.currently_playing_type === 'episode') {
          ws.send(
            JSON.stringify({
              type: 'spotify',
              data: await spotify.getCurrent()
            })
          )
        } else if (data.state.currently_playing_type === 'track') {
          ws.send(
            JSON.stringify({
              type: 'spotify',
              data: filterData(data.state)
            })
          )
        }
      }
    })
  })

  spotify.on('DEVICE_STATE_CHANGED', data => {
    if (data.devices.some(d => d.is_active)) return
    if (!wss) return
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (!ws.authenticated) return

      if (ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: 'spotify',
            data: { session: false }
          })
        )
      }
    })
  })

  spotify.on('close', async () => {
    log(
      'Connection closed, attempting to reopen after 5 seconds...',
      'Spotify'
    )
    await new Promise(r => setTimeout(r, 5000))
    await spotify.start()
  })

  spotify.on('open', () => {
    log('Connection opened', 'Spotify')
  })

  spotify.on('error', err => {
    log(`An error occurred: ${err}`, 'Spotify')
  })

  await spotify.start()

  return async () => {
    spotify.close()
  }
}
