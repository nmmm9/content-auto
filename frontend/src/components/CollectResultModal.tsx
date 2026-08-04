import { X } from 'lucide-react'

export interface CollectResult {
  collected?: number
  skipped?: string
  detail?: string
  last_collected_at?: string
  synced?: Record<string, number>
  token_refreshed?: Record<string, boolean>
  account_daily_points?: number
  failed?: string[]
  error?: string
}

const PLATFORM_LABELS: Record<string, string> = {
  naver_blog: '네이버 블로그',
  linkedin: 'LinkedIn',
  threads: 'Threads',
  instagram: 'Instagram',
  instagram_reels: 'IG Reels',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube_shorts: 'YT Shorts',
  youtube: 'YouTube',
  living_sequence_lab: 'LS Lab',
}

/** 수집 실행 결과 상세 — "지금 수집" 후 무엇이 갱신/등록/실패했는지 보여준다 */
export default function CollectResultModal({
  result,
  onClose,
}: {
  result: CollectResult
  onClose: () => void
}) {
  const {
    collected = 0,
    skipped,
    detail,
    last_collected_at,
    synced = {},
    token_refreshed = {},
    account_daily_points = 0,
    failed = [],
    error,
  } = result
  const syncedTotal = Object.values(synced).reduce((a, b) => a + Number(b), 0)
  const ok = !error && !skipped

  // 게시물별로 반복되는 동일 에러를 플랫폼 단위로 요약
  const failByPlatform: Record<string, { count: number; sample: string }> = {}
  for (const f of failed) {
    const m = f.match(/\((\w+)\)/) ?? f.match(/^(\w+)\s/)
    const key = m ? m[1] : 'etc'
    if (!failByPlatform[key]) failByPlatform[key] = { count: 0, sample: f }
    failByPlatform[key].count += 1
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-paper-white rounded border border-paper-gray w-full max-w-[520px] max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 bg-paper-ink">
          <h3 className="text-sm font-bold text-paper-white">
            {error ? '수집 실패' : skipped ? '수집 건너뜀' : '수집 완료'}
          </h3>
          <button onClick={onClose} className="text-paper-white/60 hover:text-paper-white p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {error && <p className="text-sm text-danger break-all">{error}</p>}

          {skipped && (
            <div className="text-sm text-charcoal">
              <p>{detail ?? '최근에 이미 수집했습니다.'}</p>
              {last_collected_at && (
                <p className="text-xs text-muted-gray mt-1">
                  마지막 수집: {new Date(last_collected_at).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
          )}

          {ok && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '수치 갱신', value: collected },
                  { label: '새 게시물', value: syncedTotal },
                  { label: '일별 지표', value: account_daily_points },
                ].map((s) => (
                  <div key={s.label} className="border border-paper-beige rounded bg-paper-ivory p-3 text-center">
                    <div className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">{s.label}</div>
                    <div className="text-xl font-extrabold text-ink mt-0.5">{s.value.toLocaleString()}</div>
                  </div>
                ))}
              </div>

              {syncedTotal > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-muted-gray uppercase tracking-wider mb-1.5">
                    새로 등록된 게시물
                  </div>
                  <div className="space-y-1">
                    {Object.entries(synced)
                      .filter(([, v]) => Number(v) > 0)
                      .map(([platform, v]) => (
                        <div key={platform} className="flex justify-between text-xs text-charcoal">
                          <span>{PLATFORM_LABELS[platform] ?? platform}</span>
                          <span className="font-bold text-ink">{v}건</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {Object.keys(token_refreshed).length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-muted-gray uppercase tracking-wider mb-1.5">토큰 갱신</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(token_refreshed).map(([platform, done]) => (
                      <span
                        key={platform}
                        className={`text-[11px] px-2 py-0.5 rounded-none border ${
                          done ? 'border-success text-success' : 'border-paper-gray text-ash-gray'
                        }`}
                      >
                        {PLATFORM_LABELS[platform] ?? platform} {done ? '갱신됨' : '유지'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {failed.length > 0 ? (
                <div>
                  <div className="text-[10px] font-bold text-danger uppercase tracking-wider mb-1.5">
                    실패 {failed.length}건
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(failByPlatform).map(([platform, info]) => (
                      <div key={platform} className="border border-paper-beige rounded bg-paper-ivory p-2">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-charcoal">{PLATFORM_LABELS[platform] ?? platform}</span>
                          <span className="text-danger font-bold">{info.count}건</span>
                        </div>
                        <p className="text-[10px] text-muted-gray mt-1 break-all line-clamp-2">{info.sample}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-success font-semibold">실패 없이 모두 수집되었습니다.</p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end px-5 py-3 border-t border-paper-gray bg-paper-ivory">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-bold text-ink rounded bg-lemon hover:opacity-80">
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
