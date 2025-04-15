import { create } from 'zustand';
import { modelProviders, ModelProvider } from '@shared/schema';

interface ActiveModel {
  provider: ModelProvider;
  model: string;
}

interface ConversationStore {
  activeConversationId?: number;
  activeModel: ActiveModel;
  setActiveConversationId: (id?: number) => void;
  setActiveModel: (provider: ModelProvider, model: string) => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  activeConversationId: undefined,
  activeModel: {
    provider: 'claude',
    model: 'claude-3-7-sonnet-20250219'
  },
  
  setActiveConversationId: (id?: number) => set({ activeConversationId: id }),
  
  setActiveModel: (provider: ModelProvider, model: string) => set({
    activeModel: { provider, model }
  }),
}));
