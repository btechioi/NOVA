import type { AppType } from '../../../../apps/server/src/app'

import { hc } from 'hono/client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? ''

export const client = hc<AppType>(SERVER_URL)
