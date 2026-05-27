from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import tempfile
import os

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage

app = FastAPI(title="RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

global_state = {
    "vector_store": None,
    "doc_splits": []
}

class ChatRequest(BaseModel):
    query: str
    model: str = "llama3.2:1b"

class SummarizeRequest(BaseModel):
    model: str = "llama3.2:1b"

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        tmp_file.write(await file.read())
        tmp_path = tmp_file.name

    try:
        loader = PyPDFLoader(tmp_path)
        docs = loader.load()
        
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        splits = text_splitter.split_documents(docs)
        
        embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        vector_store = FAISS.from_documents(splits, embeddings)
        
        global_state["vector_store"] = vector_store
        global_state["doc_splits"] = splits
        
        return {"message": "Document processed successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.remove(tmp_path)

@app.post("/api/chat")
async def chat(request: ChatRequest):
    if global_state["vector_store"] is None:
        raise HTTPException(status_code=400, detail="Please upload a document first.")
        
    try:
        llm = OllamaLLM(model=request.model)
        # Reduce from default 4 to 2 chunks to drastically speed up CPU inference time
        retriever = global_state["vector_store"].as_retriever(search_kwargs={"k": 2})
        
        retrieved_docs = retriever.invoke(request.query)
        context_text = "\n\n".join(doc.page_content for doc in retrieved_docs)
        
        system_prompt = (
            "You are a highly intelligent and helpful AI assistant. "
            "Use the following pieces of retrieved context to answer the question. "
            "If the answer is not in the context, say you don't know based on the provided document. "
            "Keep the answer concise, nicely formatted, and to the point."
            "\n\n"
            f"Context:\n{context_text}"
        )
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=request.query)
        ]
        
        async def generate():
            for chunk in llm.stream(messages):
                yield chunk
                
        return StreamingResponse(generate(), media_type="text/plain")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/summarize")
async def summarize(request: SummarizeRequest):
    if not global_state["doc_splits"]:
        raise HTTPException(status_code=400, detail="Please upload a document first.")
        
    try:
        llm = OllamaLLM(model=request.model)
        summary_context = "\n\n".join(doc.page_content for doc in global_state["doc_splits"][:2])
        
        prompt = (
            "Based on the following excerpts from the beginning of a document, "
            "provide a high-level summary and explain what this document is about. "
            "Make it engaging, well-formatted, and highlight the core themes in about 3-4 sentences.\n\n"
            f"{summary_context}"
        )
        
        async def generate():
            for chunk in llm.stream(prompt):
                yield chunk
                
        return StreamingResponse(generate(), media_type="text/plain")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Note: Using absolute path to frontend so we can easily run it from anywhere.
# But for now relative from backend directory is fine.
app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")
