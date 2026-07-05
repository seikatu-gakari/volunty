import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DiagnosisWizard } from './DiagnosisWizard'
import { getItemsInDisplayOrder } from '@/lib/diagnosis-scale/scale'

// next/navigation のモック
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// Server Action のモック
vi.mock('@/lib/diagnosis/actions', () => ({
  submitDiagnosis: vi.fn().mockResolvedValue({ success: true }),
}))

describe('DiagnosisWizard', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('開始画面に50問・非臨床・同意の説明が表示される', () => {
    render(<DiagnosisWizard />)
    expect(screen.getByText('性格傾向チェック（BIG5）')).toBeDefined()
    expect(
      screen.getByRole('button', { name: /診断を開始する（全50問）/ })
    ).toBeDefined()
    // 非臨床であることの説明
    expect(
      screen.getByText(/医療・心理臨床の診断ではありません/)
    ).toBeDefined()
    // 性格に良し悪しがないことの説明
    expect(screen.getByText(/性格に良し悪しはありません/)).toBeDefined()
    // 生回答保存の同意チェックボックス（デフォルトはオフ）
    const consent = screen.getByRole('checkbox') as HTMLInputElement
    expect(consent.checked).toBe(false)
  })

  it('旧仕様の「簡易診断/詳細診断」モード選択を表示しない', () => {
    render(<DiagnosisWizard />)
    expect(screen.queryByText('簡易診断')).toBeNull()
    expect(screen.queryByText('詳細診断')).toBeNull()
  })

  it('開始すると1問目（一次資料の項目文言）が表示される', () => {
    render(<DiagnosisWizard />)
    fireEvent.click(screen.getByRole('button', { name: /診断を開始する（全50問）/ }))

    const firstItem = getItemsInDisplayOrder()[0]
    expect(screen.getByText(firstItem.textJa)).toBeDefined()
    expect(screen.getByText('質問 1 / 50')).toBeDefined()
  })

  it('回答すると次の質問に進み、戻るで前の質問に戻れる', () => {
    render(<DiagnosisWizard />)
    fireEvent.click(screen.getByRole('button', { name: /診断を開始する（全50問）/ }))

    fireEvent.click(screen.getByRole('button', { name: /非常に当てはまる/ }))
    expect(screen.getByText('質問 2 / 50')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /戻る/ }))
    expect(screen.getByText('質問 1 / 50')).toBeDefined()
  })

  it('回答が進むと localStorage に進捗が保存される（中断・再開用）', () => {
    render(<DiagnosisWizard />)
    fireEvent.click(screen.getByRole('button', { name: /診断を開始する（全50問）/ }))
    fireEvent.click(screen.getByRole('button', { name: /やや当てはまる/ }))

    const keys = Object.keys(window.localStorage)
    const progressKey = keys.find((key) => key.includes('volunty-diagnosis-progress'))
    expect(progressKey).toBeDefined()
    const saved = JSON.parse(window.localStorage.getItem(progressKey!)!)
    expect(saved.answers).toHaveLength(1)
  })
})
