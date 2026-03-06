export interface Content {
  id: number
  title: string
  description: string | null
  tags: string[]
  file_path: string | null
  file_type: string | null
  thumbnail_path: string | null
  status: 'draft' | 'scheduled' | 'uploading' | 'completed' | 'failed'
  scheduled_at: string | null
  created_at: string
  updated_at: string
}

export interface Template {
  id: number
  name: string
  platform: Platform
  title_template: string | null
  description_template: string | null
  tags_template: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface PlatformConnection {
  id: number
  platform: Platform
  is_connected: boolean
  account_name: string | null
  account_id: string | null
  token_expires_at: string | null
  updated_at: string
}

export interface UploadHistory {
  id: number
  content_id: number
  platform: Platform
  status: 'pending' | 'uploading' | 'success' | 'failed'
  platform_post_id: string | null
  platform_url: string | null
  error_message: string | null
  uploaded_at: string | null
  created_at: string
}

export type Platform = 'youtube' | 'naver_blog' | 'facebook' | 'instagram'

// Analytics
export interface PlatformClickSummary {
  platform: string
  total_clicks: number
  percentage: number
}

export interface ContentClickRanking {
  content_id: number
  content_title: string
  total_clicks: number
  platforms: string[]
}

export interface ClickTrendPoint {
  date: string
  click_count: number
}

export interface AnalyticsSummary {
  total_clicks: number
  total_links: number
  today_clicks: number
  avg_clicks_per_link: number
  platform_breakdown: PlatformClickSummary[]
  top_content: ContentClickRanking[]
  daily_trend: ClickTrendPoint[]
}
