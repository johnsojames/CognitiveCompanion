import React from "react";
import { Link } from "wouter";
import { Menu, Bell, Settings, FileText } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useUserStore } from "@/store/settings";

interface HeaderProps {
  onMenuClick: () => void;
  onResourcesClick: () => void;
  showResourcesButton?: boolean;
}

export default function Header({ 
  onMenuClick, 
  onResourcesClick,
  showResourcesButton = false
}: HeaderProps) {
  const username = useUserStore(state => state.username);
  const displayName = useUserStore(state => state.displayName);
  const isConnected = true; // In a real app, this would be a state from a connection store
  
  const userInitials = displayName ? 
    displayName.split(' ').map(n => n[0]).join('').toUpperCase() : 
    username ? username[0].toUpperCase() : 'U';
  
  return (
    <header className="bg-background-surface1 border-b border-background-surface3 px-4 py-2 flex justify-between items-center z-10">
      <div className="flex items-center">
        <button 
          onClick={onMenuClick}
          className="md:hidden text-text-primary p-2"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/">
          <h1 className="text-xl font-semibold ml-2 flex items-center cursor-pointer">
            <span className="text-primary-light">RAG</span>
            <span className="text-secondary ml-1">LLM</span>
            <Badge className="ml-2 bg-background-surface3 text-text-secondary hover:bg-background-surface3" variant="outline">Beta</Badge>
          </h1>
        </Link>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="hidden md:flex items-center bg-background-surface2 rounded-full px-4 py-1 text-sm">
          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-success' : 'bg-destructive'}`}></span>
          <span>{isConnected ? 'System Online' : 'Disconnected'}</span>
        </div>
        
        <button className="relative p-2 rounded-full hover:bg-background-surface2">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary"></span>
        </button>
        
        {showResourcesButton && (
          <button 
            onClick={onResourcesClick}
            className="p-2 rounded-full hover:bg-background-surface2"
            aria-label="Show resources"
          >
            <FileText className="w-5 h-5" />
          </button>
        )}
        
        <Link href="/settings">
          <button 
            className="p-2 rounded-full hover:bg-background-surface2"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </Link>
        
        <Link href="/settings">
          <button className="hidden md:flex items-center space-x-2 bg-background-surface2 rounded-full px-3 py-1">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-primary-light">{userInitials}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{displayName || username || 'User'}</span>
          </button>
        </Link>
      </div>
    </header>
  );
}
