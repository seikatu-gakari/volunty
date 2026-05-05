import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { diagnosisMachine } from './machine'
import { getQuestionsForMode } from './constants'

describe('Diagnosis Machine', () => {
  it('should start in idle state', () => {
    const actor = createActor(diagnosisMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe('idle')
  })

  it('should transition to answering on START', () => {
    const actor = createActor(diagnosisMachine)
    actor.start()
    actor.send({ type: 'START', mode: 'brief' })
    expect(actor.getSnapshot().value).toBe('answering')
    expect(actor.getSnapshot().context.mode).toBe('brief')
  })

  it('should transition to answering on START with full mode', () => {
    const actor = createActor(diagnosisMachine)
    actor.start()
    actor.send({ type: 'START', mode: 'full' })
    expect(actor.getSnapshot().value).toBe('answering')
    expect(actor.getSnapshot().context.mode).toBe('full')
  })

  it('should handle answering questions', () => {
    const actor = createActor(diagnosisMachine)
    actor.start()
    actor.send({ type: 'START', mode: 'brief' })
    
    // Answer first question
    actor.send({ type: 'ANSWER', value: 5 })
    
    const snapshot = actor.getSnapshot()
    expect(snapshot.context.currentQuestionIndex).toBe(1)
    expect(snapshot.context.answers).toHaveLength(1)
    expect(snapshot.context.answers[0].value).toBe(5)
    expect(snapshot.context.answers[0].questionId).toBe(getQuestionsForMode('brief')[0].id)
  })

  it('should go back to previous question', () => {
    const actor = createActor(diagnosisMachine)
    actor.start()
    actor.send({ type: 'START', mode: 'full' })
    
    // Answer first question
    actor.send({ type: 'ANSWER', value: 5 })
    expect(actor.getSnapshot().context.currentQuestionIndex).toBe(1)
    
    // Go back
    actor.send({ type: 'BACK' })
    expect(actor.getSnapshot().context.currentQuestionIndex).toBe(0)
    // Answers should remain
    expect(actor.getSnapshot().context.answers).toHaveLength(1)
  })
})
