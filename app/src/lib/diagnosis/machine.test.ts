import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { diagnosisMachine } from './machine'
import { getItemsInDisplayOrder } from '@/lib/diagnosis-scale/scale'

const items = getItemsInDisplayOrder()

describe('diagnosisMachine', () => {
  it('idle から START で answering に遷移する', () => {
    const actor = createActor(diagnosisMachine).start()
    expect(actor.getSnapshot().value).toBe('idle')
    actor.send({ type: 'START' })
    expect(actor.getSnapshot().value).toBe('answering')
    expect(actor.getSnapshot().context.currentQuestionIndex).toBe(0)
  })

  it('ANSWER で回答が itemCode 付きで記録され、次の質問へ進む', () => {
    const actor = createActor(diagnosisMachine).start()
    actor.send({ type: 'START' })
    actor.send({ type: 'ANSWER', value: 4, elapsedMs: 1500 })
    const { context } = actor.getSnapshot()
    expect(context.currentQuestionIndex).toBe(1)
    expect(context.answers).toEqual([
      { itemCode: items[0].itemCode, value: 4, elapsedMs: 1500, changedCount: 0 },
    ])
  })

  it('BACK で戻って回答し直すと changedCount が増える', () => {
    const actor = createActor(diagnosisMachine).start()
    actor.send({ type: 'START' })
    actor.send({ type: 'ANSWER', value: 4, elapsedMs: 1000 })
    actor.send({ type: 'BACK' })
    expect(actor.getSnapshot().context.currentQuestionIndex).toBe(0)
    actor.send({ type: 'ANSWER', value: 2, elapsedMs: 500 })
    const { context } = actor.getSnapshot()
    expect(context.answers).toEqual([
      { itemCode: items[0].itemCode, value: 2, elapsedMs: 1500, changedCount: 1 },
    ])
    expect(context.currentQuestionIndex).toBe(1)
  })

  it('先頭の質問では BACK しても index 0 のまま', () => {
    const actor = createActor(diagnosisMachine).start()
    actor.send({ type: 'START' })
    actor.send({ type: 'BACK' })
    expect(actor.getSnapshot().context.currentQuestionIndex).toBe(0)
  })

  it('全50問回答すると completed になる', () => {
    const actor = createActor(diagnosisMachine).start()
    actor.send({ type: 'START' })
    for (let i = 0; i < items.length; i++) {
      actor.send({ type: 'ANSWER', value: 3 })
    }
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('completed')
    expect(snapshot.context.answers).toHaveLength(items.length)
  })

  it('RESTORE で中断した状態から再開できる', () => {
    const saved = [
      { itemCode: items[0].itemCode, value: 3, elapsedMs: 1000, changedCount: 0 },
      { itemCode: items[1].itemCode, value: 4, elapsedMs: 1200, changedCount: 0 },
    ]
    const actor = createActor(diagnosisMachine).start()
    actor.send({
      type: 'RESTORE',
      answers: saved,
      currentQuestionIndex: 2,
      resumedCount: 1,
    })
    const { context } = actor.getSnapshot()
    expect(actor.getSnapshot().value).toBe('answering')
    expect(context.answers).toEqual(saved)
    expect(context.currentQuestionIndex).toBe(2)
    expect(context.resumedCount).toBe(1)
  })

  it('completed から RESET で初期状態に戻る', () => {
    const actor = createActor(diagnosisMachine).start()
    actor.send({ type: 'START' })
    for (let i = 0; i < items.length; i++) {
      actor.send({ type: 'ANSWER', value: 3 })
    }
    actor.send({ type: 'RESET' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('idle')
    expect(snapshot.context.answers).toEqual([])
    expect(snapshot.context.resumedCount).toBe(0)
  })
})
