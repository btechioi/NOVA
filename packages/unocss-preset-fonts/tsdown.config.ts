import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './src/index.ts',
  ],
  noExternal: [
    '@proj-nova/font-cjkfonts-allseto',
    '@proj-nova/font-departure-mono',
    '@proj-nova/font-xiaolai',
  ],
  dts: true,
  sourcemap: true,
})
