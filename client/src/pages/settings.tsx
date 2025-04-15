import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectGroup,
  SelectItem, 
  SelectLabel, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import {
  Slider
} from "@/components/ui/slider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { 
  Database, 
  Save, 
  User, 
  Settings as SettingsIcon, 
  RefreshCw,
  BrainCircuit 
} from "lucide-react";
import { useUserStore } from "@/store/settings";
import { useMutation, useQuery } from "@tanstack/react-query";
import { settingsAPI } from "@/lib/api";
import { modelProviders, insertSettingsSchema } from "@shared/schema";

const profileFormSchema = z.object({
  username: z.string().min(3).max(50),
  displayName: z.string().min(2).max(100).optional(),
});

const settingsFormSchema = insertSettingsSchema.extend({
  userId: z.number(),
  defaultModelProvider: z.enum(modelProviders),
  defaultModelName: z.string(),
  vectorDbType: z.enum(["memory", "qdrant", "chroma"]),
  memoryLimit: z.number().min(1).max(100),
});

export default function Settings() {
  const { toast } = useToast();
  const userId = useUserStore(state => state.userId);
  const username = useUserStore(state => state.username);
  const displayName = useUserStore(state => state.displayName);
  const setUserDetails = useUserStore(state => state.setUserDetails);
  
  // Fetch user settings
  const { 
    data: settings,
    isLoading: isLoadingSettings,
    refetch: refetchSettings
  } = useQuery({
    queryKey: ['/api/settings', userId],
    queryFn: () => settingsAPI.getByUserId(userId),
    enabled: !!userId,
  });

  // Update settings mutation
  const { mutate: updateSettings, isPending: isUpdatingSettings } = useMutation({
    mutationFn: settingsAPI.update,
    onSuccess: (data) => {
      toast({
        description: "Settings updated successfully",
      });
      refetchSettings();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: `Failed to update settings: ${error.message}`,
      });
    },
  });

  // Profile form
  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: username || "",
      displayName: displayName || "",
    },
  });

  // Settings form
  const settingsForm = useForm<z.infer<typeof settingsFormSchema>>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      userId: userId,
      defaultModelProvider: "claude",
      defaultModelName: "claude-3-7-sonnet-20250219",
      vectorDbType: "memory",
      memoryLimit: 10,
    },
  });

  // Update form values when settings are loaded
  React.useEffect(() => {
    if (settings) {
      settingsForm.reset({
        userId: settings.userId,
        defaultModelProvider: settings.defaultModelProvider,
        defaultModelName: settings.defaultModelName,
        vectorDbType: settings.vectorDbType,
        memoryLimit: settings.memoryLimit,
      });
    }
  }, [settings, settingsForm]);

  const onProfileSubmit = (data: z.infer<typeof profileFormSchema>) => {
    // In a real app, you would update the user profile via API
    toast({
      description: "Profile updated successfully",
    });
    
    // Update local user store
    setUserDetails(data.username, data.displayName || "");
  };

  const onSettingsSubmit = (data: z.infer<typeof settingsFormSchema>) => {
    updateSettings(data);
  };

  // Get available models based on selected provider
  const getModelsForProvider = (provider: string) => {
    switch (provider) {
      case "claude":
        return [
          { value: "claude-3-7-sonnet-20250219", label: "Claude Opus (3-7-sonnet)" },
          { value: "claude-3-opus-20240229", label: "Claude Opus (3-opus)" },
          { value: "claude-3-sonnet-20240229", label: "Claude Sonnet" },
          { value: "claude-3-haiku-20240307", label: "Claude Haiku" },
        ];
      case "gpt":
        return [
          { value: "gpt-4o", label: "GPT-4o" },
          { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
          { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
        ];
      case "deepseek":
        return [
          { value: "deepseek-coder", label: "DeepSeek Coder" },
          { value: "deepseek-chat", label: "DeepSeek Chat" },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and application preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <span>Profile</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                  <FormField
                    control={profileForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={profileForm.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Name" {...field} />
                        </FormControl>
                        <FormDescription>
                          This is the name that will be displayed to others.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button type="submit" className="w-full">
                    <Save className="mr-2 h-4 w-4" />
                    Update Profile
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* AI Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-primary" />
                <span>AI Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...settingsForm}>
                <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-4">
                  <FormField
                    control={settingsForm.control}
                    name="defaultModelProvider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Model Provider</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select model provider" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="claude">Claude (Anthropic)</SelectItem>
                            <SelectItem value="gpt">GPT (OpenAI)</SelectItem>
                            <SelectItem value="deepseek">DeepSeek</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={settingsForm.control}
                    name="defaultModelName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Model</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getModelsForProvider(settingsForm.watch("defaultModelProvider")).map(model => (
                              <SelectItem key={model.value} value={model.value}>
                                {model.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={settingsForm.control}
                    name="vectorDbType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vector Database Type</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select vector database" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="memory">In-Memory (Development)</SelectItem>
                            <SelectItem value="qdrant">Qdrant</SelectItem>
                            <SelectItem value="chroma">ChromaDB</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Vector database used for document embeddings and retrieval.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={settingsForm.control}
                    name="memoryLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Memory Limit (GB): {field.value}</FormLabel>
                        <FormControl>
                          <Slider
                            defaultValue={[field.value]}
                            max={100}
                            min={1}
                            step={1}
                            onValueChange={(values) => field.onChange(values[0])}
                            className="py-4"
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum memory limit for vector storage.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isUpdatingSettings}
                  >
                    {isUpdatingSettings ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Settings
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* System Information */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-primary" />
                <span>System Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-4 p-4 bg-background-surface2 rounded-lg">
                  <Database className="h-8 w-8 text-primary/70" />
                  <div>
                    <div className="text-sm text-muted-foreground">Memory Usage</div>
                    <div className="text-lg font-medium flex items-baseline">
                      <span className="text-green-500">65%</span>
                      <span className="text-muted-foreground text-sm ml-1">of 10GB</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-4 bg-background-surface2 rounded-lg">
                  <BrainCircuit className="h-8 w-8 text-secondary/70" />
                  <div>
                    <div className="text-sm text-muted-foreground">Active Learning</div>
                    <div className="text-lg font-medium">
                      <span className="text-secondary">Enabled</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-background-surface2 rounded-lg">
                <h3 className="text-sm font-medium mb-2">API Status</h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-success"></span>
                    <span>Claude API</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-success"></span>
                    <span>OpenAI API</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-warning"></span>
                    <span>DeepSeek API</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
