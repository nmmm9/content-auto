import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabase } from '../_lib/clients.js'

const FALLBACK_URL = process.env.TRACKING_DESTINATION_URL || 'https://your-site.com'

function buildRedirectUrl(
  destinationUrl: string,
  utmSource: string,
  utmMedium: string,
  utmCampaign: string
): string {
  try {
    const url = new URL(destinationUrl)
    url.searchParams.set('utm_source', utmSource)
    url.searchParams.set('utm_medium', utmMedium)
    url.searchParams.set('utm_campaign', utmCampaign)
    return url.toString()
  } catch {
    return destinationUrl
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = String(req.query.code ?? '')
  const sb = getSupabase()

  const { data } = await sb.from('tracking_links').select('*').eq('short_code', code).limit(1)
  if (!data?.length) {
    return res.redirect(302, FALLBACK_URL)
  }
  const link = data[0]

  // 클릭 기록 — tracking_links.click_count 증분은 DB 트리거가 처리
  const forwarded = req.headers['x-forwarded-for']
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()
  await sb.from('click_events').insert({
    tracking_link_id: link.id,
    content_id: link.content_id,
    platform: link.platform,
    user_agent: String(req.headers['user-agent'] ?? '').slice(0, 500),
    referrer: String(req.headers['referer'] ?? '').slice(0, 500),
    ip_address: ip ?? null,
  })

  const redirectUrl = buildRedirectUrl(
    link.destination_url,
    link.utm_source,
    link.utm_medium,
    link.utm_campaign
  )
  return res.redirect(302, redirectUrl)
}
