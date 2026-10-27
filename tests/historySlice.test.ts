import { describe, expect, it } from 'vitest'
import {
  historyActions,
  historyReducer,
  type HistoryEntry,
} from '../src/features/history/historySlice'

const entry = (id: string): HistoryEntry => ({
  id,
  forward: { type: 'card/delete', payload: { cardId: id } },
  inverse: { type: 'card/delete', payload: { cardId: `${id}-inverse` } },
})

describe('historySlice', () => {
  it('records, undoes, redoes, discards, and clears entries', () => {
    let state = historyReducer(undefined, historyActions.entryRecorded(entry('one')))
    state = historyReducer(state, historyActions.entryRecorded(entry('two')))
    expect(state.past.map((item) => item.id)).toEqual(['one', 'two'])

    state = historyReducer(state, historyActions.undone())
    expect(state.past.map((item) => item.id)).toEqual(['one'])
    expect(state.future.map((item) => item.id)).toEqual(['two'])

    state = historyReducer(state, historyActions.redone())
    expect(state.past.map((item) => item.id)).toEqual(['one', 'two'])

    state = historyReducer(state, historyActions.entryDiscarded('one'))
    expect(state.past.map((item) => item.id)).toEqual(['two'])
    state = historyReducer(state, historyActions.cleared())
    expect(state).toEqual({ past: [], future: [] })
  })

  it('keeps only the latest 100 undo entries and clears redo on new work', () => {
    let state = historyReducer(undefined, { type: 'init' })
    for (let index = 0; index < 102; index += 1) {
      state = historyReducer(state, historyActions.entryRecorded(entry(String(index))))
    }
    expect(state.past).toHaveLength(100)
    expect(state.past[0]?.id).toBe('2')

    state = historyReducer(state, historyActions.undone())
    expect(state.future).toHaveLength(1)
    state = historyReducer(state, historyActions.entryRecorded(entry('new')))
    expect(state.future).toHaveLength(0)
  })

  it('leaves empty stacks unchanged when undo or redo has nothing to move', () => {
    let state = historyReducer(undefined, historyActions.undone())
    state = historyReducer(state, historyActions.redone())
    expect(state).toEqual({ past: [], future: [] })
  })
})
