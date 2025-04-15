# Sophisticated RAG LLM System

## Project Overview
A sophisticated Retrieval-Augmented Generation (RAG) LLM system with modular architecture integrating multiple LLM providers (Claude, GPT, and DeepSeek) with conversation memory, document access, and learning capabilities. The system is designed to be deployed across Cloudflare (frontend) and VPS infrastructure (backend).

## Architecture

### Core Components

1. **Multi-Provider LLM Integration**
   - Support for Claude, GPT, and DeepSeek models
   - Factory pattern for model selection and swapping
   - Unified API for all model interactions

2. **Vector Database**
   - PostgreSQL with pgvector extension
   - Efficient similarity search for document retrieval
   - Fallback mechanisms for search when embedding fails

3. **Document Processing**
   - Support for multiple document types (PDF, text, images)
   - Text extraction and chunking system
   - Vector embedding generation and storage

4. **Conversation Memory**
   - Short-term memory for active conversations
   - Long-term memory for user preferences and history
   - Summary generation for context management

5. **Frontend Interface**
   - Responsive design for mobile and desktop
   - Real-time chat UI with typing indicators
   - Document upload and management

### Infrastructure

1. **Database**
   - PostgreSQL for relational data
   - pgvector extension for embedding storage
   - Connection pooling for improved performance

2. **Deployment**
   - Frontend hosted on Cloudflare
   - Backend APIs on VPS
   - Document processing workers

3. **API Integration**
   - OpenAI API for GPT models
   - Anthropic API for Claude models
   - DeepSeek API for alternative models

## Implementation Details

### Database Schema

The system uses the following core database tables:
- Users
- Conversations
- Messages
- Documents
- DocumentConversationLinks
- Settings

Vector embeddings are stored in a dedicated `document_vectors` table with:
- document_id (foreign key to documents table)
- content (full text of document or chunk)
- embedding (vector data for similarity search)

### Vector Search Implementation

The system implements two vector search approaches:
1. **Cosine Similarity** for primary search using the pgvector extension
2. **Text-Based Fallback** using PostgreSQL's text search capabilities

### LLM Provider Factory

The LLM providers are implemented using a factory pattern that:
- Determines available models at runtime
- Handles authentication and API keys
- Provides a unified interface for all models
- Manages token limits and rate limiting

### Document Processing Pipeline

Documents go through the following processing pipeline:
1. Upload and storage
2. Text extraction based on file type
3. Chunking for large documents
4. Embedding generation
5. Storage in vector database
6. Linking to conversations

## Future Enhancements

1. **Learning Capabilities**
   - Fine-tuning on user conversations
   - Personalized responses based on user history
   - Adaptation to user vocabulary and preferences

2. **Advanced RAG Techniques**
   - Hybrid search with keywords and vectors
   - Multi-step retrieval for complex queries
   - Query reformulation for improved search

3. **Integration Capabilities**
   - n8n workflows for automation
   - API endpoints for third-party systems
   - Webhooks for event notifications

4. **Deployment Improvements**
   - Docker containerization
   - Blue-green deployment for zero downtime
   - Git-based version control and CI/CD