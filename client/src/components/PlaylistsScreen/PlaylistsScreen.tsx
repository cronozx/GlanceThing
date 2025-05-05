import { useContext, useEffect, useState, useRef } from 'react'
import { SocketContext } from '@/contexts/SocketContext.tsx'
import Carousel from 'react-multi-carousel'
import 'react-multi-carousel/lib/styles.css'
import styles from './PlaylistsScreen.module.css'

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

  const responsive = {
    superLargeDesktop: {
      breakpoint: { max: 4000, min: 1200 },
      items: 3,
      partialVisibilityGutter: -120
    },
    desktop: {
      breakpoint: { max: 1200, min: 992 },
      items: 1,
    },
    tablet: {
      breakpoint: { max: 992, min: 576 },
      items: 1,
    },
    mobile: {
      breakpoint: { max: 576, min: 0 },
      items: 1,
    },
  };

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
                      <Carousel
                      responsive={responsive}
                      infinite={true}
                      keyBoardControl={true}
                      containerClass={styles.carouselContainer}
                      itemClass={styles.carouselItem}
                      arrows={false}
                      autoPlay={false}
                      swipeable={true}
                      draggable={true}
                      partialVisible={true}
                    >
                      {playlists.map((playlist) => (
                          <div key={playlist.id} className={styles.playlistItem}>
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
                    </Carousel>
                    )}
              </div>
            </>
          )}
        </div>
      )
    }

export default PlaylistsScreen