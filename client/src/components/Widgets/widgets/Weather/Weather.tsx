import { SocketContext } from "@/contexts/SocketContext"
import { useContext, useEffect, useState } from "react"
import BaseWidget from "../BaseWidget/BaseWidget"

import styles from './Weather.module.css'

interface WeatherData {
    temp: number,
    weatherCode: number
}

const Weather: React.FC = () => {
    const { ready, socket } = useContext(SocketContext)
    const [weather, setWeatherData] = useState<WeatherData | null>(null)
    const [weatherIcon, setWeatherIcon] = useState<String | null>(null)
    const [weatherDescription, setWeatherDescription] = useState<String | null>(null)
    const [time, setTime] = useState<string | null>(null)

    useEffect(() => {
        if (ready === true && socket) {
        const listener = (e: MessageEvent) => {
            const { type, data } = JSON.parse(e.data)
            if (type !== 'time') return
            setTime(data.time)
        }

        socket.addEventListener('message', listener)

        socket.send(JSON.stringify({ type: 'time' }))

        return () => {
            socket.removeEventListener('message', listener)
        }
        }
    }, [ready, socket])

    useEffect(() => {
        if (time?.endsWith('0') && socket) {
            socket.send(
                JSON.stringify({
                    type: 'weather'
                })
            )
        }
    }, [time, socket])

    useEffect(() => {
        if (ready === true && socket) {
            socket.send(
                JSON.stringify({
                    type: 'weather'
                })
            )

            const listener = (e: MessageEvent) => {
                try {
                    const { type, data } = JSON.parse(e.data)

                    if (type !== 'weather') return

                    setWeatherData(data)

                    if (data?.weatherCode !== undefined) {
                        switch(data.weatherCode) {
                            case 0:
                                setWeatherIcon('sunny');
                                setWeatherDescription('Clear');
                                break;
                            case 1:
                                setWeatherIcon('sunny');
                                setWeatherDescription('Mostly Clear');
                                break;
                            
                            case 2:
                                setWeatherIcon('cloudy_snowing');
                                setWeatherDescription('Partly Cloudy');
                                break;
                            case 3:
                                setWeatherIcon('cloud');
                                setWeatherDescription('Overcast');
                                break;
                            
                            case 45:
                            case 48:
                                setWeatherIcon('foggy');
                                setWeatherDescription('Fog');
                                break;
                            
                            case 51:
                            case 53:
                            case 55:
                                setWeatherIcon('water_drop');
                                setWeatherDescription('Drizzle');
                                break;
                            
                            case 61:
                            case 63:
                            case 65:
                            case 80:
                            case 81:
                            case 82:
                                setWeatherIcon('water_drop');
                                setWeatherDescription('Rain');
                                break;
                            
                            case 56:
                            case 57:
                            case 66:
                            case 67:
                                setWeatherIcon('ac_unit');
                                setWeatherDescription('Freezing Rain');
                                break;
                            
                            case 71:
                            case 73:
                            case 75:
                            case 77:
                            case 85:
                            case 86:
                                setWeatherIcon('cloudy_snowing');
                                setWeatherDescription('Snow');
                                break;
                            case 95:
                            case 96:
                            case 99:
                                setWeatherIcon('thunderstorm');
                                setWeatherDescription('Thunderstorm');
                                break;
                            
                            default:
                                setWeatherIcon('cloud');
                                setWeatherDescription('Unknown');
                                break;
                        }
                    }
                    
                } catch (error) {
                    console.log('Error loading weather data:', error)
                }
            };

            socket.addEventListener("message", listener);

            return () => {
                socket.removeEventListener("message", listener);
            };
        }
    }, [ready, socket]);

    return (
        <BaseWidget id="widget">
            {weather ? (
                <div className={styles.weather}>
                    <div className={styles.icon}>
                        <span className="material-icons">{weatherIcon}</span>
                    </div>
                    <div className={styles.info}>
                        <div className={styles.temp}>{weather.temp.toFixed(0)}°F</div>
                        <div className={styles.description}>{weatherDescription}</div>
                    </div>
                </div>
            ) : (
                <div className={styles.loading}>
                    Loading weather...
                </div>
            )}
        </BaseWidget>
    )
}

export default Weather