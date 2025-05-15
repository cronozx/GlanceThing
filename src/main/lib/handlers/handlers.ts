import { Handler } from '../../types/WebSocketHandler.js'

import * as apps from './apps.js'
import * as lock from './lock.js'
import * as ping from './ping.js'
import * as restore from './restore.js'
import * as sleep from './sleep.js'
import * as spotify from './spotify.js'
import * as time from './time.js'
import * as update from './update.js'
import * as version from './version.js'
import * as wake from './wake.js'
import * as weather from './weather.js'

export const handlers: Handler[] = [
  apps,
  lock,
  ping,
  restore,
  sleep,
  spotify,
  time,
  update,
  version,
  wake,
  weather
]
