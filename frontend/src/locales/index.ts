import { common } from './common'
import { home } from './home'
import { features } from './features'
import { playground } from './playground'
import { dashshared } from './dashshared'
import { dashboard } from './dashboard'
import { dashviews } from './dashviews'
import { docs } from './docs'
import { auth } from './auth'
import { testenv } from './testenv'

const NAMESPACES = [common, home, features, playground, dashshared, dashboard, dashviews, docs, auth, testenv]

export const dict = {
  ru: Object.assign({}, ...NAMESPACES.map((n) => n.ru)) as Record<string, string>,
  kk: Object.assign({}, ...NAMESPACES.map((n) => n.kk)) as Record<string, string>,
}
