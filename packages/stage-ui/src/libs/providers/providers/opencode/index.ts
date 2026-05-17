import type { ModelInfo } from '../../types'

import { createOpenAI } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { ProviderValidationCheck } from '../../types'
import { createOpenAICompatibleValidators } from '../../validators'
import { defineProvider } from '../registry'

const opencodeConfigSchema = z.object({
  apiKey: z
    .string('API Key')
    .optional()
    .default('public'),
  baseUrl: z
    .string('Base URL')
    .optional()
    .default('https://opencode.ai/zen/v1/'),
})

type OpenCodeConfig = z.input<typeof opencodeConfigSchema>

async function fetchOpenCodeModels(config: OpenCodeConfig): Promise<ModelInfo[]> {
  const baseURL = (config.baseUrl || 'https://opencode.ai/zen/v1/').replace(/\/+$/, '')
  const apiKey = config.apiKey || 'public'

  try {
    const res = await globalThis.fetch(`${baseURL}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    if (!res.ok)
      return []

    const data = await res.json() as { data: Array<{ id: string }> }
    return (data.data ?? []).map(model => ({
      id: model.id,
      name: model.id,
      provider: 'opencode',
      description: `OpenCode Zen model: ${model.id}`,
    } satisfies ModelInfo))
  }
  catch {
    return []
  }
}

export const providerOpenCode = defineProvider<OpenCodeConfig>({
  id: 'opencode',
  order: 3,
  name: 'OpenCode',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.opencode.title'),
  description: 'opencode.ai',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.opencode.description'),
  tasks: ['chat'],
  icon: 'i-lobe-icons:opencode',

  createProviderConfig: ({ t }) => opencodeConfigSchema.extend({
    apiKey: opencodeConfigSchema.shape.apiKey.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
      type: 'password',
    }),
    baseUrl: opencodeConfigSchema.shape.baseUrl.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
      descriptionLocalized: 'OpenCode Zen API URL (e.g. https://opencode.ai/zen/v1/)',
      placeholderLocalized: 'https://opencode.ai/zen/v1/',
    }),
  }),
  createProvider(config) {
    return createOpenAI(config.apiKey as string, config.baseUrl)
  },

  extraMethods: {
    listModels: config => fetchOpenCodeModels(config),
  },

  validationRequiredWhen(config) {
    return !!config.apiKey?.trim()
  },
  validators: {
    ...createOpenAICompatibleValidators({
      checks: [ProviderValidationCheck.Connectivity, ProviderValidationCheck.ModelList, ProviderValidationCheck.ChatCompletions],
    }),
  },
})
