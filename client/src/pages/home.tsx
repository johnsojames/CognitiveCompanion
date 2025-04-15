import React, { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, Bot, ArrowRight, Brain, FileText, Database
} from "lucide-react";
import { useUserStore } from "@/store/settings";
import { conversationsAPI } from "@/lib/api";
import { useConversationStore } from "@/store/conversation";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const userId = useUserStore(state => state.userId);
  const { provider, model } = useConversationStore(state => state.activeModel);
  const [isCreating, setIsCreating] = useState(false);
  const [newConversationTitle, setNewConversationTitle] = useState("");
  
  const createNewConversation = async () => {
    if (!userId) {
      toast({
        variant: "destructive",
        description: "Please log in to create a conversation",
      });
      return;
    }
    
    const title = newConversationTitle.trim() || "New Conversation";
    setIsCreating(true);
    
    try {
      const conversation = await conversationsAPI.create({
        title,
        userId,
        modelProvider: provider,
        modelName: model,
      });
      
      // Navigate to the new conversation
      setLocation(`/conversation/${conversation.id}`);
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast({
        variant: "destructive",
        description: "Failed to create conversation",
      });
    } finally {
      setIsCreating(false);
    }
  };
  
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            <span className="text-primary">RAG</span>
            <span className="text-secondary">LLM</span>
            <span> Assistant</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            A sophisticated RAG LLM system with memory, document access, and learning capabilities.
          </p>
          
          <div className="mt-8 flex flex-col md:flex-row gap-4 justify-center">
            <Card className="w-full md:w-96">
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold mb-4">Start a New Conversation</h2>
                <Input
                  value={newConversationTitle}
                  onChange={(e) => setNewConversationTitle(e.target.value)}
                  placeholder="Enter conversation title (optional)"
                  className="mb-4"
                />
                <div className="text-sm text-muted-foreground mb-4">
                  Using {model} (by {provider})
                </div>
                <Button 
                  onClick={createNewConversation}
                  disabled={isCreating}
                  className="w-full"
                >
                  {isCreating ? "Creating..." : "Create Conversation"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="bg-background-surface1 border-background-surface3">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-primary/20 p-3 rounded-full">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Multiple LLM Providers</h3>
                  <p className="text-sm text-muted-foreground">Claude, GPT, and DeepSeek</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Seamlessly switch between different AI models for specialized tasks.
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-background-surface1 border-background-surface3">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-secondary/20 p-3 rounded-full">
                  <Brain className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <h3 className="font-semibold">Conversation Memory</h3>
                  <p className="text-sm text-muted-foreground">Contextual Understanding</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                The system remembers previous conversations for continuity and context.
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-background-surface1 border-background-surface3">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-primary/20 p-3 rounded-full">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Document Access</h3>
                  <p className="text-sm text-muted-foreground">Knowledge Integration</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Connect documents to conversations for enhanced information retrieval.
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-background-surface1 border-background-surface3">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-secondary/20 p-3 rounded-full">
                  <Database className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <h3 className="font-semibold">Vector Database</h3>
                  <p className="text-sm text-muted-foreground">Semantic Search</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Retrieve relevant information using sophisticated vector embeddings.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
