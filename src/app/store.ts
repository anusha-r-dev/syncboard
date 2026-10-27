import { configureStore } from '@reduxjs/toolkit'
import { boardReducer } from '../features/board/boardSlice'
import { historyReducer } from '../features/history/historySlice'
import { presenceReducer } from '../features/presence/presenceSlice'
import { syncListener } from '../features/sync/syncMiddleware'
import { syncReducer } from '../features/sync/syncSlice'

export const store = configureStore({
  reducer: {
    board: boardReducer,
    history: historyReducer,
    presence: presenceReducer,
    sync: syncReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: true }).prepend(syncListener.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export type AppStore = typeof store
