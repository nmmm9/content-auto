import { useState, useEffect, useMemo } from 'react'
import { X, RotateCcw, FileCode2, Megaphone, ChevronDown, ChevronRight, Play } from 'lucide-react'

interface PromptData {
  system: string
  user: string
}

export interface PromptDefaults {
  brand_voice: string
  platforms: Record<string, PromptData>
  variables: Record<string, string>
}

interface PromptReviewModalProps {
  isOpen: boolean
  onClose: () => void
  /** customPrompts: 기본값에서 수정된 플랫폼만 포함. brandVoice: 기본값과 같으면 빈 문자열 */
  onConfirm: (customPrompts: Record<string, PromptData>, brandVoice: string) => void
  platforms: { key: string; name: string }[]
  defaults: PromptDefaults
  /** 이전 실행에서 수정했던 값 유지용 */
  initialPrompts?: Record<string, PromptData>
  initialBrandVoice?: string
}

const BRAND_TAB = '__brand__'

export default function PromptReviewModal({
  isOpen,
  onClose,
  onConfirm,
  platforms,
  defaults,
  initialPrompts,
  initialBrandVoice,
}: PromptReviewModalProps) {
  const [activeTab, setActiveTab] = useState<string>(BRAND_TAB)
  const [prompts, setPrompts] = useState<Record<string, PromptData>>({})
  const [brandVoice, setBrandVoice] = useState('')
  const [showVariables, setShowVariables] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const init: Record<string, PromptData> = {}
    for (const p of platforms) {
      init[p.key] = initialPrompts?.[p.key] ?? { ...defaults.platforms[p.key] }
    }
    setPrompts(init)
    setBrandVoice(initialBrandVoice || defaults.brand_voice)
    setActiveTab(BRAND_TAB)
  }, [isOpen, defaults, platforms, initialPrompts, initialBrandVoice])

  const modifiedKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const p of platforms) {
      const cur = prompts[p.key]
      const def = defaults.platforms[p.key]
      if (cur && def && (cur.system !== def.system || cur.user !== def.user)) {
        keys.add(p.key)
      }
    }
    if (brandVoice !== defaults.brand_voice) keys.add(BRAND_TAB)
    return keys
  }, [prompts, brandVoice, defaults, platforms])

  if (!isOpen) return null

  const updatePrompt = (key: string, field: 'system' | 'user', value: string) => {
    setPrompts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  const resetCurrent = () => {
    if (activeTab === BRAND_TAB) {
      setBrandVoice(defaults.brand_voice)
    } else {
      setPrompts((prev) => ({ ...prev, [activeTab]: { ...defaults.platforms[activeTab] } }))
    }
  }

  const handleConfirm = () => {
    const custom: Record<string, PromptData> = {}
    for (const p of platforms) {
      const cur = prompts[p.key]
      const def = defaults.platforms[p.key]
      if (cur && def && (cur.system !== def.system || cur.user !== def.user)) {
        custom[p.key] = cur
      }
    }
    onConfirm(custom, brandVoice === defaults.brand_voice ? '' : brandVoice)
  }

  const current = activeTab === BRAND_TAB ? null : prompts[activeTab]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-paper-white rounded border border-paper-gray w-full max-w-[1150px] h-[88vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 bg-paper-ink">
          <div className="w-9 h-9 bg-paper-white/10 rounded flex items-center justify-center">
            <FileCode2 size={18} className="text-paper-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-paper-white">변환 프롬프트 검토</h3>
            <p className="text-xs text-paper-white/60">
              각 플랫폼에 적용될 프롬프트를 확인하고 필요하면 수정하세요. 수정 없이 그대로 실행해도 됩니다.
            </p>
          </div>
          <button onClick={onClose} className="text-paper-white/60 hover:text-paper-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 좌측: 탭 목록 */}
          <div className="w-[230px] flex-shrink-0 bg-paper-ivory border-r border-paper-gray overflow-y-auto py-2">
            <button
              onClick={() => setActiveTab(BRAND_TAB)}
              className={`w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-left transition-colors ${
                activeTab === BRAND_TAB
                  ? 'bg-paper-white text-ink border-r-2 border-paper-ink'
                  : 'text-muted-gray hover:bg-paper-beige'
              }`}
            >
              <Megaphone size={15} className="flex-shrink-0" />
              <span className="flex-1">브랜드 보이스</span>
              {modifiedKeys.has(BRAND_TAB) && <span className="w-1.5 h-1.5 rounded-full bg-lemon flex-shrink-0" />}
            </button>
            <div className="px-4 pt-3 pb-1 text-[11px] font-bold text-ash-gray uppercase tracking-wider">플랫폼별 프롬프트</div>
            {platforms.map((p) => (
              <button
                key={p.key}
                onClick={() => setActiveTab(p.key)}
                className={`w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-left transition-colors ${
                  activeTab === p.key
                    ? 'bg-paper-white text-ink border-r-2 border-paper-ink'
                    : 'text-muted-gray hover:bg-paper-beige'
                }`}
              >
                <span className="flex-1 truncate">{p.name}</span>
                {modifiedKeys.has(p.key) && <span className="w-1.5 h-1.5 rounded-full bg-lemon flex-shrink-0" />}
              </button>
            ))}
          </div>

          {/* 우측: 편집 영역 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {activeTab === BRAND_TAB ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-charcoal">브랜드 보이스</label>
                    <span className="text-xs text-ash-gray">모든 플랫폼의 시스템 프롬프트에 {'{brand_voice}'}로 주입됩니다</span>
                  </div>
                  <textarea
                    value={brandVoice}
                    onChange={(e) => setBrandVoice(e.target.value)}
                    rows={12}
                    className="w-full px-4 py-3 text-[15px] leading-relaxed border border-paper-gray rounded focus:ring-1 focus:ring-paper-ink focus:border-paper-ink resize-none bg-paper-white"
                  />
                  <p className="text-xs text-muted-gray mt-2 leading-relaxed">
                    계정의 화법(1인칭/큐레이션), 톤, 목표를 정의합니다. 분석하는 영상이 자사 콘텐츠가 아닌 경우
                    여기서 시점을 조정하세요.
                  </p>
                </div>
              ) : current ? (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-bold text-charcoal">시스템 프롬프트 (역할 · 플랫폼 원리 · 규칙)</label>
                      <span className="text-xs text-ash-gray">{current.system.length}자</span>
                    </div>
                    <textarea
                      value={current.system}
                      onChange={(e) => updatePrompt(activeTab, 'system', e.target.value)}
                      rows={13}
                      className="w-full px-4 py-3 text-[15px] leading-relaxed border border-paper-gray rounded focus:ring-1 focus:ring-paper-ink focus:border-paper-ink resize-y bg-paper-white"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-bold text-charcoal">유저 프롬프트 (분석 데이터 · 작성 지침 · 출력 형식)</label>
                      <span className="text-xs text-ash-gray">{current.user.length}자</span>
                    </div>
                    <textarea
                      value={current.user}
                      onChange={(e) => updatePrompt(activeTab, 'user', e.target.value)}
                      rows={18}
                      className="w-full px-4 py-3 text-[15px] leading-relaxed border border-paper-gray rounded focus:ring-1 focus:ring-paper-ink focus:border-paper-ink resize-y bg-paper-white"
                    />
                  </div>
                </>
              ) : null}

              {/* 사용 가능한 변수 안내 */}
              <div className="border border-paper-beige rounded bg-paper-ivory">
                <button
                  onClick={() => setShowVariables(!showVariables)}
                  className="w-full flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-charcoal"
                >
                  {showVariables ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  사용 가능한 변수 ({Object.keys(defaults.variables).length}개)
                </button>
                {showVariables && (
                  <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                    {Object.entries(defaults.variables).map(([name, desc]) => (
                      <span
                        key={name}
                        title={desc}
                        className="px-2.5 py-1 bg-paper-white border border-paper-gray rounded-none text-xs font-mono text-charcoal cursor-help"
                      >
                        {'{'}{name}{'}'} <span className="text-ash-gray font-sans">{desc}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-paper-gray bg-paper-ivory">
              <button
                onClick={resetCurrent}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-charcoal hover:bg-paper-beige rounded transition"
              >
                <RotateCcw size={15} />
                현재 탭 기본값 복원
              </button>
              <div className="flex items-center gap-3">
                {modifiedKeys.size > 0 && (
                  <span className="text-xs text-muted-gray">{modifiedKeys.size}개 항목 수정됨</span>
                )}
                <button onClick={onClose} className="px-4 py-2 text-sm text-charcoal hover:bg-paper-beige rounded transition">
                  취소
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex items-center gap-1.5 px-6 py-2 text-sm font-bold text-ink rounded bg-lemon hover:opacity-80 transition"
                >
                  <Play size={15} />
                  이 프롬프트로 변환 시작
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export type { PromptData }
