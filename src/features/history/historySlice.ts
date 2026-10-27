import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { OperationDraft } from '../sync/types'

export type HistoryEntry = {
  id: string
  forward: OperationDraft
  inverse: OperationDraft
}

type HistoryState = {
  past: HistoryEntry[]
  future: HistoryEntry[]
}

const initialState: HistoryState = { past: [], future: [] }

export const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    entryRecorded(state, action: PayloadAction<HistoryEntry>) {
      state.past.push(action.payload)
      if (state.past.length > 100) state.past.shift()
      state.future = []
    },
    entryDiscarded(state, action: PayloadAction<string>) {
      state.past = state.past.filter((entry) => entry.id !== action.payload)
      state.future = state.future.filter((entry) => entry.id !== action.payload)
    },
    undone(state) {
      const entry = state.past.pop()
      if (entry) state.future.push(entry)
    },
    redone(state) {
      const entry = state.future.pop()
      if (entry) state.past.push(entry)
    },
    cleared(state) {
      state.past = []
      state.future = []
    },
  },
})

export const historyActions = historySlice.actions
export const historyReducer = historySlice.reducer
