import React from "react";
import { cn } from "@/lib/utils";
import { MessageRole } from "@shared/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, Copy, ThumbsUp, ThumbsDown, Bookmark, BookmarkCheck } from "lucide-react";
import { format } from "date-fns";

export interface ChatBubbleProps {
  role: MessageRole;
  content: string;
  timestamp?: Date;
  sender?: string;
  className?: string;
  isLoading?: boolean;
  workingWithDocuments?: string[];
  onCopy?: () => void;
  onBookmark?: () => void;
  onFeedback?: (isPositive: boolean) => void;
  isBookmarked?: boolean;
}

export function ChatBubble({
  role,
  content,
  timestamp,
  sender,
  className,
  isLoading = false,
  workingWithDocuments = [],
  onCopy,
  onBookmark,
  onFeedback,
  isBookmarked = false,
  ...props
}: ChatBubbleProps) {
  const formattedTime = timestamp ? formatTimestamp(timestamp) : '';
  
  return (
    <div 
      className={cn(
        "chat-bubble relative rounded-2xl mb-4 p-3 max-w-[85%]",
        role === "user" && "chat-bubble-user ml-auto bg-primary/20 border border-primary/30 rounded-tr-none",
        role === "assistant" && "chat-bubble-assistant mr-auto bg-secondary/10 border border-secondary/20 rounded-tl-none",
        role === "system" && "chat-bubble-system mx-auto max-w-[95%] bg-accent/50 border border-accent rounded py-2 px-4",
        className
      )}
      {...props}
    >
      <div className="flex items-start">
        {role === "assistant" && (
          <Avatar className="h-8 w-8 mr-2">
            <AvatarFallback className="bg-secondary/20 text-secondary-foreground">AI</AvatarFallback>
          </Avatar>
        )}
        
        <div className="flex-1">
          {isLoading ? (
            <div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse delay-100"></div>
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse delay-200"></div>
                </div>
                <span className="text-sm text-muted-foreground">Generating response...</span>
              </div>
              
              {workingWithDocuments.length > 0 && (
                <div className="mt-2 pt-2 border-t border-muted">
                  <div className="text-xs text-muted-foreground">
                    <span>Working with:</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {workingWithDocuments.map((doc, index) => (
                        <span key={index} className="px-2 py-0.5 rounded bg-muted text-muted-foreground">{doc}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={cn(
              "prose prose-sm max-w-none",
              role === "system" && "text-center text-sm text-muted-foreground",
              role === "assistant" && "prose-invert"
            )}>
              {content}
            </div>
          )}
        </div>
      </div>
      
      {!isLoading && (
        <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
          <div className="flex items-center">
            {timestamp && (
              <>
                <Clock className="h-3 w-3 mr-1" />
                <span>{formattedTime}</span>
              </>
            )}
          </div>
          
          {role === "assistant" && (
            <div className="flex space-x-2">
              {onCopy && (
                <button 
                  onClick={onCopy}
                  className="hover:text-primary p-1 flex items-center"
                  aria-label="Copy message"
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
              
              {onBookmark && (
                <button 
                  onClick={onBookmark}
                  className="hover:text-primary p-1 flex items-center"
                  aria-label={isBookmarked ? "Remove bookmark" : "Bookmark message"}
                >
                  {isBookmarked ? (
                    <BookmarkCheck className="h-3 w-3 text-primary" />
                  ) : (
                    <Bookmark className="h-3 w-3" />
                  )}
                </button>
              )}
              
              {onFeedback && (
                <div className="flex space-x-1">
                  <button 
                    onClick={() => onFeedback(false)} 
                    className="hover:text-destructive p-1"
                    aria-label="Negative feedback"
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                  <button 
                    onClick={() => onFeedback(true)} 
                    className="hover:text-success p-1"
                    aria-label="Positive feedback"
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTimestamp(timestamp: Date): string {
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
  
  if (diffMinutes < 1) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffMinutes < 24 * 60) {
    return `${Math.floor(diffMinutes / 60)}h ago`;
  } else if (diffMinutes < 48 * 60) {
    return 'Yesterday';
  } else {
    return format(timestamp, 'MMM d');
  }
}
