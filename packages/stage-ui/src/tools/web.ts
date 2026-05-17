import { tool } from '@xsai/tool'
import { z } from 'zod'

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_: string, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/\s+/g, ' ')
    .trim()
}

const tools = [
  tool({
    name: 'web_fetch',
    description: 'Fetch and read the content of a web page. Use this to read documentation, articles, or any public URL.',
    execute: async ({ url }) => {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AIRI/1.0)',
          'Accept': 'text/html,application/json,*/*',
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok)
        return `Error: HTTP ${response.status} ${response.statusText}`

      const contentType = response.headers.get('content-type') ?? ''
      const text = await response.text()

      if (contentType.includes('application/json'))
        return text
      if (contentType.includes('text/html'))
        return stripHtml(text)

      return text.slice(0, 10000)
    },
    parameters: z.object({
      url: z.string().url().describe('The URL to fetch content from'),
    }),
  }),
  tool({
    name: 'web_search',
    description: 'Search the web for information. Use this to find current information, news, or any topic. Results include titles, snippets, and URLs.',
    execute: async ({ query }) => {
      const encoded = encodeURIComponent(query)
      const response = await fetch(`https://lite.duckduckgo.com/lite/?q=${encoded}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AIRI/1.0)',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok)
        return `Search failed: HTTP ${response.status}`

      const html = await response.text()
      const results: string[] = []
      let currentResult: string[] = []

      // Parse DuckDuckGo lite HTML results
      const lines = html.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('<a ') && trimmed.includes('class="result-link"')) {
          const hrefMatch = trimmed.match(/href="([^"]+)"/)
          const textMatch = trimmed.replace(/<[^>]+>/g, '').trim()
          if (hrefMatch && textMatch) {
            currentResult = [textMatch, hrefMatch[1]]
          }
        }
        else if (trimmed.startsWith('<td>') && currentResult.length === 2) {
          const snippet = trimmed.replace(/<[^>]+>/g, '').trim()
          if (snippet) {
            results.push(`- ${currentResult[0]}\n  ${currentResult[1]}\n  ${snippet}`)
          }
          currentResult = []
        }
      }

      if (results.length === 0)
        return 'No results found.'

      return results.slice(0, 10).join('\n\n')
    },
    parameters: z.object({
      query: z.string().min(1).describe('The search query'),
    }),
  }),
]

export const web = async () => Promise.all(tools)
