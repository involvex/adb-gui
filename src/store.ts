import { configureStore } from "@reduxjs/toolkit";
import launchHistoryReducer from "./store/launchHistorySlice";

// If a store already exists elsewhere, merge; otherwise create a new one.
export const store = configureStore({
  reducer: {
    launchHistory: launchHistoryReducer,
    // add other reducers here as the project grows
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
