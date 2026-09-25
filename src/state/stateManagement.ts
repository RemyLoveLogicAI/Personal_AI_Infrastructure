import { create } from 'zustand';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface State {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

const useStore = create(
  persist(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
      reset: () => set({ count: 0 }),
    }),
    {
      name: 'state-storage',
      getStorage: () => localStorage,
    }
  )
);

export default useStore;

const useStore = create<State>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

export default useStore;
