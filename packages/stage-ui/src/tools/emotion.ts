import { tool } from '@xsai/tool'
import { z } from 'zod'

import { EMOTION_VALUES } from '../constants/emotions'

const tools = [
  tool({
    name: 'set_emotion',
    description: 'Set the character\'s facial expression with a specified emotion and intensity. Use this to make the character show emotions like happy, sad, angry, surprised, thinking, or curious. The expression automatically resets to neutral after the duration.',
    execute: async ({ name, intensity, duration }) => {
      return `Expression set to ${name} with intensity ${intensity} for ${duration}ms`
    },
    parameters: z.object({
      name: z.enum(EMOTION_VALUES).describe('The emotion to display'),
      intensity: z.number().min(0).max(1).default(1).describe('Intensity of the emotion (0-1)'),
      duration: z.number().default(3000).describe('Duration in milliseconds before returning to neutral'),
    }),
  }),
  tool({
    name: 'set_delay',
    description: 'Pause the response for a specified duration. Use this to create dramatic pauses or timing effects in speech.',
    execute: async ({ seconds }) => {
      return `Delayed for ${seconds} seconds`
    },
    parameters: z.object({
      seconds: z.number().min(0.1).max(30).describe('Duration to pause in seconds'),
    }),
  }),
]

export const emotion = async () => Promise.all(tools)
