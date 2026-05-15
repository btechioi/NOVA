import type { CapacitorConfig } from '@capacitor/cli'

import { argv, env } from 'node:process'

const serverURL = env.CAPACITOR_DEV_SERVER_URL

const appId = argv.includes('android') ? 'nova.app_pocket' : 'nova.app-pocket'

const config: CapacitorConfig = {
  appId,
  appName: 'NOVA',
  webDir: 'dist',
  server: serverURL
    ? {
        url: serverURL,
        cleartext: false,
      }
    : undefined,
  android: {
    buildOptions: {
      keystorePath: env.CAPACITOR_ANDROID_KEYSTORE_PATH,
      keystoreAlias: env.CAPACITOR_ANDROID_KEYSTORE_ALIAS,
      keystorePassword: env.CAPACITOR_ANDROID_KEYSTORE_PASSWORD,
      keystoreAliasPassword: env.CAPACITOR_ANDROID_KEYSTORE_ALIAS_PASSWORD,
      releaseType: 'APK',
      signingType: 'apksigner',
    },
  },
}

export default config
