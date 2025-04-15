import React from "react";
import { Bot, Clock, Download, FileText, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { Conversation, Document } from "@shared/schema";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

interface ConversationHeaderProps {
  conversation: Conversation;
  documents?: Document[];
  onShowResources: () => void;
}

export default function ConversationHeader({ 
  conversation, 
  documents = [],
  onShowResources 
}: ConversationHeaderProps) {
  const formatDate = (date: string | Date) => {
    if (typeof date === 'string') {
      date = new Date(date);
    }
    
    // Format like "Started 24 minutes ago" or "Started on Jun 15"
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 1000 / 60);
    
    if (diffMins < 60) {
      return `Started ${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffMins < 24 * 60) {
      const hours = Math.floor(diffMins / 60);
      return `Started ${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      return `Started on ${format(date, 'MMM d')}`;
    }
  };
  
  const exportConversation = () => {
    // In a real app, you would implement the export functionality
    console.log("Export conversation:", conversation.id);
  };
  
  return (
    <div className="border-b border-background-surface3 p-4 flex justify-between items-center">
      <div>
        <h2 className="font-semibold text-lg">{conversation.title}</h2>
        <div className="flex items-center text-xs text-muted-foreground">
          <span className="mr-3 flex items-center">
            <Bot className="h-3 w-3 mr-1" />
            <span>{conversation.modelName}</span>
          </span>
          <span className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            <span>{formatDate(conversation.createdAt)}</span>
          </span>
        </div>
      </div>
      
      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="p-2 rounded-full hover:bg-background-surface2 text-muted-foreground focus:outline-none">
            <Download className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportConversation}>Export as JSON</DropdownMenuItem>
            <DropdownMenuItem onClick={exportConversation}>Export as Markdown</DropdownMenuItem>
            <DropdownMenuItem onClick={exportConversation}>Export as Text</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <button 
          className="p-2 rounded-full hover:bg-background-surface2 text-muted-foreground"
          onClick={onShowResources}
          title="Show linked resources"
        >
          <FileText className="h-4 w-4" />
          {documents.length > 0 && (
            <span className="absolute top-0 right-0 bg-primary text-[10px] text-white rounded-full w-4 h-4 flex items-center justify-center">
              {documents.length}
            </span>
          )}
        </button>
        
        <DropdownMenu>
          <DropdownMenuTrigger className="p-2 rounded-full hover:bg-background-surface2 text-muted-foreground focus:outline-none">
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Rename Conversation</DropdownMenuItem>
            <DropdownMenuItem>Share Conversation</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Delete Conversation</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
