import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserStore } from '../../store/settings';
import { memoryAPI } from '../../lib/api';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MemoryEntry {
  id: number;
  userId: number;
  conversationId: number | null;
  type: string;
  key: string;
  value: string;
  lastUpdated: string;
  importance: number;
  createdAt: string;
}

export function MemoryInsights() {
  const { userId, isAuthenticated } = useUserStore();
  const [memory, setMemory] = useState<{
    summaries: MemoryEntry[],
    insights: MemoryEntry[],
    preferences: MemoryEntry[]
  }>({
    summaries: [],
    insights: [],
    preferences: []
  });
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (isAuthenticated && userId) {
      loadMemory();
    }
  }, [userId, isAuthenticated]);
  
  const loadMemory = async () => {
    try {
      setLoading(true);
      const userMemory = await memoryAPI.getUserMemory(userId);
      setMemory(userMemory);
    } catch (error) {
      console.error('Failed to load memory:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const renderMemoryEntries = (entries: MemoryEntry[]) => {
    if (entries.length === 0) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          No entries available yet
        </div>
      );
    }
    
    return (
      <ScrollArea className="h-[300px]">
        <div className="space-y-3 p-2">
          {entries.map(entry => (
            <Card key={entry.id} className="bg-card/80">
              <CardHeader className="p-3 pb-1">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm">{formatKey(entry.key)}</CardTitle>
                  <Badge variant={getImportanceBadgeVariant(entry.importance)}>
                    {entry.importance}/10
                  </Badge>
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
    );
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
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Memory System</CardTitle>
        <CardDescription>Long-term memory of your conversations with AI</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="insights">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="summaries">Summaries</TabsTrigger>
          </TabsList>
          <TabsContent value="insights" className="mt-4">
            {loading ? (
              <div className="text-center p-4">Loading insights...</div>
            ) : (
              renderMemoryEntries(memory.insights)
            )}
          </TabsContent>
          <TabsContent value="preferences" className="mt-4">
            {loading ? (
              <div className="text-center p-4">Loading preferences...</div>
            ) : (
              renderMemoryEntries(memory.preferences)
            )}
          </TabsContent>
          <TabsContent value="summaries" className="mt-4">
            {loading ? (
              <div className="text-center p-4">Loading summaries...</div>
            ) : (
              renderMemoryEntries(memory.summaries)
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}