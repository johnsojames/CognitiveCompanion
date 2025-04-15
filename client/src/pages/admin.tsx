import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/queryClient';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, RefreshCcw, Database, BookOpen, Brain, FileText, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SystemStatus {
  vectorStoreType: string;
  documentCount: number;
  isHealthy: boolean;
  modelProviders: string[];
  lastUpdated: string;
  memoryUsage: {
    total: number;
    used: number;
  };
}

interface ModelStats {
  provider: string;
  name: string;
  requestCount: number;
  averageLatency: number;
  lastUsed: string;
}

interface RAGMetrics {
  retrievalStats: {
    totalQueries: number;
    averageResults: number;
    topReformulations: { query: string; count: number }[];
  };
  documentStats: {
    totalDocuments: number;
    byType: { type: string; count: number }[];
    averageTokens: number;
  };
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('status');
  
  // Get system status
  const { data: systemStatus, isLoading: loadingStatus, error: statusError } = useQuery({
    queryKey: ['/api/admin/status'],
    queryFn: async () => {
      try {
        const response = await apiRequest<SystemStatus>('GET', '/api/admin/status');
        return response;
      } catch (error) {
        console.error('Error fetching system status:', error);
        return null;
      }
    },
  });
  
  // Get model statistics
  const { data: modelStats, isLoading: loadingModels } = useQuery({
    queryKey: ['/api/admin/models'],
    queryFn: async () => {
      try {
        const response = await apiRequest<ModelStats[]>('GET', '/api/admin/models');
        return response;
      } catch (error) {
        console.error('Error fetching model stats:', error);
        return [];
      }
    },
  });
  
  // Get RAG metrics
  const { data: ragMetrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['/api/admin/rag-metrics'],
    queryFn: async () => {
      try {
        const response = await apiRequest<RAGMetrics>('GET', '/api/admin/rag-metrics');
        return response;
      } catch (error) {
        console.error('Error fetching RAG metrics:', error);
        return null;
      }
    },
  });
  
  // Reset vector store mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<{ success: boolean; message: string }>('POST', '/api/admin/reset-vectorstore');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rag-metrics'] });
    },
  });
  
  // Reindex documents mutation
  const reindexMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<{ success: boolean; message: string }>('POST', '/api/admin/reindex-documents');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rag-metrics'] });
    },
  });
  
  const handleResetVectorStore = () => {
    if (window.confirm('Are you sure you want to reset the vector store? This will remove all document embeddings.')) {
      resetMutation.mutate();
    }
  };
  
  const handleReindexDocuments = () => {
    if (window.confirm('Are you sure you want to reindex all documents? This may take a while.')) {
      reindexMutation.mutate();
    }
  };
  
  const isLoading = loadingStatus || loadingModels || loadingMetrics;
  
  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-6">RAG System Admin</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }
  
  // For demo purposes - if no data, show mock data
  const showSystemStatus = systemStatus || {
    vectorStoreType: 'PostgreSQL',
    documentCount: 153,
    isHealthy: true,
    modelProviders: ['claude', 'gpt'],
    lastUpdated: new Date().toISOString(),
    memoryUsage: {
      total: 1024,
      used: 456
    }
  };
  
  const showModelStats = modelStats || [
    {
      provider: 'claude',
      name: 'claude-3-7-sonnet-20250219',
      requestCount: 245,
      averageLatency: 1.34,
      lastUsed: new Date().toISOString()
    },
    {
      provider: 'gpt',
      name: 'gpt-4o',
      requestCount: 189,
      averageLatency: 0.98,
      lastUsed: new Date().toISOString()
    }
  ];
  
  const showRAGMetrics = ragMetrics || {
    retrievalStats: {
      totalQueries: 434,
      averageResults: 4.2,
      topReformulations: [
        { query: 'cloud architecture', count: 23 },
        { query: 'docker containerization', count: 19 },
        { query: 'kubernetes deployment', count: 17 }
      ]
    },
    documentStats: {
      totalDocuments: 153,
      byType: [
        { type: 'pdf', count: 87 },
        { type: 'txt', count: 42 },
        { type: 'md', count: 24 }
      ],
      averageTokens: 1250
    }
  };
  
  const chartData = showRAGMetrics.documentStats.byType.map(item => ({
    name: item.type.toUpperCase(),
    count: item.count
  }));
  
  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">RAG System Admin</h1>
        <div className="flex gap-4">
          <Button 
            variant="outline" 
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/admin/status'] });
              queryClient.invalidateQueries({ queryKey: ['/api/admin/models'] });
              queryClient.invalidateQueries({ queryKey: ['/api/admin/rag-metrics'] });
            }}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="status">System Status</TabsTrigger>
          <TabsTrigger value="models">Model Performance</TabsTrigger>
          <TabsTrigger value="rag">RAG Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="status">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Current system status and health</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Status:</span>
                    {showSystemStatus.isHealthy ? (
                      <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Healthy
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        Issues Detected
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Vector Store:</span>
                    <Badge variant="outline">
                      <Database className="h-4 w-4 mr-1" />
                      {showSystemStatus.vectorStoreType}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Document Count:</span>
                    <Badge variant="outline">
                      <FileText className="h-4 w-4 mr-1" />
                      {showSystemStatus.documentCount}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Model Providers:</span>
                    <div className="flex gap-2">
                      {showSystemStatus.modelProviders.map((provider) => (
                        <Badge key={provider} variant="outline">
                          <Brain className="h-4 w-4 mr-1" />
                          {provider}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Memory Usage:</span>
                    <div className="w-48">
                      <div className="h-2 w-full bg-gray-200 rounded-full">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${(showSystemStatus.memoryUsage.used / showSystemStatus.memoryUsage.total) * 100}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-right mt-1">
                        {Math.round((showSystemStatus.memoryUsage.used / showSystemStatus.memoryUsage.total) * 100)}% used
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Admin Actions</CardTitle>
                <CardDescription>Maintenance operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div>
                    <Button 
                      variant="outline" 
                      className="w-full mb-2"
                      onClick={handleReindexDocuments}
                      disabled={reindexMutation.isPending}
                    >
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Reindex All Documents
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Re-processes and updates vector embeddings for all documents in the system.
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <Button 
                      variant="destructive" 
                      className="w-full mb-2"
                      onClick={handleResetVectorStore}
                      disabled={resetMutation.isPending}
                    >
                      Reset Vector Store
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Deletes all vector embeddings. Original documents will not be affected.
                    </p>
                  </div>
                </div>
                
                {(resetMutation.isPending || reindexMutation.isPending) && (
                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span>{resetMutation.isPending ? 'Resetting vector store...' : 'Reindexing documents...'}</span>
                    </div>
                  </div>
                )}
                
                {(resetMutation.isSuccess || reindexMutation.isSuccess) && (
                  <Alert className="mt-4">
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>
                      {resetMutation.isSuccess ? 'Vector store has been reset.' : 'Document reindexing has been started.'}
                    </AlertDescription>
                  </Alert>
                )}
                
                {(resetMutation.isError || reindexMutation.isError) && (
                  <Alert className="mt-4" variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                      {resetMutation.isError ? 'Failed to reset vector store.' : 'Failed to reindex documents.'}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="models">
          <div className="mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Model Performance</CardTitle>
                <CardDescription>Stats on LLM providers and usage</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Avg. Latency (s)</TableHead>
                      <TableHead>Last Used</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {showModelStats.map((model, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium capitalize">{model.provider}</TableCell>
                        <TableCell>{model.name}</TableCell>
                        <TableCell className="text-right">{model.requestCount}</TableCell>
                        <TableCell className="text-right">{model.averageLatency.toFixed(2)}</TableCell>
                        <TableCell>{new Date(model.lastUsed).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="rag">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Retrieval Statistics</CardTitle>
                <CardDescription>Query and retrieval metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-muted p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Queries</h3>
                      <p className="text-3xl font-bold">{showRAGMetrics.retrievalStats.totalQueries}</p>
                    </div>
                    <div className="bg-muted p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Avg. Results</h3>
                      <p className="text-3xl font-bold">{showRAGMetrics.retrievalStats.averageResults.toFixed(1)}</p>
                    </div>
                  </div>
                  
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Top Query Reformulations</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Query</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {showRAGMetrics.retrievalStats.topReformulations.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.query}</TableCell>
                          <TableCell className="text-right">{item.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Document Statistics</CardTitle>
                <CardDescription>Documents by type and metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Documents</h3>
                    <p className="text-3xl font-bold">{showRAGMetrics.documentStats.totalDocuments}</p>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Avg. Tokens</h3>
                    <p className="text-3xl font-bold">{showRAGMetrics.documentStats.averageTokens}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}