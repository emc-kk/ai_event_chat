import os
import shutil
import logging
from typing import List, Optional
from llama_index.core import Document, VectorStoreIndex, StorageContext
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.vector_stores.postgres import PGVectorStore

logger = logging.getLogger(__name__)

from ..config import (
    OPENAI_API_KEY,
    EMBEDDING_MODEL,
    EMBEDDING_DIM,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    HNSW_CONFIG,
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
)
from .file import (
    load_and_clean_documents,
    process_pdf_with_vision,
    is_image_file,
    process_image_file,
    clean_text,
)

def create_custom_vector_store(table_name: str) -> PGVectorStore:
    vector_store = PGVectorStore.from_params(
        database=POSTGRES_DB,
        host=POSTGRES_HOST,
        password=POSTGRES_PASSWORD,
        port=POSTGRES_PORT,
        user=POSTGRES_USER,
        table_name=table_name,
        embed_dim=EMBEDDING_DIM,
        hybrid_search=True,
        text_search_config="english",
        hnsw_kwargs=HNSW_CONFIG,
    )
    
    try:
        if hasattr(vector_store, 'create_tables_if_not_exists'):
            vector_store.create_tables_if_not_exists()
        elif hasattr(vector_store, 'create_tables'):
            vector_store.create_tables()
        else:
            logger.debug(f"Table '{table_name}' will be created automatically on first use")
        logger.info(f"Ensured table '{table_name}' exists")
    except Exception as e:
        logger.warning(f"Could not create table '{table_name}': {e}. It may already exist or will be created automatically.")
    
    return vector_store


def create_knowledge_documents_vector_store() -> PGVectorStore:
    return create_custom_vector_store("knowledge_documents")


def create_knowledge_hearing_qa_vector_store() -> PGVectorStore:
    return create_custom_vector_store("knowledge_hearing_qa")


def get_embed_model() -> OpenAIEmbedding:
    return OpenAIEmbedding(
        api_key=OPENAI_API_KEY,
        model=EMBEDDING_MODEL
    )


def index_documents_to_vector_store(
    documents: List[Document],
    vector_store: PGVectorStore,
    embed_model: Optional[OpenAIEmbedding] = None,
    use_chunking: bool = False
) -> VectorStoreIndex:
    if embed_model is None:
        embed_model = get_embed_model()

    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    if use_chunking:
        splitter = SentenceSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP
        )
        nodes = splitter.get_nodes_from_documents(documents)

        for node in nodes:
            if hasattr(node, 'text') and node.text:
                node.text = clean_text(node.text)

        index = VectorStoreIndex(
            nodes=nodes,
            storage_context=storage_context,
            embed_model=embed_model,
        )
    else:
        index = VectorStoreIndex.from_documents(
            documents,
            storage_context=storage_context,
            embed_model=embed_model,
        )

    return index


def create_index_from_documents(documents):
    vector_store = create_knowledge_documents_vector_store()
    return index_documents_to_vector_store(
        documents=documents,
        vector_store=vector_store,
        use_chunking=True
    )


def _load_parsed_text_files(temp_dir, relative_path_to_document_id=None):
    parsed_documents = []

    if not relative_path_to_document_id:
        return parsed_documents

    for filename, doc_id in relative_path_to_document_id.items():
        parsed_key = f"{filename}.parsed.txt"
        parsed_file_path = os.path.join(temp_dir, parsed_key)

        if os.path.exists(parsed_file_path):
            try:
                with open(parsed_file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                if content and content.strip():
                    doc = Document(
                        text=clean_text(content),
                        metadata={
                            'file_path': parsed_file_path,
                            'file_name': filename,
                            'document_id': doc_id,
                            'source': 'parsed_media',
                        }
                    )
                    parsed_documents.append(doc)
                    logger.info(f"Loaded parsed file: {parsed_key}")
            except Exception as e:
                logger.warning(f"Error loading parsed file {parsed_key}: {e}")

    return parsed_documents


def process_directory_indexing(temp_dir, request_id, topic_id, relative_path_to_document_id=None):
    try:
        documents = []
        try:
            documents = load_and_clean_documents(temp_dir, is_directory=True)
        except ValueError as e:
            if "No files found" not in str(e):
                raise
            logger.info(f"No standard files found in {temp_dir}, checking for parsed files...")

        parsed_docs = _load_parsed_text_files(temp_dir, relative_path_to_document_id)
        if parsed_docs:
            documents.extend(parsed_docs)
            logger.info(f"Loaded {len(parsed_docs)} parsed text files for indexing")

        if not documents:
            logger.info(f"No indexable files found in {temp_dir}")
            return True
        
        for doc in documents:
            if not doc.text or not doc.text.strip():
                file_path = doc.metadata.get('file_path') or doc.metadata.get('path')
                if file_path and os.path.exists(file_path):
                    if file_path.lower().endswith('.pdf'):
                        vision_texts = process_pdf_with_vision(file_path)
                        if vision_texts:
                            doc.set_content('\n\n'.join(vision_texts))
                    elif is_image_file(filename=file_path):
                        with open(file_path, 'rb') as f:
                            content = f.read()
                        vision_text = process_image_file(os.path.basename(file_path), content)
                        if vision_text:
                            doc.set_content(vision_text)
        
        for doc in documents:
            doc.metadata['request_id'] = request_id
            doc.metadata['topic_id'] = topic_id
            file_path = doc.metadata.get('file_path') or doc.metadata.get('path')
            if file_path:
                try:
                    rel_path = os.path.relpath(file_path, start=temp_dir)
                    if relative_path_to_document_id and rel_path in relative_path_to_document_id:
                        doc.metadata['document_id'] = relative_path_to_document_id[rel_path]
                except Exception:
                    pass
        
        index = create_index_from_documents(documents)
        
        return True

    except Exception as e:
        logger.error(f"Error creating index: {e}", exc_info=True)
        return False
