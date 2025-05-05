import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { TOTP } from 'totp-generator'
import EventEmitter from 'events'
import WebSocket from 'ws'

import { log, LogLevel } from './utils.js'

async function subscribe(connection_id: string, token: string) {
  return await axios.put(
    'https://api.spotify.com/v1/me/notifications/player',
    null,
    {
      params: {
        connection_id
      },
      headers: {
        Authorization: `Bearer ${token}`
      },
      validateStatus: () => true
    }
  )
}

function base32FromBytes(bytes: Uint8Array, secretSauce: string): string {
  let t = 0
  let n = 0
  let r = ''

  for (let i = 0; i < bytes.length; i++) {
    n = (n << 8) | bytes[i]
    t += 8
    while (t >= 5) {
      r += secretSauce[(n >>> (t - 5)) & 31]
      t -= 5
    }
  }

  if (t > 0) {
    r += secretSauce[(n << (5 - t)) & 31]
  }

  return r
}

function cleanBuffer(e: string): Uint8Array {
  e = e.replace(' ', '')
  const buffer = new Uint8Array(e.length / 2)
  for (let i = 0; i < e.length; i += 2) {
    buffer[i / 2] = parseInt(e.substring(i, i + 2), 16)
  }
  return buffer
}

async function generateTotp(): Promise<{
  otp: string
  timestamp: number
}> {
  const secretSauce = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

  const secretCipherBytes = [
    12, 56, 76, 33, 88, 44, 88, 33, 78, 78, 11, 66, 22, 22, 55, 69, 54
  ].map((e, t) => e ^ ((t % 33) + 9))

  const secretBytes = cleanBuffer(
    new TextEncoder()
      .encode(secretCipherBytes.join(''))
      .reduce((acc, val) => acc + val.toString(16).padStart(2, '0'), '')
  )

  const secret = base32FromBytes(secretBytes, secretSauce)

  const res = await axios.get('https://open.spotify.com/server-time')
  const timestamp = res.data.serverTime * 1000

  const totp = TOTP.generate(secret, {
    timestamp
  })

  return {
    otp: totp.otp,
    timestamp
  }
}

export async function getToken(sp_dc: string) {
  const totp = await generateTotp()

  const res = await axios.get(
    'https://open.spotify.com/get_access_token',
    {
      headers: {
        cookie: `sp_dc=${sp_dc};`,
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      },
      params: {
        reason: 'init',
        productType: 'web-player',
        totp: totp.otp,
        totpVer: '5',
        ts: totp.timestamp
      },
      validateStatus: () => true
    }
  )

  if (res.status !== 200) throw new Error('Invalid sp_dc')

  if (!res.data.accessToken) throw new Error('Invalid sp_dc')

  return res.data.accessToken
}

interface SpotifyTrackItem {
  name: string
  external_urls: {
    spotify: string
  }
  artists: {
    name: string
    external_urls: {
      spotify: string
    }
  }[]
  album: {
    name: string
    href: string
    images: {
      url: string
      width: number
      height: number
    }[]
  }
  duration_ms: number
}

interface SpotifyEpisodeItem {
  name: string
  external_urls: {
    spotify: string
  }
  images: {
    url: string
    width: number
    height: number
  }[]
  show: {
    name: string
    publisher: string
    external_urls: {
      spotify: string
    }
    href: string
    images: {
      url: string
      width: number
      height: number
    }[]
  }
  duration_ms: number
}

export interface SpotifyCurrentPlayingResponse {
  device: {
    id: string
    is_active: boolean
    is_private_session: boolean
    is_restricted: boolean
    name: string
    type: string
    volume_percent: number
    supports_volume: boolean
  }
  repeat_state: string
  shuffle_state: boolean
  context: {
    external_urls: {
      spotify: string
    }
    href: string
    type: string
    uri: string
  }
  timestamp: number
  progress_ms: number
  currently_playing_type: 'track' | 'episode'
  is_playing: boolean
  item: SpotifyTrackItem | SpotifyEpisodeItem
}

interface FilteredSpotifyCurrentPlayingResponse {
  session: true
  type: 'track' | 'episode'
  playing: boolean
  name: string
  trackURL: string
  repeat_state: string
  shuffle_state: boolean
  artists: {
    name: string
    url: string
  }[]
  album: {
    name: string
    url: string
  }
  covers: {
    url: string
    width: number
    height: number
  }[]
  duration: {
    current: number
    total: number
  }
  device: {
    volume_percent: number
    supports_volume: boolean
  }
}

interface NoSessionResponse {
  session: false
}

export function filterData(
  data: SpotifyCurrentPlayingResponse
): FilteredSpotifyCurrentPlayingResponse | NoSessionResponse {
  const {
    is_playing,
    item,
    progress_ms,
    currently_playing_type,
    device,
    repeat_state,
    shuffle_state
  } = data

  if (!item) {
    return {
      session: false
    }
  }

  if (currently_playing_type === 'episode') {
    const item = data.item as SpotifyEpisodeItem

    return {
      session: true,
      type: 'episode',
      playing: is_playing,
      name: item.name,
      trackURL: item.external_urls.spotify,
      repeat_state,
      shuffle_state,
      artists: item.show.publisher
        ? [
            {
              name: item.show.publisher,
              url: item.show.external_urls.spotify
            }
          ]
        : [],
      album: {
        name: item.show.name,
        url: item.show.href
      },
      covers: item.images,
      duration: {
        current: progress_ms,
        total: item.duration_ms
      },
      device: {
        volume_percent: device.volume_percent,
        supports_volume: device.supports_volume
      }
    }
  } else if (currently_playing_type === 'track') {
    const item = data.item as SpotifyTrackItem

    return {
      session: true,
      type: 'track',
      playing: is_playing,
      name: item.name,
      trackURL: item.external_urls.spotify,
      repeat_state,
      shuffle_state,
      artists: item.artists.map(a => ({
        name: a.name,
        url: a.external_urls.spotify
      })),
      album: {
        name: item.album.name,
        url: item.album.href
      },
      covers: item.album.images,
      duration: {
        current: progress_ms,
        total: item.duration_ms
      },
      device: {
        volume_percent: device.volume_percent,
        supports_volume: device.supports_volume
      }
    }
  } else {
    return {
      session: false
    }
  }
}

export async function fetchImage(id: string) {
  const res = await axios.get(`https://i.scdn.co/image/${id}`, {
    responseType: 'arraybuffer'
  })

  return `data:image/jpeg;base64,${Buffer.from(res.data).toString('base64')}`
}

class SpotifyAPI extends EventEmitter {
  sp_dc: string
  token: string | null
  ws: WebSocket | null
  instance: AxiosInstance = axios.create({
    baseURL: 'https://api.spotify.com/v1',
    validateStatus: () => true
  })

  constructor(sp_dc: string) {
    super()

    this.sp_dc = sp_dc
    this.token = null
    this.ws = null

    this.instance.interceptors.request.use(config => {
      config.headers.Authorization = `Bearer ${this.token}`
      return config
    })

    this.instance.interceptors.response.use(async res => {
      if (res.status === 401) {
        log('Refreshing token...', 'Spotify')
        this.token = await getToken(this.sp_dc)
        return this.instance(res.config)
      }

      return res
    })
  }

  async start() {
    this.token = await getToken(this.sp_dc).catch(err => {
      this.emit('error', err)
      return null
    })

    this.ws = new WebSocket(
      `wss://dealer.spotify.com/?access_token=${this.token}`
    )

    this.setup()
  }

  setup() {
    if (!this.ws) return
    const ping = () => this.ws!.send('{"type":"ping"}')

    this.ws.on('open', () => {
      this.emit('open')
      ping()
      const interval = setInterval(() => {
        if (!this.ws) return clearInterval(interval)
        ping()
      }, 15000)
    })

    this.ws.on('message', async d => {
      const msg = JSON.parse(d.toString())
      if (msg.headers?.['Spotify-Connection-Id']) {
        await subscribe(msg.headers['Spotify-Connection-Id'], this.token!)
          .then(() => this.emit('ready'))
          .catch(err => this.emit('error', err))

        return
      }
      const event = msg.payloads?.[0]?.events?.[0]
      if (!event) return
      this.emit(event.type, event.event)
    })

    this.ws.on('close', () => this.emit('close'))

    this.ws.on('error', err => this.emit('error', err))
  }

  async close() {
    if (!this.ws) return
    this.ws.removeAllListeners()
    this.ws.close()
    this.ws = null
    this.removeAllListeners()
  }

  async getCurrent(): Promise<
    FilteredSpotifyCurrentPlayingResponse | NoSessionResponse
  > {
    const res = await this.instance.get('/me/player', {
      params: {
        additional_types: 'episode'
      }
    })

    if (!res.data)
      return {
        session: false
      }

    return filterData(res.data)
  }

  async setPlaying(playing: boolean) {
    let res: AxiosResponse
    if (playing) {
      res = await this.instance.put('/me/player/play')
    } else {
      res = await this.instance.put('/me/player/pause')
    }

    return res.status === 200
  }

  async setVolume(volume: number) {
    const res = await this.instance.put(
      '/me/player/volume',
      {},
      {
        params: {
          volume_percent: volume
        }
      }
    )

    return res.status === 200
  }

  async next() {
    const res = await this.instance.post('/me/player/next')

    return res.status === 200
  }

  async previous() {
    const res = await this.instance.post('/me/player/previous')

    return res.status === 200
  }

  async shuffle(state: boolean) {
    const res = await this.instance.put('/me/player/shuffle', null, {
      params: {
        state
      }
    })

    return res.status === 200
  }

  async repeat(state: 'track' | 'context' | 'off') {
    const res = await this.instance.put('/me/player/repeat', null, {
      params: {
        state
      }
    })

    return res.status === 200
  }

  async getPlaylists() {
    const res = await this.instance.get('/me/playlists')
    
    if (res.status !== 200) {
      log('Failed to fetch playlists', 'Spotify', LogLevel.ERROR)
      return { error: { message: 'Failed to fetch playlists' } }
    } else {
      log('Successfully fetched playlists')
    }
    
    return res.data
  }
}

export let spotify: SpotifyAPI | null = null

export function setupSpotify(sp_dc: string) {
  spotify = new SpotifyAPI(sp_dc)
  return spotify
}
