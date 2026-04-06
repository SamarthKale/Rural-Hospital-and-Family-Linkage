import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user: null,
  token: null,
  role: null,
  assignedVillageIds: [],

  setAuth: ({ user, token }) =>
    set({
      user,
      token,
      role: user?.role || null,
      assignedVillageIds: user?.assignedVillageIds || [],
    }),

  clearAuth: () =>
    set({
      user: null,
      token: null,
      role: null,
      assignedVillageIds: [],
    }),
}));

export default useAuthStore;
