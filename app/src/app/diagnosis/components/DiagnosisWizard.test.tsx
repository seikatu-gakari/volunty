import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DiagnosisWizard } from './DiagnosisWizard'

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

// Mock the machine to avoid complex state setup in component tests
// We'll test the UI interaction primarily
vi.mock('@xstate/react', () => ({
  useMachine: () => {
    // Mock implementation of useMachine
    // This is a simplified mock for testing initial render
    return [
      {
        matches: (state: string) => state === 'idle',
        context: {
          mode: 'brief',
          currentQuestionIndex: 0,
          answers: [],
          result: null
        }
      },
      vi.fn()
    ]
  }
}))

describe('DiagnosisWizard', () => {
  it('renders start screen initially', () => {
    render(<DiagnosisWizard />)
    expect(screen.getByText('ボランティア性格診断')).toBeDefined()
    expect(screen.getByText('簡易診断')).toBeDefined()
    expect(screen.getByText('詳細診断')).toBeDefined()
    expect(screen.getByRole('button', { name: /簡易診断を開始する/ })).toBeDefined()
  })
})
