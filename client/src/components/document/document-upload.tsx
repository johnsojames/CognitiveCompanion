import React, { useState, useRef } from "react";
import { useUserStore } from "@/store/settings";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { documentsAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, FileText, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export default function DocumentUpload() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { userId } = useUserStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: ({ file, title, userId }: { file: File, title: string, userId: number }) => {
      setIsUploading(true);
      setUploadProgress(0);
      
      // Create artificial progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 5;
        });
      }, 300);
      
      return documentsAPI.upload(file, title, userId).finally(() => {
        clearInterval(progressInterval);
        setUploadProgress(100);
        setIsUploading(false);
      });
    },
    onSuccess: () => {
      // Reset form
      setFile(null);
      setTitle("");
      
      // Close dialog after a delay
      setTimeout(() => {
        setIsOpen(false);
      }, 1000);
      
      // Invalidate documents query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      
      toast({
        title: "Document uploaded successfully",
        description: "Your document is now being processed and will be available shortly.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred during upload",
        variant: "destructive",
      });
    }
  });
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      // Auto-populate title from filename (without extension)
      if (!title) {
        const fileName = selectedFile.name.split('.').slice(0, -1).join('.');
        setTitle(fileName || selectedFile.name);
      }
    }
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }
    
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please provide a title for the document",
        variant: "destructive",
      });
      return;
    }
    
    uploadMutation.mutate({ file, title, userId });
  };
  
  // Handle drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };
  
  // Handle drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      
      // Auto-populate title from filename (without extension)
      if (!title) {
        const fileName = droppedFile.name.split('.').slice(0, -1).join('.');
        setTitle(fileName || droppedFile.name);
      }
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Upload className="mr-2 h-4 w-4" />
          <span>Upload Document</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="title">Document Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your document"
              disabled={isUploading}
            />
          </div>
          
          {/* File Drop Area */}
          <div
            className={`border-2 border-dashed rounded-md p-6 text-center ${
              dragActive ? 'border-primary bg-primary/5' : 'border-background-surface3'
            } ${file ? 'bg-background-surface2' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
              accept=".txt,.md,.pdf,.docx,.csv"
            />
            
            {file ? (
              <div className="flex items-center justify-center space-x-2">
                <FileText className="h-6 w-6 text-primary" />
                <span className="font-medium">{file.name}</span>
                <button
                  type="button"
                  className="p-1 rounded-full hover:bg-background-surface3"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">
                  Drag & drop your file here or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports TXT, MD, PDF, DOCX, CSV files
                </p>
              </div>
            )}
          </div>
          
          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}
          
          {/* Submit Button */}
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={!file || isUploading}
              className="min-w-24"
            >
              {isUploading ? (
                <span className="flex items-center">Processing...</span>
              ) : uploadProgress === 100 ? (
                <span className="flex items-center">
                  <Check className="mr-2 h-4 w-4" /> Done
                </span>
              ) : (
                <span>Upload</span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}