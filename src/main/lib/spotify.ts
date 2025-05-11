import axios, { AxiosInstance, AxiosResponse } from 'axios'
import EventEmitter from 'events'
import WebSocket from 'ws'

import { getSpotifyCID, setAccessToken, getAccessToken, getRefreshToken, setRefreshToken, setAuthCode, getAuthCode } from './storage.js'
import express from 'express';
import { BrowserWindow } from 'electron';
import { TOTP } from 'totp-generator';

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

export function openSpotifyLogin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const clientID = getSpotifyCID();
    
    const app = express();
    const server = app.listen(8888);
    
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Authentication timed out'));
    }, 120000);
    
    app.get('/callback/spotify', (req, res) => {
      const code = req.query.code as string;
      
      if (!code) {
        res.send('Authentication failed - no code provided');
        server.close();
        clearTimeout(timeout);
        reject(new Error('No authorization code received'));
        return;
      }
      
      setAuthCode(code)
      
      res.send('<html><body><h1>Authentication successful!</h1><p>You can close this window now.</p><script>window.close();</script></body></html>');
      server.close();
      clearTimeout(timeout);
      
      resolve(code);
    });
    
    const url = 'https://accounts.spotify.com/authorize?' +
    new URLSearchParams({
      client_id: clientID,
      response_type: 'code',
      redirect_uri: 'http://127.0.0.1:8888/callback/spotify',
      scope: 'user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative'
    }).toString();
    
    if (typeof window !== 'undefined') {
      window.open(url);
    } else {
      const authWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: true
      });
      authWindow.loadURL(url);
    }
  });
}

export async function getToken(clientID: string, clientSecret: string) {
  const tokenRes = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      code: getAuthCode(),
      redirect_uri: 'http://127.0.0.1:8888/callback/spotify',
      grant_type: 'authorization_code'
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (Buffer.from(clientID + ':' + clientSecret).toString('base64'))
      },
      validateStatus: () => true
    }
  )

  if (tokenRes.status !== 200) throw new Error('Invalid credentials')

  if (!tokenRes.data.access_token) throw new Error('Invalid credentials')

  setAccessToken(tokenRes.data.access_token)
  setRefreshToken(tokenRes.data.refresh_token)

  return tokenRes.data.access_token
}

export async function refreshToken(clientID: string, clientSecret: string): Promise<string> {
  const refresh = getRefreshToken();

  if (!refresh) throw new Error('No refresh token available');

  const tokenRes = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      refresh_token: refresh,
      grant_type: 'refresh_token'
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (Buffer.from(clientID + ':' + clientSecret).toString('base64'))
      },
      validateStatus: () => true
    }
  );

  if (tokenRes.status !== 200) throw new Error('Could not refresh token');
  if (!tokenRes.data.access_token) throw new Error('Invalid refresh response');

  setAccessToken(tokenRes.data.access_token);
  
  if (tokenRes.data.refresh_token) {
    setRefreshToken(tokenRes.data.refresh_token);
  }

  return tokenRes.data.access_token;
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

export async function getClientToken(sp_dc: string) {
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

export async function fetchPlaylistImage(id: string) {
  const metaRes = await axios.get<{ url: string; height: number|null; width: number|null }[]>(
    `https://api.spotify.com/v1/playlists/${id}/images`,
    { headers: { Authorization: `Bearer ${getAccessToken()}` } }
  )
  
  const url = metaRes.data[0]?.url

  const imgRes = await axios.get(url, { responseType: 'arraybuffer' })
  return `data:image/jpeg;base64,${Buffer.from(imgRes.data).toString('base64')}`
}

export async function fetchLikedSongsImage() {
  const res = await axios.get('https://misc.scdn.co/liked-songs/liked-songs-300.jpg', {
    responseType: 'arraybuffer'
  })

  return `data:image/jpeg;base64,${Buffer.from(res.data).toString('base64')}`
}

class SpotifyAPI extends EventEmitter {
  clientID: string
  clientSecret: string
  token: string | null
  sp_dc: string
  ws: WebSocket | null
  instance: AxiosInstance = axios.create({
    baseURL: 'https://api.spotify.com/v1'
  })
  clientToken: string

  constructor(clientID: string, clientSecret: string, sp_dc: string) {
    super()

    this.clientID = clientID
    this.clientSecret = clientSecret
    this.token = getAccessToken() != null ? getAccessToken() : null
    this.sp_dc = sp_dc
    this.ws = null
    this.clientToken = ''

    this.instance.interceptors.request.use(config => {
      config.headers.Authorization = `Bearer ${this.token}`
      return config
    })

    this.instance.interceptors.response.use(null, async error => {
      if (error.response.status === 401) {

        const newToken = await refreshToken(this.clientID, this.clientSecret);
        
        setAccessToken(newToken);
        
        const newRequest = error.config;
        newRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return axios(newRequest);
      }
      
      return Promise.reject(error);
    });
  }

  async start() {
      this.token = await getToken(this.clientID, this.clientSecret).catch(err => {
        this.emit('error', err)
        return null
      })

    this.clientToken = await getClientToken(this.sp_dc)

    this.ws = new WebSocket(
      `wss://dealer.spotify.com/?access_token=${this.clientToken}`
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
        await subscribe(msg.headers['Spotify-Connection-Id'], this.clientToken!)
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

  async playPlaylist(playlistID: string) {
    const res = await this.instance.put(
      '/me/player/play',
      {
        context_uri: `spotify:playlist:${playlistID}`
      }
    )
  
    return res.status === 200
  }

  async playLikedSongs() {
    const userID = await this.getUserID()

    const res = await this.instance.put(
      '/me/player/play',
      {
        context_uri: `spotify:user:${userID}:collection`
      }
    )
  
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

    console.log(res.status)

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
    
    return res.data
  }

  async getLikedSongs() {
    const res = await this.instance.get('/me/tracks')

    return res.data
  }

  async getUserID() {
    const res = await this.instance.get('/me')

    return res.data.id
  }
}

export let spotify: SpotifyAPI | null = null

export function setupSpotify(clientID: string, clientSecret: string, sp_dc:string) {
  spotify = new SpotifyAPI(clientID, clientSecret, sp_dc)
  return spotify
}