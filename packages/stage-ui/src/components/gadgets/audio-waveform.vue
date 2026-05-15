<script setup lang="ts">
import { useElementBounding, usePreferredDark } from '@vueuse/core'
import { nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  data: number[]
}>()

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const isDark = usePreferredDark()

function draw() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container || props.data.length === 0)
    return

  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  const width = canvas.width
  const height = canvas.height
  const mid = height / 2

  ctx.clearRect(0, 0, width, height)

  if (isDark.value) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
  }
  else {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'
  }

  ctx.lineWidth = 2
  ctx.beginPath()

  const sliceWidth = width / props.data.length

  for (let i = 0; i < props.data.length; i++) {
    const v = props.data[i] / 128.0
    const y = mid - (v - 1) * mid

    if (i === 0)
      ctx.moveTo(i * sliceWidth, y)
    else
      ctx.lineTo(i * sliceWidth, y)
  }

  ctx.stroke()
}

watch(() => props.data, draw, { flush: 'post' })

onMounted(async () => {
  await nextTick()
  const container = containerRef.value
  const canvas = canvasRef.value
  if (!container || !canvas)
    return

  const bounding = useElementBounding(container)
  canvas.width = bounding.width.value
  canvas.height = bounding.height.value
  draw()
})
</script>

<template>
  <div ref="containerRef" h-full w-full>
    <canvas ref="canvasRef" h-full w-full />
  </div>
</template>
