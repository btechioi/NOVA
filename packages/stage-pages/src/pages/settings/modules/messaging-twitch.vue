<script setup lang="ts">
import { MessagingTwitch } from '@proj-nova/stage-ui/components'
</script>

<template>
  <MessagingTwitch />
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.messaging-twitch.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
