# Retrieval-Augmented Generation (RAG) QA System

This project is a RAG (Retrieval-Augmented Generation) based Question Answering system that allows users to upload PDF documents and interact with them using natural language queries.

The system processes uploaded documents by extracting text, splitting it into chunks, generating embeddings using HuggingFace models, and storing them in a FAISS vector database for semantic retrieval. Relevant document chunks are retrieved and passed to a locally running LLM through Ollama to generate accurate, context-aware responses.

## Features
- PDF Upload & Processing
- Context-Aware Question Answering
- Semantic Search using FAISS
- Real-Time Streaming Responses
- Document Summarization
- Local LLM Inference using Ollama
- FastAPI Backend Integration

## Tech Stack
- Python
- FastAPI
- LangChain
- FAISS
- HuggingFace Embeddings
- Ollama (Llama 3.2)
- Recursive Text Splitting

## Workflow
PDF Upload → Text Extraction → Chunking → Embeddings → Vector Database → Retrieval → LLM Response Generation
