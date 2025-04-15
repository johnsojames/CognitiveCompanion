import React, { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Settings, Trash2, Plus, Music2, TableProperties, Code, ChevronDown, Zap, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Conversation, Document } from "@shared/schema";
import { conversationsAPI, documentsAPI } from "@/lib/api";
import { useUserStore } from "@/store/settings";
import { useConversationStore } from "@/store/conversation";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const userId = useUserStore(state => state.userId);
  const activeConversationId = useConversationStore(state => state.activeConversationId);
  const setActiveModel = useConversationStore(state => state.setActiveModel);
  
  // Get conversations from API
  const { data: conversations = [] } = useQuery({
    queryKey: ['/api/conversations', userId],
    queryFn: () => conversationsAPI.getAll(userId),
    enabled: !!userId,
  });
  
  // Get pinned documents from API
  const { data: documents = [] } = useQuery({
    queryKey: ['/api/documents', userId],
    queryFn: () => documentsAPI.getByUserId(userId),
    enabled: !!userId,
  });
  
  // Close sidebar on page navigation for mobile
  useEffect(() => {
    if (isOpen && window.innerWidth < 768) {
      onClose();
    }
  }, [location, isOpen, onClose]);
  
  // Handle model change
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [provider, model] = e.target.value.split(':');
    setActiveModel(provider as any, model);
  };
  
  return (
    <aside 
      className={cn(
        "bg-sidebar z-20 flex flex-col",
        "fixed md:static transition-all duration-300 ease-in-out",
        "h-[calc(100vh-3.5rem)] md:h-auto",
        isOpen 
          ? "left-0 top-14 bottom-0 w-72 border-r border-sidebar-border" 
          : "-left-full md:left-0 top-14 bottom-0 w-72 md:w-64 md:border-r md:border-sidebar-border"
      )}
    >
      {/* Conversation Controls */}
      <div className="p-4 border-b border-sidebar-border">
        <Link href="/">
          <button className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-white rounded-lg py-2 px-4 flex items-center justify-center transition duration-200">
            <Plus className="w-4 h-4 mr-2" />
            <span>New Conversation</span>
          </button>
        </Link>
      </div>
      
      {/* Model Selector */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium text-sidebar-foreground">Model</h3>
          <button className="text-xs text-sidebar-foreground/70 hover:text-sidebar-primary">
            <Music2 className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <select 
            className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg p-2 appearance-none text-sidebar-foreground"
            onChange={handleModelChange}
            defaultValue="claude:claude-3-7-sonnet-20250219"
          >
            <optgroup label="Claude">
              <option value="claude:claude-3-7-sonnet-20250219">Claude Opus</option>
              <option value="claude:claude-3-haiku-20240307">Claude Haiku</option>
            </optgroup>
            <optgroup label="GPT">
              <option value="gpt:gpt-4o">GPT-4o</option>
              <option value="gpt:gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </optgroup>
            <optgroup label="DeepSeek">
              <option value="deepseek:deepseek-coder">DeepSeek Coder</option>
            </optgroup>
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 pointer-events-none text-sidebar-foreground/70" />
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-4 border-b border-sidebar-border">
          <h3 className="font-medium mb-2 text-sidebar-foreground">Recent Conversations</h3>
          
          {conversations.length === 0 ? (
            <p className="text-xs text-sidebar-foreground/50 italic">No conversations yet</p>
          ) : (
            conversations.map((conversation: Conversation) => (
              <Link key={conversation.id} href={`/conversation/${conversation.id}`}>
                <div 
                  className={cn(
                    "hover:bg-sidebar-accent rounded-lg p-2 mb-2 cursor-pointer",
                    activeConversationId === conversation.id && "bg-sidebar-accent border-l-2 border-sidebar-primary"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-sm truncate text-sidebar-foreground">{conversation.title}</h4>
                      <p className="text-xs text-sidebar-foreground/70">
                        {formatTimestamp(conversation.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Pinned Documents */}
        <div className="p-4">
          <h3 className="font-medium mb-2 text-sidebar-foreground">Pinned Documents</h3>
          
          {documents.length === 0 ? (
            <p className="text-xs text-sidebar-foreground/50 italic">No documents yet</p>
          ) : (
            documents.slice(0, 5).map((document: Document) => (
              <div key={document.id} className="hover:bg-sidebar-accent rounded-lg p-2 mb-2 cursor-pointer flex items-center">
                {document.fileType === 'md' ? (
                  <TableProperties className="w-4 h-4 text-sidebar-foreground/70 mr-2" />
                ) : (
                  <Code className="w-4 h-4 text-sidebar-foreground/70 mr-2" />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate text-sidebar-foreground">{document.title}</h4>
                  <p className="text-xs text-sidebar-foreground/70 truncate">
                    {formatTimestamp(document.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Settings & Info */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <Zap className="w-4 h-4 text-sidebar-foreground/70 mr-2" />
            <div>
              <div className="text-xs text-sidebar-foreground/70">Memory Usage</div>
              <div className="text-sm">
                <span className="text-green-500">65%</span>
                <span className="text-sidebar-foreground/70 text-xs"> of 10GB</span>
              </div>
            </div>
          </div>
          <div className="flex space-x-3">
            <Link href="/admin">
              <button className="text-sidebar-foreground/70 hover:text-sidebar-primary">
                <Shield className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/settings">
              <button className="text-sidebar-foreground/70 hover:text-sidebar-primary">
                <Settings className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}

function formatTimestamp(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 24 * 60) return `${Math.floor(diffMins / 60)}h ago`;
  if (diffMins < 48 * 60) return 'Yesterday';
  
  return date.toLocaleDateString();
}
