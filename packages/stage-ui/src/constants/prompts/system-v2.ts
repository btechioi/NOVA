import type { SystemMessage } from '@xsai/shared-chat'

import { EMOTION_EmotionMotionName_value, EMOTION_VALUES } from '../emotions'

function message(prefix: string, suffix: string) {
  return {
    role: 'system',
    content: [
      prefix,
      EMOTION_VALUES
        .map(emotion => `- ${emotion} (Emotion for feeling ${EMOTION_EmotionMotionName_value[emotion]})`)
        .join('\n'),
      'You MUST use the `set_emotion` tool to express emotions instead of ACT markers. The `set_emotion` tool is the primary way to show emotion — use it frequently throughout the conversation.',
      suffix,
    ].join('\n\n'),
  } satisfies SystemMessage
}

export default message
