"""PDF text extraction with page-level metadata."""
from pypdf import PdfReader
from typing import List, Dict, Any
import io
import logging

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    """
    Extract text from PDF page by page.
    Returns list of dicts: {filename, page_number, text}
    """
    pages = []
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        for i, page in enumerate(reader.pages):
            try:
                text = page.extract_text() or ""
                text = clean_text(text)
                if text.strip():
                    pages.append({
                        "filename": filename,
                        "page_number": i + 1,
                        "text": text,
                        "source_type": "pdf"
                    })
            except Exception as e:
                logger.warning(f"Failed to extract page {i+1} from {filename}: {e}")
                continue
        logger.info(f"Extracted {len(pages)} pages from {filename}")
    except Exception as e:
        logger.error(f"Failed to process PDF {filename}: {e}")
        raise ValueError(f"Could not process PDF: {str(e)}")
    
    return pages


def clean_text(text: str) -> str:
    """Clean extracted text."""
    if not text:
        return ""
    # Normalize whitespace
    lines = [line.strip() for line in text.splitlines()]
    text = "\n".join(line for line in lines if line)
    # Remove excessive spaces
    import re
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
