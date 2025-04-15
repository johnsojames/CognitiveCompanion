import React, { useState, ReactNode } from "react";
import Header from "./header";
import Sidebar from "./sidebar";
import ResourcesPanel from "./resources-panel";
import { useLocation } from "wouter";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isResourcesPanelOpen, setIsResourcesPanelOpen] = useState(false);
  const [location] = useLocation();
  
  // Only show the resources panel on conversation pages
  const showResourcesPanel = location.startsWith('/conversation/');
  
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
  
  const toggleResourcesPanel = () => {
    setIsResourcesPanelOpen(!isResourcesPanelOpen);
  };
  
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header 
        onMenuClick={toggleSidebar} 
        onResourcesClick={toggleResourcesPanel}
        showResourcesButton={showResourcesPanel}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
        />
        
        <main className="flex-1 flex flex-col bg-background overflow-hidden" id="content-area">
          {children}
        </main>
        
        {showResourcesPanel && (
          <ResourcesPanel 
            isOpen={isResourcesPanelOpen} 
            onClose={() => setIsResourcesPanelOpen(false)} 
          />
        )}
      </div>
    </div>
  );
}
