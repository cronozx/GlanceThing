import { useEffect, useRef } from 'react'

import Controls from './widgets/Controls/Controls.tsx'
import Spotify from './widgets/Spotify/Spotify.tsx'
import Apps from './widgets/Apps/Apps.tsx'

import styles from './Widgets.module.css'
import Slider from 'react-slick'
import Weather from './widgets/Weather/Weather.tsx'

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
        <Slider
          infinite={false}
          className='carousel'
          useCSS={true}
          arrows={false}
        >
          <Controls setPlaylistsShown={setPlaylistsShown}/>
          <Weather></Weather>
        </Slider>
      </div>
    </div>
  )
}

export default Widgets
