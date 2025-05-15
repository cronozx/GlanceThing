import axios from "axios"
import { getCity } from "./storage"

export const getWeather = async () => {
    const [lat, lon] = await getLocation()

    const res = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch`)

    return {
        temp: res.data.current.temperature_2m,
        weatherCode: res.data.current.weather_code
    }
}

export const getLocation = async () => {
    const res = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${getCity()}&count=1&language=en&format=json`)

    return [res.data.results[0].latitude, res.data.results[0].longitude]
}