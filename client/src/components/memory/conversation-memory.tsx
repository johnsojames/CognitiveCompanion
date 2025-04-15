import { useEffect, useState } from 'react';
import { useConversationStore } from '@/store/conversation';
import { useUserStore } from '@/store/settings';
import { memoryAPI } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MemoryEntry } from '@shared/schema';
import { Brain } from 'lucide-react';

interface ConversationMemoryProps {
  conversationId: number;
}

export function ConversationMemory({ conversationId }: ConversationMemoryProps) {
  const { userId } = useUserStore();
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (userId && conversationId) {
      loadMemoryEntries();
    }
  }, [userId, conversationId]);
  
  const loadMemoryEntries = async () => {
    try {
      setLoading(true);
      // Fetch conversation-specific memory (summaries and insights)
      const response = await memoryAPI.getUserMemory(userId);
      
      // Filter entries for this conversation
      const conversationEntries = [
        ...response.summaries.filter(entry => entry.conversationId === conversationId),
        ...response.insights.filter(entry => entry.conversationId === conversationId)
      ];
      
      setMemoryEntries(conversationEntries);
    } catch (error) {
      console.error('Failed to load conversation memory:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatKey = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  };
  
  const getImportanceBadgeVariant = (importance: number): "default" | "secondary" | "destructive" => {
    if (importance >= 8) return "destructive";
    if (importance >= 5) return "default";
    return "secondary";
  };
  
  if (memoryEntries.length === 0 && !loading) {
    return null;
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="h-5 w-5 text-primary" />
          <span>AI Memory</span>
        </CardTitle>
        <CardDescription>
          Key information the AI remembers about this conversation
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center p-4">Loading memory...</div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3 p-2">
              {memoryEntries.map(entry => (
                <Card key={entry.id} className="bg-card/80">
                  <CardHeader className="p-3 pb-1">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm">{formatKey(entry.key)}</CardTitle>
                      {entry.importance && (
                        <Badge variant={getImportanceBadgeVariant(entry.importance)}>
                          {entry.importance}/10
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs">
                      {new Date(entry.lastUpdated).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 text-sm">
                    {entry.value}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}