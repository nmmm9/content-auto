import { supabase } from '../lib/supabase'
import type { AnalyticsSummary } from '../types'

const API_BASE = 'http://localhost:8000/api'

export const api = {
  // Contents
  getContents: async (params?: { status?: string; skip?: number; limit?: number }) => {
    let query = supabase
      .from('contents')
      .select('*')
      .order('created_at', { ascending: false })

    if (params?.status) query = query.eq('status', params.status)
    if (params?.limit) query = query.limit(params.limit)
    if (params?.skip) query = query.range(params.skip, params.skip + (params.limit || 20) - 1)

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  getContent: async (id: number) => {
    const { data, error } = await supabase
      .from('contents')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  createContent: async (contentData: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('contents')
      .insert(contentData)
      .select()
      .single()

    if (error) throw error
    return data
  },

  updateContent: async (id: number, updates: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('contents')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  deleteContent: async (id: number) => {
    const { error } = await supabase
      .from('contents')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true }
  },

  // Platforms
  getPlatforms: async () => {
    const { data, error } = await supabase
      .from('platform_connections')
      .select('id, platform, is_connected, account_name, account_id')

    if (error) throw error
    return data || []
  },

  disconnectPlatform: async (platform: string) => {
    const { data, error } = await supabase
      .from('platform_connections')
      .update({ is_connected: false })
      .eq('platform', platform)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Upload (서버사이드 로직 필요 → FastAPI 유지)
  startUpload: async (contentId: number, platforms: string[]) => {
    const response = await fetch(`${API_BASE}/upload/${contentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platforms }),
    })
    return response.json()
  },

  getUploadHistory: async (contentId: number) => {
    const { data, error } = await supabase
      .from('upload_history')
      .select('*')
      .eq('content_id', contentId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  retryUpload: async (historyId: number) => {
    const response = await fetch(`${API_BASE}/upload/retry/${historyId}`, {
      method: 'POST',
    })
    return response.json()
  },

  // Tracking & Analytics
  getAnalyticsSummary: async (days: number = 30): Promise<AnalyticsSummary> => {
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString()
    const todayStr = new Date().toISOString().slice(0, 10)

    // 클릭 이벤트 조회
    const { data: clicks } = await supabase
      .from('click_events')
      .select('*')
      .gte('clicked_at', sinceStr)

    // 전체 트래킹 링크 수
    const { count: totalLinks } = await supabase
      .from('tracking_links')
      .select('*', { count: 'exact', head: true })

    // 콘텐츠 제목 조회
    const { data: allContents } = await supabase
      .from('contents')
      .select('id, title')

    const contentMap = new Map((allContents || []).map(c => [c.id, c.title]))
    const clickList = clicks || []
    const linkCount = totalLinks || 0

    // 총 클릭
    const total_clicks = clickList.length

    // 오늘 클릭
    const today_clicks = clickList.filter(c => c.clicked_at?.slice(0, 10) === todayStr).length

    // 평균
    const avg_clicks_per_link = linkCount > 0 ? Math.round((total_clicks / linkCount) * 10) / 10 : 0

    // 플랫폼별 집계
    const platformCounts: Record<string, number> = {}
    clickList.forEach(c => {
      platformCounts[c.platform] = (platformCounts[c.platform] || 0) + 1
    })
    const platform_breakdown = Object.entries(platformCounts)
      .map(([platform, count]) => ({
        platform,
        total_clicks: count,
        percentage: total_clicks > 0 ? Math.round((count / total_clicks) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total_clicks - a.total_clicks)

    // 콘텐츠별 집계
    const contentCounts: Record<number, { clicks: number; platforms: Set<string> }> = {}
    clickList.forEach(c => {
      if (!contentCounts[c.content_id]) contentCounts[c.content_id] = { clicks: 0, platforms: new Set() }
      contentCounts[c.content_id].clicks++
      contentCounts[c.content_id].platforms.add(c.platform)
    })
    const top_content = Object.entries(contentCounts)
      .map(([id, info]) => ({
        content_id: Number(id),
        content_title: contentMap.get(Number(id)) || `콘텐츠 #${id}`,
        total_clicks: info.clicks,
        platforms: Array.from(info.platforms),
      }))
      .sort((a, b) => b.total_clicks - a.total_clicks)
      .slice(0, 5)

    // 일별 추이
    const dailyCounts: Record<string, number> = {}
    clickList.forEach(c => {
      const day = c.clicked_at?.slice(0, 10)
      if (day) dailyCounts[day] = (dailyCounts[day] || 0) + 1
    })
    const daily_trend = Object.entries(dailyCounts)
      .map(([date, click_count]) => ({ date, click_count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      total_clicks,
      total_links: linkCount,
      today_clicks,
      avg_clicks_per_link,
      platform_breakdown,
      top_content,
      daily_trend,
    }
  },

  getTrackingLinks: async (contentId?: number) => {
    // tracking_links 기본 정보
    let query = supabase.from('tracking_links').select('*')
    if (contentId) query = query.eq('content_id', contentId)
    const { data: links, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    if (!links || links.length === 0) return []

    // click_events에서 실제 클릭수 집계
    const linkIds = links.map(l => l.id)
    const { data: clicks } = await supabase
      .from('click_events')
      .select('tracking_link_id')
      .in('tracking_link_id', linkIds)

    const clickCounts: Record<number, number> = {}
    clicks?.forEach(c => {
      clickCounts[c.tracking_link_id] = (clickCounts[c.tracking_link_id] || 0) + 1
    })

    return links.map(l => ({
      ...l,
      click_count: clickCounts[l.id] || 0,
    }))
  },
}
