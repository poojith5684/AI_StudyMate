"""Text chunking with metadata preservation."""
from typing import List, Dict, Any
from app.config import get_settings
import re
import uuid

settings = get_settings()


def chunk_text(
    pages_or_slides: List[Dict[str, Any]],
    course_id: str,
    material_id: str,
    user_id: str,
    chunk_size: int = None,
    overlap: int = None,
) -> List[Dict[str, Any]]:
    """
    Split extracted pages/slides into overlapping chunks while preserving source metadata.
    """
    chunk_size = chunk_size or settings.CHUNK_SIZE
    overlap = overlap or settings.CHUNK_OVERLAP
    
    chunks = []
    chunk_index = 0
    
    for item in pages_or_slides:
        text = item.get("text", "")
        if not text.strip():
            continue
        
        # Split into sentences roughly for better boundaries
        sentences = split_into_sentences(text)
        
        current_chunk = ""
        for sentence in sentences:
            if len(current_chunk) + len(sentence) + 1 <= chunk_size:
                current_chunk = (current_chunk + " " + sentence).strip()
            else:
                if current_chunk:
                    chunks.append(make_chunk(
                        text=current_chunk,
                        item=item,
                        course_id=course_id,
                        material_id=material_id,
                        user_id=user_id,
                        chunk_index=chunk_index,
                    ))
                    chunk_index += 1
                
                # Start new chunk with overlap
                if overlap > 0 and current_chunk:
                    overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                    current_chunk = (overlap_text + " " + sentence).strip()
                else:
                    current_chunk = sentence
        
        # Last chunk
        if current_chunk.strip():
            chunks.append(make_chunk(
                text=current_chunk,
                item=item,
                course_id=course_id,
                material_id=material_id,
                user_id=user_id,
                chunk_index=chunk_index,
            ))
            chunk_index += 1
    
    return chunks


def make_chunk(text: str, item: Dict, course_id: str, material_id: str, user_id: str, chunk_index: int) -> Dict[str, Any]:
    source_type = item.get("source_type", "unknown")
    meta = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "course_id": course_id,
        "material_id": material_id,
        "filename": item.get("filename", "unknown"),
        "chunk_index": chunk_index,
        "text": text,
        "source_type": source_type,
    }
    
    if source_type == "pdf":
        meta["page_number"] = item.get("page_number")
        meta["citation"] = f"{item.get('filename')} — Page {item.get('page_number')}"
    elif source_type in ("pptx", "ppt"):
        meta["slide_number"] = item.get("slide_number")
        meta["title"] = item.get("title")
        meta["citation"] = f"{item.get('filename')} — Slide {item.get('slide_number')}"
    else:
        meta["citation"] = item.get("filename", "Source")
    
    return meta


def split_into_sentences(text: str) -> List[str]:
    """Simple sentence splitter."""
    # Split on period, question mark, exclamation followed by space/capital
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)
    return [s.strip() for s in sentences if s.strip()]
