import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DiagnosisWizard } from './DiagnosisWizard'

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
    expect(screen.getByText('診断を開始する')).toBeDefined()
  })
})
