"""
server.py
---------
The brain of your AI. Loads:
  1. Your local GGUF language model (via llama-cpp-python, CPU only)
  2. Your Chroma vector DB of custom documents (built by ingest.py)

Exposes a single POST /chat endpoint that:
  - embeds the user's question
  - retrieves the most relevant chunks from your documents
  - stuffs them into a prompt as context
  - asks the local model to answer using that context
  - returns the answer + which sources it used

Also serves a minimal chat page at http://localhost:8000

Run with:
    python server.py
"""

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import chromadb
from chromadb.utils import embedding_functions
from llama_cpp import Llama

# ---------------------------------------------------------------------------
# Config — edit these to match your setup
# ---------------------------------------------------------------------------
MODEL_PATH = "models/model.gguf"   # download a small GGUF model and point here
DB_DIR = "chroma_db"
COLLECTION_NAME = "my_knowledge"
EMBED_MODEL = "all-MiniLM-L6-v2"

N_CTX = 4096            # context window
N_THREADS = os.cpu_count() or 4
TOP_K = 4                # how many document chunks to retrieve per question
MAX_NEW_TOKENS = 400

SYSTEM_PROMPT = (
    "You are a helpful assistant. Answer the user's question using ONLY the "
    "provided context when it's relevant. If the context doesn't contain the "
    "answer, say so honestly instead of making something up."
)

# ---------------------------------------------------------------------------
# Load everything once at startup
# ---------------------------------------------------------------------------
app = FastAPI()

print("Loading embedding model + vector DB...")
embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)
chroma_client = chromadb.PersistentClient(path=DB_DIR)
try:
    collection = chroma_client.get_collection(name=COLLECTION_NAME, embedding_function=embed_fn)
    HAS_DOCS = True
except Exception:
    print(f"No collection found yet — run ingest.py first if you want retrieval. Continuing without it.")
    collection = None
    HAS_DOCS = False

print(f"Loading language model from {MODEL_PATH} ({N_THREADS} threads, CPU only)...")
if not Path(MODEL_PATH).exists():
    raise FileNotFoundError(
        f"Model file not found at {MODEL_PATH}. Download a small GGUF model "
        f"(see README.md) and place it there, or update MODEL_PATH."
    )

llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=N_CTX,
    n_threads=N_THREADS,
    verbose=False,
)
print("Ready.")


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[str] = []


# ---------------------------------------------------------------------------
# Retrieval + generation
# ---------------------------------------------------------------------------
def retrieve_context(question: str):
    if not HAS_DOCS:
        return "", []
    results = collection.query(query_texts=[question], n_results=TOP_K)
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    sources = sorted(set(m.get("source", "unknown") for m in metas))
    context = "\n\n---\n\n".join(docs)
    return context, sources


def build_prompt(question: str, context: str) -> str:
    if context:
        return (
            f"<|system|>\n{SYSTEM_PROMPT}\n<|end|>\n"
            f"<|user|>\nContext:\n{context}\n\nQuestion: {question}\n<|end|>\n"
            f"<|assistant|>\n"
        )
    return (
        f"<|system|>\n{SYSTEM_PROMPT}\n<|end|>\n"
        f"<|user|>\n{question}\n<|end|>\n"
        f"<|assistant|>\n"
    )


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    context, sources = retrieve_context(req.message)
    prompt = build_prompt(req.message, context)

    output = llm(
        prompt,
        max_tokens=MAX_NEW_TOKENS,
        temperature=0.7,
        stop=["<|end|>", "<|user|>"],
    )
    answer = output["choices"][0]["text"].strip()
    return ChatResponse(answer=answer, sources=sources)


# ---------------------------------------------------------------------------
# Serve the simple chat page
# ---------------------------------------------------------------------------
app.mount("/", StaticFiles(directory="static", html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
