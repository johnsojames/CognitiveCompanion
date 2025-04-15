import { 
  User, InsertUser, 
  Conversation, InsertConversation,
  Message, InsertMessage,
  Document, InsertDocument,
  InsertDocumentConversationLink,
  Settings, InsertSettings
} from "@shared/schema";

// API request function
export async function apiRequest<T = any>(
  method: string,
  endpoint: string,
  data?: unknown
): Promise<T> {
  const options: RequestInit = {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : {},
    credentials: 'include',
  };

  if (data && !(data instanceof FormData)) {
    options.body = JSON.stringify(data);
  } else if (data instanceof FormData) {
    options.body = data;
    // Remove Content-Type header so browser can set it with boundary
    delete options.headers['Content-Type'];
  }

  const response = await fetch(endpoint, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  // Check if response is empty
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// Auth API
export const authAPI = {
  register: (userData: InsertUser) => 
    apiRequest<Omit<User, 'password'>>('POST', '/api/auth/register', userData),
  
  login: (username: string, password: string) => 
    apiRequest<Omit<User, 'password'>>('POST', '/api/auth/login', { username, password }),
};

// Conversations API
export const conversationsAPI = {
  getAll: (userId: number) => 
    apiRequest<Conversation[]>('GET', `/api/conversations?userId=${userId}`),
  
  getById: (id: number) => 
    apiRequest<Conversation & { messages: Message[], documents: Document[] }>('GET', `/api/conversations/${id}`),
  
  create: (data: InsertConversation) => 
    apiRequest<Conversation>('POST', '/api/conversations', data),
  
  updateTitle: (id: number, title: string) => 
    apiRequest<Conversation>('PATCH', `/api/conversations/${id}`, { title }),
  
  delete: (id: number) => 
    apiRequest<{ success: boolean }>('DELETE', `/api/conversations/${id}`),
};

// Messages API
export const messagesAPI = {
  send: (data: InsertMessage) => 
    apiRequest<{ userMessage: Message, assistantMessage: Message }>('POST', '/api/messages', data),
  
  getByConversationId: (conversationId: number) => 
    apiRequest<Message[]>('GET', `/api/messages?conversationId=${conversationId}`),
};

// Documents API
export const documentsAPI = {
  upload: (file: File, title: string, userId: number) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('userId', userId.toString());
    
    return apiRequest<Document>('POST', '/api/documents', formData);
  },
  
  getByUserId: (userId: number) => 
    apiRequest<Document[]>('GET', `/api/documents?userId=${userId}`),
  
  getByConversationId: (conversationId: number) => 
    apiRequest<Document[]>('GET', `/api/conversations/${conversationId}/documents`),
  
  linkToConversation: (documentId: number, conversationId: number) => 
    apiRequest('POST', '/api/document-links', { documentId, conversationId }),
  
  unlinkFromConversation: (documentId: number, conversationId: number) => 
    apiRequest('DELETE', `/api/document-links/${documentId}/${conversationId}`),
};

// Settings API
export const settingsAPI = {
  getByUserId: (userId: number) => 
    apiRequest<Settings>('GET', `/api/settings/${userId}`),
  
  update: (data: InsertSettings) => 
    apiRequest<Settings>('POST', '/api/settings', data),
};

// Memory API
export const memoryAPI = {
  getUserMemory: (userId: number) => 
    apiRequest<{
      summaries: any[],
      insights: any[],
      preferences: any[]
    }>('GET', `/api/memory/${userId}`),
  
  getMemoryEntry: (userId: number, type: string, key: string) => 
    apiRequest<any>('GET', `/api/memory/${userId}/${type}/${key}`),
  
  storePreference: (userId: number, key: string, value: string, importance?: number) => 
    apiRequest<{success: boolean}>('POST', '/api/memory/preference', {
      userId, key, value, importance
    }),
};
