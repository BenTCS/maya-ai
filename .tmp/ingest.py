"""
ingest.py
---------
Reads every file in ./documents, splits it into chunks, embeds those
chunks with a small CPU-friendly embedding model, and stores the
result in a local Chroma vector database (./chroma_db).

Run this once whenever you add or change your custom documents:

    python ingest.py
"""

import os
import glob
from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions
from pypdf import PdfReader

DOCS_DIR = "documents"
DB_DIR = "chroma_db"
COLLECTION_NAME = "my_knowledge"

# Small, fast, CPU-friendly embedding model (~80MB)
EMBED_MODEL = "all-MiniLM-L6-v2"

CHUNK_SIZE = 800       # characters per chunk
CHUNK_OVERLAP = 150    # overlap between chunks so context isn't cut off


def read_text_from_file(path: str) -> str:
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        reader = PdfReader(path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    elif ext in (".txt", ".md", ".csv", ".json"):
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    else:
        return ""


def chunk_text(text: str, size: int, overlap: int):
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end])
        start += size - overlap
    return [c.strip() for c in chunks if c.strip()]


def main():
    os.makedirs(DOCS_DIR, exist_ok=True)

    files = glob.glob(os.path.join(DOCS_DIR, "**", "*"), recursive=True)
    files = [f for f in files if os.path.isfile(f)]

    if not files:
        print(f"No files found in ./{DOCS_DIR}. Put your .txt/.md/.pdf files there and re-run.")
        return

    print(f"Found {len(files)} file(s). Embedding with '{EMBED_MODEL}' (CPU)...")

    embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)
    client = chromadb.PersistentClient(path=DB_DIR)

    # Fresh collection each run, so re-ingesting doesn't duplicate old chunks
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    collection = client.create_collection(name=COLLECTION_NAME, embedding_function=embed_fn)

    all_chunks, all_ids, all_metadata = [], [], []
    chunk_counter = 0

    for path in files:
        text = read_text_from_file(path)
        if not text.strip():
            continue
        chunks = chunk_text(text, CHUNK_SIZE, CHUNK_OVERLAP)
        for chunk in chunks:
            all_chunks.append(chunk)
            all_ids.append(f"chunk_{chunk_counter}")
            all_metadata.append({"source": os.path.relpath(path, DOCS_DIR)})
            chunk_counter += 1
        print(f"  {os.path.relpath(path, DOCS_DIR)}: {len(chunks)} chunks")

    if not all_chunks:
        print("No readable text found in any file.")
        return

    # Add in batches to keep memory reasonable
    BATCH = 100
    for i in range(0, len(all_chunks), BATCH):
        collection.add(
            documents=all_chunks[i:i + BATCH],
            ids=all_ids[i:i + BATCH],
            metadatas=all_metadata[i:i + BATCH],
        )

    print(f"Done. Stored {len(all_chunks)} chunks in {DB_DIR}/")


if __name__ == "__main__":
    main()
