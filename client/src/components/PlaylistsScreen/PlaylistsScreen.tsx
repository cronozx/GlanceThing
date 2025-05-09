import { useContext, useEffect, useState, useRef } from 'react'
import { SocketContext } from '@/contexts/SocketContext.tsx'
import styles from './PlaylistsScreen.module.css'
import { MediaContext } from '@/contexts/MediaContext'
import Slider from 'react-slick'
import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'

interface SpotifyPlaylist {
  id: string
  name: string
  description: string
  images: Array<{
    url: string
    height: number | null
    width: number | null
  }>
  tracks: {
    total: number
  }
}

interface PlaylistsScreenProps {
    shown:boolean
    setShown: React.Dispatch<React.SetStateAction<boolean>>
} 

const PlaylistsScreen: React.FC<PlaylistsScreenProps> = ({shown, setShown}) => {
  const { ready, socket } = useContext(SocketContext)
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const { actions } = useContext(MediaContext)

  useEffect(() => {
    if (shown) playerRef.current?.focus()
    else playerRef.current?.blur()
  }, [shown])

  useEffect(() => {
      if (ready === true && socket && shown) {
        setLoading(true);
        socket.send(
          JSON.stringify({
            type: 'spotify',
            action: 'playlists'
          })
        );
        
        const listener = (e: MessageEvent) => {
          try {
            const { type, action, data } = JSON.parse(e.data);
            
            if (type !== 'spotify' || action !== 'playlists') return;
    
            if (data.error) {
              setError(data.error.message || 'Failed to fetch playlists');
              setLoading(false);
              return;
            }
            
            setPlaylists(data.items || []);
            setLoading(false);
          } catch (err) {
            setLoading(false);
          }
        };
        
        socket.addEventListener('message', listener);
        
        return () => {
          socket.removeEventListener('message', listener);
        };
      }
    }, [ready, socket, shown]);

    return (
        <div
          className={styles.playlistsContainer}
          data-shown={shown}
          ref={playerRef}
        >
          {loading ? (
            <div className={styles.loading}>
              <h1 style={{ color: '#fff', fontSize: '32px' }}>
                Loading playlists…
              </h1>
            </div>
          ) : error ? (
            <div className={styles.error}>
              <button
                onClick={() => {
                    setShown(false)
                }}
                className={styles.close}
              >
                <span className="material-icons">
                  keyboard_arrow_down
                </span>
              </button>
              <h1 style={{ color: '#ff6b6b', fontSize: '32px' }}>
                Error: {error}
              </h1>
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                    setShown(false)
                }}
                className={styles.close}
              >
                <span className="material-icons">
                  keyboard_arrow_down
                </span>
              </button>
              <h2>Your Playlists</h2>
              <div className={styles.playlists}>
              {playlists.length === 0 ? (
                        <p>No playlists found</p>
                    ) : (
                      <div style={{'padding': '20px'}}>
                        <Slider
                          arrows={false}
                          slidesToShow={3}
                          slidesToScroll={1}
                          infinite={true}
                          centerMode={true}
                          centerPadding='0px'
                        >
                        {playlists.map((playlist) => (
                            <div key={playlist.id} className={styles.playlistItem} onClick={() => {actions.playPlaylist(playlist.id)}}>
                                <div className={styles.playlistImage}>
                                    {playlist.images[0] && (
                                        <img src={playlist.images[0].url} alt={playlist.name} />
                                    )}
                                </div>
                                <div className={styles.playlistInfo}>
                                    <h3>{playlist.name}</h3>
                                    <p>{playlist.description || `${playlist.tracks.total} tracks`}</p>
                                </div>
                            </div>
                        ))}
                        </Slider>
                      </div>
                    )}
              </div>
            </>
          )}
        </div>
      )
    }

export default PlaylistsScreen