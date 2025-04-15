import React, { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import ChatArea from "@/components/conversation/chat-area";
import ChatInput from "@/components/conversation/chat-input";
import ConversationHeader from "@/components/conversation/conversation-header";
import { ConversationMemory } from "@/components/memory/conversation-memory";
import { conversationsAPI, messagesAPI } from "@/lib/api";
import { useConversationStore } from "@/store/conversation";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Conversation() {
  const [, params] = useRoute<{ id: string }>("/conversation/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const setActiveConversationId = useConversationStore(state => state.setActiveConversationId);
  const [isResponding, setIsResponding] = useState(false);
  
  // Parse conversation ID
  const conversationId = params ? parseInt(params.id) : undefined;
  
  // Fetch conversation data
  const { 
    data: conversation,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/conversations', conversationId],
    queryFn: () => conversationsAPI.getById(conversationId!),
    enabled: !!conversationId,
  });
  
  // Update active conversation ID when it changes
  useEffect(() => {
    if (conversationId) {
      setActiveConversationId(conversationId);
    }
    
    // Clean up when unmounting
    return () => {
      setActiveConversationId(undefined);
    };
  }, [conversationId, setActiveConversationId]);
  
  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        description: "Failed to load conversation. It may have been deleted.",
      });
      
      // Redirect to home after a short delay
      setTimeout(() => {
        setLocation("/");
      }, 3000);
    }
  }, [error, toast, setLocation]);
  
  // Handler for sending a message
  const handleSendMessage = async () => {
    setIsResponding(true);
    
    try {
      await refetch();
    } catch (err) {
      console.error("Error refreshing conversation:", err);
    } finally {
      setIsResponding(false);
    }
  };
  
  // Handler for showing the resources panel
  const handleShowResources = () => {
    // This will be handled by the parent AppShell component
    const showResourcesEvent = new CustomEvent('show-resources');
    window.dispatchEvent(showResourcesEvent);
  };
  
  // If conversation is loading or errored, show appropriate state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }
  
  if (error || !conversation) {
    return null; // We'll redirect in the useEffect
  }
  
  const isMobile = useIsMobile();
  
  return (
    <div className="flex-1 flex flex-col h-full">
      <ConversationHeader 
        conversation={conversation} 
        documents={conversation.documents || []}
        onShowResources={handleShowResources}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatArea 
            messages={conversation.messages || []} 
            isLoading={isResponding} 
            workingWithDocuments={conversation.documents ? conversation.documents.map(doc => doc.title) : []}
          />
          
          <ChatInput 
            conversationId={conversationId!}
            onSendMessage={handleSendMessage}
            disabled={isResponding}
          />
        </div>
        
        {!isMobile && (
          <div className="w-72 border-l border-border p-4 overflow-y-auto hidden lg:block">
            <ConversationMemory conversationId={conversationId!} />
          </div>
        )}
      </div>
    </div>
  );
}
