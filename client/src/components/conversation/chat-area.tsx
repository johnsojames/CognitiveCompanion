import React, { useRef, useEffect } from "react";
import { ChatBubble } from "@/components/ui/chat-bubble";
import { useConversationStore } from "@/store/conversation";
import { useToast } from "@/hooks/use-toast";
import { Message } from "@shared/schema";

interface ChatAreaProps {
  messages: Message[];
  isLoading?: boolean;
  workingWithDocuments?: string[];
}

export default function ChatArea({ 
  messages, 
  isLoading = false, 
  workingWithDocuments = [] 
}: ChatAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);
  
  // Handle copy message
  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
      .then(() => {
        toast({
          description: "Message copied to clipboard",
          duration: 3000,
        });
      })
      .catch(err => {
        console.error("Failed to copy:", err);
        toast({
          variant: "destructive",
          description: "Failed to copy message",
          duration: 3000,
        });
      });
  };
  
  // Handle feedback
  const handleFeedback = (messageId: number, isPositive: boolean) => {
    toast({
      description: `Feedback ${isPositive ? 'positive' : 'negative'} recorded`,
      duration: 3000,
    });
    // In a real app, you would send this feedback to the server
  };
  
  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 scrollbar-thin"
      id="conversation-container"
    >
      {messages.length === 0 && !isLoading && (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">Start a conversation</h3>
            <p className="text-muted-foreground max-w-md">
              Ask a question or provide instructions to start interacting with the AI assistant.
            </p>
          </div>
        </div>
      )}
      
      {messages.map((message) => (
        <ChatBubble
          key={message.id}
          role={message.role}
          content={message.content}
          timestamp={new Date(message.timestamp)}
          onCopy={message.role === 'assistant' ? () => handleCopy(message.content) : undefined}
          onFeedback={message.role === 'assistant' ? (isPositive) => handleFeedback(message.id, isPositive) : undefined}
        />
      ))}
      
      {isLoading && (
        <ChatBubble
          role="assistant"
          content=""
          isLoading={true}
          workingWithDocuments={workingWithDocuments}
        />
      )}
    </div>
  );
}
