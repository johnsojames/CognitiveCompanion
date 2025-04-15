import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  isAuthenticated: boolean;
  userId: number;
  username: string;
  displayName: string;
  role: string;
  
  login: (userId: number, username: string, displayName: string, role: string) => void;
  logout: () => void;
  setUserDetails: (username: string, displayName: string) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      userId: 1, // Default to first user for demo purposes
      username: 'admin',
      displayName: 'Admin',
      role: 'user',
      
      login: (userId: number, username: string, displayName: string, role: string) => set({
        isAuthenticated: true,
        userId,
        username,
        displayName,
        role
      }),
      
      logout: () => set({
        isAuthenticated: false,
        userId: 0,
        username: '',
        displayName: '',
        role: ''
      }),
      
      setUserDetails: (username: string, displayName: string) => set((state) => ({
        ...state,
        username,
        displayName
      })),
    }),
    {
      name: 'user-storage',
    }
  )
);

interface ThemeState {
  theme: 'dark' | 'light' | 'system';
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme: 'dark' | 'light' | 'system') => set({ theme }),
    }),
    {
      name: 'theme-storage',
    }
  )
);

interface SystemState {
  isConnected: boolean;
  memoryUsage: number;
  memoryLimit: number;
  setConnectionStatus: (isConnected: boolean) => void;
  setMemoryUsage: (usage: number, limit: number) => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  isConnected: true,
  memoryUsage: 65,
  memoryLimit: 10,
  
  setConnectionStatus: (isConnected: boolean) => set({ isConnected }),
  setMemoryUsage: (usage: number, limit: number) => set({ 
    memoryUsage: usage,
    memoryLimit: limit
  }),
}));
