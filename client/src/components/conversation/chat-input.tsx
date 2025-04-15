import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Code, Send, ChevronDown, Settings } from "lucide-react";
import { useConversationStore } from "@/store/conversation";
import { messagesAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ChatInputProps {
  conversationId: number;
  onSendMessage: () => void;
  disabled?: boolean;
}

export default function ChatInput({ 
  conversationId, 
  onSendMessage,
  disabled = false 
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const activeModel = useConversationStore(state => state.activeModel);
  
  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "100px"; // Reset height
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 200) + "px";
    }
  }, [message]);
  
  // Send message
  const handleSendMessage = async () => {
    if (!message.trim() || disabled) return;
    
    try {
      await messagesAPI.send({
        conversationId,
        role: "user",
        content: message
      });
      
      setMessage("");
      onSendMessage();
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        variant: "destructive",
        description: "Failed to send message. Please try again.",
        duration: 5000,
      });
    }
  };
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Send on Ctrl+Enter or Command+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  return (
    <div className="border-t border-background-surface3 p-4">
      <div className="flex items-start">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            className="w-full bg-background-surface2 border border-background-surface3 rounded-lg p-3 pr-10 min-h-[100px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none resize-none scrollbar-thin"
            placeholder="Ask a question or provide instructions..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
          />
          <div className="absolute right-3 bottom-3 flex space-x-2 text-muted-foreground">
            <button 
              className="hover:text-primary p-1"
              disabled={disabled}
              aria-label="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button 
              className="hover:text-primary p-1"
              disabled={disabled}
              aria-label="Insert code block"
            >
              <Code className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex justify-between mt-3">
        <div className="flex items-center text-xs text-muted-foreground">
          <span className="material-icons text-sm mr-1">smart_toy</span>
          <span>{activeModel?.name || "AI Assistant"}</span>
          <button className="ml-2 p-1 hover:bg-background-surface2 rounded">
            <ChevronDown className="h-3 w-3" />
          </button>
          <div className="mx-2 h-4 border-r border-background-surface3"></div>
          <button className="hover:text-primary flex items-center">
            <Settings className="h-3 w-3 mr-1" />
            <span>Model settings</span>
          </button>
        </div>
        
        <Button 
          onClick={handleSendMessage}
          disabled={!message.trim() || disabled}
          className="bg-primary hover:bg-primary/90"
        >
          <span>Send</span>
          <Send className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
