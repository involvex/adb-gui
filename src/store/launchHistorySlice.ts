import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface LaunchHistoryEntry {
  activity: string;
  package: string;
  timestamp: number;
}

interface LaunchHistoryState {
  entries: LaunchHistoryEntry[];
}

// Try to read from localStorage; if missing, use empty array.
const stored =
  typeof window !== "undefined"
    ? localStorage.getItem("launchedActivities")
    : null;
const initialEntries: LaunchHistoryEntry[] = stored ? JSON.parse(stored) : [];

const slice = createSlice({
  name: "launchHistory",
  initialState: { entries: initialEntries } as LaunchHistoryState,
  reducers: {
    addLaunch(
      state,
      action: PayloadAction<{ activity: string; package: string }>,
    ) {
      const entry: LaunchHistoryEntry = {
        activity: action.payload.activity,
        package: action.payload.package,
        timestamp: Date.now(),
      };
      // prepend
      state.entries.unshift(entry);
      // keep only last 10
      if (state.entries.length > 10) {
        state.entries = state.entries.slice(0, 10);
      }
      // persist to localStorage
      try {
        localStorage.setItem(
          "launchedActivities",
          JSON.stringify(state.entries),
        );
      } catch (e) {
        console.error("Failed to persist launch history:", e);
      }
    },
    // optional: clear all
    clearHistory(state) {
      state.entries = [];
      try {
        localStorage.removeItem("launchedActivities");
      } catch (e) {
        console.error("Failed to clear launch history:", e);
      }
    },
  },
});

export const { addLaunch, clearHistory } = slice.actions;
export default slice.reducer;
