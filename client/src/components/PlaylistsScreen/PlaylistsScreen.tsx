import { useContext, useEffect, useState, useRef } from 'react'
import { SocketContext } from '@/contexts/SocketContext.tsx'
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

  useEffect(() => {
    if (shown) playerRef.current?.focus()
    else playerRef.current?.blur()
  }, [shown])

    useEffect(() => {
      console.log("PlaylistsScreen effect triggered:", { ready, shown, socketExists: !!socket });
      
      if (ready === true && socket && shown) {
        console.log("Sending playlists request to socket");
        setLoading(true);
        socket.send(
          JSON.stringify({
            type: 'spotify',
            action: 'playlists'
          })
        );
        
        const listener = (e: MessageEvent) => {
          console.log("Socket message received:", e.data);
          try {
            const { type, action, data } = JSON.parse(e.data);
            console.log("Parsed message:", { type, action, data });
            
            if (type !== 'spotify' || action !== 'playlists') return;
    
            if (data.error) {
              console.error("Playlist error:", data.error);
              setError(data.error.message || 'Failed to fetch playlists');
              setLoading(false);
              return;
            }
            
            console.log("Playlists received:", data.items);
            setPlaylists(data.items || []);
            setLoading(false);
          } catch (err) {
            console.error("Error parsing socket message:", err);
            setError("Error processing server response");
            setLoading(false);
          }
        };
        
        socket.addEventListener('message', listener);
        
        return () => {
          console.log("Removing socket listener");
          socket.removeEventListener('message', listener);
        };
      }
    }, [ready, socket, shown]);

    if (shown) {
        console.log("Rendering shown state:", { loading, error, playlistsCount: playlists.length });
        
        if (loading) {
            return (
                <div className={styles.loading}>
                    <h1 style={{ color: 'white', fontSize: '32px' }}>Loading playlists...</h1>
                </div>
            );
        }
    
        if (error) {
            return (
                <div className={styles.error}>
                    <h1 style={{ color: 'red', fontSize: '32px' }}>Error: {error}</h1>
                </div>
            );
        }

        return (
            <div 
                className={styles.playlistsContainer} 
                data-shown={shown}
                ref={playerRef}
            >
                <button
                    onClick={e => {
                    setShown(false)
                    e.currentTarget.blur()
                    }}
                    className={styles.close}
                >
                    <span className="material-icons">keyboard_arrow_down</span>
                </button>
                <h2>Your Playlists</h2>
                <div className={styles.playlists}>
                    {playlists.length === 0 ? (
                        <p>No playlists found</p>
                    ) : (
                        playlists.map((playlist) => (
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
                        ))
                    )}
                </div>
            </div>
        );
    }

    return <div className={styles.playlistsContainer} data-shown={false}></div>;
}

export default PlaylistsScreen