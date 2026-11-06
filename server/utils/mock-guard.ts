import type { H3Event } from 'h3'

/** A mock SAP csak NUXT_MOCK_SAP=true esetén létezik; élesben 404. */
export function requireMockSap(event: H3Event) {
  if (!useRuntimeConfig(event).mockSap) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
}
