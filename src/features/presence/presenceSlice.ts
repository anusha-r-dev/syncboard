import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { PresenceState } from '../sync/types'

const people = [
  { name: 'Alex', color: '#7c3aed', avatar: 'A' },
  { name: 'Maya', color: '#0f766e', avatar: 'M' },
  { name: 'Jordan', color: '#b45309', avatar: 'J' },
  { name: 'Nora', color: '#be123c', avatar: 'N' },
  { name: 'Sam', color: '#1d4ed8', avatar: 'S' },
]

function createLocalPresence(): PresenceState {
  const storedId = sessionStorage.getItem('syncboard-client-id')
  const clientId = storedId ?? crypto.randomUUID()
  sessionStorage.setItem('syncboard-client-id', clientId)
  const identity = people[Math.abs(hash(clientId)) % people.length] ?? people[0]
  return {
    clientId,
    name: identity?.name ?? 'Guest',
    color: identity?.color ?? '#475569',
    avatar: identity?.avatar ?? 'G',
    x: -100,
    y: -100,
    editingCardId: null,
    lastSeen: Date.now(),
  }
}

function hash(value: string): number {
  let result = 0
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) | 0
  return result
}

type PresenceFeatureState = {
  local: PresenceState
  remote: Record<string, PresenceState>
}

const initialState: PresenceFeatureState = {
  local: createLocalPresence(),
  remote: {},
}

export const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    localPresencePatched(state, action: PayloadAction<Partial<PresenceState>>) {
      Object.assign(state.local, action.payload, { lastSeen: Date.now() })
    },
    remotePresenceReceived(state, action: PayloadAction<PresenceState>) {
      if (action.payload.clientId !== state.local.clientId) {
        state.remote[action.payload.clientId] = action.payload
      }
    },
    stalePresenceRemoved(state, action: PayloadAction<number>) {
      for (const [clientId, presence] of Object.entries(state.remote)) {
        if (presence.lastSeen < action.payload) delete state.remote[clientId]
      }
    },
  },
})

export const presenceActions = presenceSlice.actions
export const presenceReducer = presenceSlice.reducer
