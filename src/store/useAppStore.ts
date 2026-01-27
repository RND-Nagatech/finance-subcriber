import { create } from 'zustand';
import { secureStorage } from '@/utils/secureStorage';

interface User {
  name: string;
  email: string;
  role: string;
}

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  fiscalYear: number;
  setFiscalYear: (year: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: secureStorage.getItem('user_name') 
    ? { name: secureStorage.getItem('user_name') || '', email: '', role: secureStorage.getItem('user_role') || 'user' }
    : null,
  isAuthenticated: !!secureStorage.getItem('auth_token'),
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: () => {
    secureStorage.removeItem('auth_token');
    secureStorage.removeItem('user_name');
    secureStorage.removeItem('user_role');
    set({ user: null, isAuthenticated: false });
  },
  fiscalYear: Number(secureStorage.getItem('fiscal_year')) || new Date().getFullYear(),
  setFiscalYear: (year: number) => {
    secureStorage.setItem('fiscal_year', String(year));
    set({ fiscalYear: year });
  },
}));
