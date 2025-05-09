import React, { useEffect, useRef, useState } from 'react'

import Loader from '@/components/Loader/Loader.js'

import styles from './Spotify.module.css'

interface SpotifyProps {
  onStepComplete: () => void
}

enum State {
  Pending,
  Checking,
  Valid,
  Invalid
}

const Spotify: React.FC<SpotifyProps> = ({ onStepComplete }) => {
  const [state, setState] = useState<State>(0)

  const clientIdRef = useRef<HTMLInputElement | null>(null)
  const clientSecretRef = useRef<HTMLInputElement | null>(null)

  async function check() {
    const clientID = clientIdRef.current!.value
    const clientSecret = clientSecretRef.current!.value
    
    if (!clientID || !clientSecret) {
      setState(State.Invalid)
      return
    }
    
    setState(State.Checking)
    
    const validClientID = await window.api.setSpotifyCID(clientID)
    if (!validClientID) {
      setState(State.Invalid)
      return
    }
    
    const validClientSecret = await window.api.setSpotifyCS(clientSecret)
    if (!validClientSecret) {
      setState(State.Invalid)
      return
    }
    
    setState(State.Valid)
  }

  useEffect(() => {
    // Check if we already have stored credentials
    Promise.all([
      window.api.getStorageValue('spotifyClientID'),
      window.api.getStorageValue('spotifyClientSecret')
    ]).then(([clientID, clientSecret]) => {
      if (clientID && clientSecret) {
        setState(State.Valid)
      }
    })
  }, [])

  return (
    <div className={styles.spotify}>
      <p className={styles.step}>Step 3</p>
      <h1>Spotify API Credentials</h1>
      <p>
        Now you&apos;ll enter your Spotify API credentials, so GlanceThing can show you
        your playback status live.
      </p>
      <a
        href="https://github.com/BluDood/GlanceThing/wiki/Getting-your-Spotify-credentials"
        target="_blank"
        rel="noreferrer"
      >
        Follow this guide on how to get your credentials.
      </a>
      <div className={styles.inputGroup}>
        <input
          ref={clientIdRef}
          disabled={[State.Checking, State.Valid].includes(state)}
          type="password"
          placeholder="Client ID"
        />
        <input
          ref={clientSecretRef}
          disabled={[State.Checking, State.Valid].includes(state)}
          type="password"
          placeholder="Client Secret"
        />
      </div>
      {state === State.Checking ? (
        <div className={styles.state} key={'checking'}>
          <Loader />
          <p>Checking...</p>
        </div>
      ) : state === State.Valid ? (
        <div className={styles.state} key={'valid'}>
          <span className="material-icons">check_circle</span>
          <p>Valid!</p>
        </div>
      ) : state === State.Invalid ? (
        <div className={styles.state} key={'invalid'}>
          <span className="material-icons" data-type="error">
            error
          </span>
          <p>Invalid credentials!</p>
        </div>
      ) : null}
      <div className={styles.buttons}>
        {[State.Pending, State.Invalid].includes(state) ? (
          <button onClick={check}>Check</button>
        ) : state === State.Valid ? (
          <button onClick={onStepComplete}>Continue</button>
        ) : null}
      </div>
    </div>
  )
}

export default Spotify