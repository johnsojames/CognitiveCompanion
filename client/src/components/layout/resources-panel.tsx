import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { X, Search, FileText, Code, TableProperties, Plus, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useUserStore } from "@/store/settings";
import { useConversationStore } from "@/store/conversation";
import { documentsAPI } from "@/lib/api";
import { Document } from "@shared/schema";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ResourcesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ResourcesPanel({ isOpen, onClose }: ResourcesPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const userId = useUserStore(state => state.userId);
  const activeConversationId = useConversationStore(state => state.activeConversationId);
  
  // Fetch all user documents
  const { data: allDocuments = [] } = useQuery({
    queryKey: ['/api/documents', userId],
    queryFn: () => documentsAPI.getByUserId(userId),
    enabled: !!userId,
  });
  
  // Fetch documents linked to current conversation
  const { 
    data: linkedDocuments = [],
    refetch: refetchLinkedDocuments
  } = useQuery({
    queryKey: ['/api/conversations', activeConversationId, 'documents'],
    queryFn: () => documentsAPI.getByConversationId(activeConversationId!),
    enabled: !!activeConversationId,
  });
  
  // Link a document to the conversation
  const linkDocument = async (documentId: number) => {
    if (!activeConversationId) return;
    
    try {
      await documentsAPI.linkToConversation(documentId, activeConversationId);
      refetchLinkedDocuments();
    } catch (error) {
      console.error("Error linking document:", error);
    }
  };
  
  // Unlink a document from the conversation
  const unlinkDocument = async (documentId: number) => {
    if (!activeConversationId) return;
    
    try {
      await documentsAPI.unlinkFromConversation(documentId, activeConversationId);
      refetchLinkedDocuments();
    } catch (error) {
      console.error("Error unlinking document:", error);
    }
  };
  
  // Filter documents by search query
  const filteredDocuments = allDocuments.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Get unlinked documents
  const unlinkedDocuments = filteredDocuments.filter(doc => 
    !linkedDocuments.some(linkedDoc => linkedDoc.id === doc.id)
  );
  
  // File type icon mapping
  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'md':
      case 'txt':
      case 'pdf':
        return <FileText className="w-4 h-4 text-muted-foreground" />;
      case 'yaml':
      case 'json':
      case 'js':
      case 'ts':
        return <Code className="w-4 h-4 text-muted-foreground" />;
      case 'csv':
      case 'xlsx':
        return <TableProperties className="w-4 h-4 text-muted-foreground" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };
  
  return (
    <aside 
      className={cn(
        "bg-background-surface1 border-l border-background-surface3 overflow-hidden flex flex-col",
        "fixed md:static transition-all duration-300 ease-in-out h-full",
        "top-14 bottom-0 right-0 z-20",
        isOpen ? "w-80" : "w-0 md:w-0"
      )}
    >
      {/* Resources Header */}
      <div className="p-4 border-b border-background-surface3 flex justify-between items-center">
        <h3 className="font-medium">Resources</h3>
        <button 
          onClick={onClose}
          className="text-muted-foreground hover:text-primary"
          aria-label="Close resources panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="flex-1 flex flex-col">
        <div className="border-b border-background-surface3">
          <TabsList className="w-full rounded-none bg-transparent">
            <TabsTrigger 
              value="documents" 
              className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
            >
              Documents
            </TabsTrigger>
            <TabsTrigger 
              value="memory" 
              className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
            >
              Memory
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="documents" className="flex-1 flex flex-col m-0 p-0">
          {/* Search */}
          <div className="relative p-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                type="text" 
                placeholder="Search documents..." 
                className="w-full bg-background-surface2 border-background-surface3 pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Document List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
            <div className="space-y-3">
              <h4 className="text-xs text-muted-foreground font-medium uppercase">Linked Documents</h4>

              {linkedDocuments.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No documents linked to this conversation</p>
              ) : (
                linkedDocuments.map((doc: Document) => (
                  <div key={doc.id} className="p-3 rounded-lg bg-background-surface2 border border-primary-dark/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {getFileIcon(doc.fileType)}
                        <div className="ml-2">
                          <h5 className="font-medium text-sm">{doc.title}</h5>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(doc.fileSize)} • Added {formatTimestamp(doc.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => unlinkDocument(doc.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove document"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}

              <h4 className="text-xs text-muted-foreground font-medium uppercase mt-6">Project Documents</h4>

              {unlinkedDocuments.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No additional documents available</p>
              ) : (
                unlinkedDocuments.map((doc: Document) => (
                  <div key={doc.id} className="p-3 rounded-lg hover:bg-background-surface2 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {getFileIcon(doc.fileType)}
                        <div className="ml-2">
                          <h5 className="font-medium text-sm">{doc.title}</h5>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(doc.fileSize)} • Added {formatTimestamp(doc.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => linkDocument(doc.id)}
                        className="text-muted-foreground hover:text-primary p-1"
                        aria-label="Add document to conversation"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upload Button */}
          <div className="p-4 border-t border-background-surface3">
            <Button variant="outline" className="w-full">
              <Upload className="mr-2 h-4 w-4" />
              <span>Upload Document</span>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="memory" className="flex-1 flex flex-col m-0 p-4">
          <div className="text-sm text-center p-4">
            <p>Memory features will be available in the next update.</p>
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  
  return `${Math.floor(diffDays / 30)} months ago`;
}
