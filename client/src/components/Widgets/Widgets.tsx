import { useEffect, useRef } from 'react'

import Controls from './widgets/Controls/Controls.tsx'
import Spotify from './widgets/Spotify/Spotify.tsx'
import Apps from './widgets/Apps/Apps.tsx'

import styles from './Widgets.module.css'

interface WidgetsInterface {
  setPlaylistsShown: React.Dispatch<React.SetStateAction<boolean>>
}

const Widgets: React.FC<WidgetsInterface> = ({setPlaylistsShown}) => {
  const widgetsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (!widgetsRef.current) return
      const widgets = widgetsRef.current.querySelectorAll('#widget')
      if (e.key === '1') {
        const widget = widgets[0] as HTMLDivElement
        widget.focus()
      } else if (e.key === '2') {
        const widget = widgets[1] as HTMLDivElement
        widget.focus()
      } else if (e.key === '3') {
        const widget = widgets[2] as HTMLDivElement
        widget.focus()
      }
    }

    document.addEventListener('keydown', listener)

    return () => {
      document.removeEventListener('keydown', listener)
    }
  })

  return (
    <div className={styles.widgets} ref={widgetsRef}>
      <Spotify />
      <div className={styles.column}>
        <Apps />
        <Controls setPlaylistsShown={setPlaylistsShown}/>
      </div>
    </div>
  )
}

export default Widgets
