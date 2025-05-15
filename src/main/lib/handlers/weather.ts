import { getWeather } from '../weather.js'
import { HandlerFunction } from '../../types/WebSocketHandler.js'

export const name = 'weather'

export const hasActions = false

export const handle: HandlerFunction = async ws => {
  try {

    const weatherData = await getWeather()
    ws.send(
      JSON.stringify({
        type: 'weather',
        data: weatherData
      })
    )
  } catch (error) {
    console.error('Error in weather handler:', error)
    ws.send(
      JSON.stringify({
        type: 'weather',
        error: 'Failed to fetch weather data'
      })
    )
  }
}