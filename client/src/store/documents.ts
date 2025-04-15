import { create } from 'zustand';
import { Document } from '@shared/schema';

interface DocumentsStore {
  pinnedDocuments: Document[];
  documentsInContext: Document[];
  setPinnedDocuments: (documents: Document[]) => void;
  pinDocument: (document: Document) => void;
  unpinDocument: (documentId: number) => void;
  setDocumentsInContext: (documents: Document[]) => void;
  addDocumentToContext: (document: Document) => void;
  removeDocumentFromContext: (documentId: number) => void;
}

export const useDocumentsStore = create<DocumentsStore>((set) => ({
  pinnedDocuments: [],
  documentsInContext: [],
  
  setPinnedDocuments: (documents: Document[]) => set({ pinnedDocuments: documents }),
  
  pinDocument: (document: Document) => set((state) => {
    // Don't add if already pinned
    if (state.pinnedDocuments.some(doc => doc.id === document.id)) {
      return state;
    }
    return { pinnedDocuments: [...state.pinnedDocuments, document] };
  }),
  
  unpinDocument: (documentId: number) => set((state) => ({
    pinnedDocuments: state.pinnedDocuments.filter(doc => doc.id !== documentId)
  })),
  
  setDocumentsInContext: (documents: Document[]) => set({ documentsInContext: documents }),
  
  addDocumentToContext: (document: Document) => set((state) => {
    // Don't add if already in context
    if (state.documentsInContext.some(doc => doc.id === document.id)) {
      return state;
    }
    return { documentsInContext: [...state.documentsInContext, document] };
  }),
  
  removeDocumentFromContext: (documentId: number) => set((state) => ({
    documentsInContext: state.documentsInContext.filter(doc => doc.id !== documentId)
  })),
}));
