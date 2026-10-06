from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List
from datetime import datetime
import uuid

from app.schemas import MaterialOut, MaterialStatus
from app.routes.auth import get_current_user
from app.config import get_settings
from app.services.pdf_processor import extract_text_from_pdf
from app.services.ppt_processor import extract_text_from_pptx
from app.services.chunking import chunk_text
from app.services.embeddings import generate_embeddings
from app.services.vector_store import add_chunks

router = APIRouter()
settings = get_settings()

# In-memory materials for dev
_dev_materials: dict = {}


def get_course_material_count(course_id: str, user_id: str) -> int:
    """Count this user's in-memory materials for a course."""
    return sum(
        1 for material in _dev_materials.values()
        if material["course_id"] == course_id and material["user_id"] == user_id
    )


@router.post("/upload", response_model=MaterialOut)
async def upload_material(
    course_id: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Upload and process a study material (PDF / PPTX / TXT)."""
    filename = file.filename or "unknown"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    
    if ext not in settings.allowed_extensions_list:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed: {settings.ALLOWED_EXTENSIONS}"
        )
    
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max {settings.MAX_FILE_SIZE_MB}MB"
        )
    
    material_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    material = {
        "id": material_id,
        "course_id": course_id,
        "user_id": user["id"],
        "filename": filename,
        "file_type": ext,
        "status": MaterialStatus.PROCESSING.value,
        "page_count": None,
        "chunk_count": None,
        "error_message": None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    
    _dev_materials[material_id] = material
    
    try:
        # Extract text
        if ext == "pdf":
            pages = extract_text_from_pdf(content, filename)
        elif ext in ("pptx", "ppt"):
            pages = extract_text_from_pptx(content, filename)
        elif ext in ("txt", "srt", "vtt"):
            text = content.decode("utf-8", errors="ignore")
            pages = [{"filename": filename, "page_number": 1, "text": text, "source_type": "txt"}]
        else:
            raise ValueError(f"Unsupported type: {ext}")
        
        material["page_count"] = len(pages)
        material["status"] = MaterialStatus.INDEXING.value
        
        # Chunk
        chunks = chunk_text(pages, course_id, material_id, user["id"])
        
        if not chunks:
            raise ValueError("No extractable text found in the file")
        
        # Try embeddings, but don't fail the whole process
        try:
            texts = [c["text"] for c in chunks]
            embeddings = await generate_embeddings(texts)
            add_chunks(course_id, chunks, embeddings)
        except Exception as e:
            print(f"Embedding failed, continuing without vectors: {e}")
            from app.services.vector_store import _store
            for chunk in chunks:
                _store[course_id].append({
                    "chunk": chunk,
                    "embedding": None
                })
        
        material["chunk_count"] = len(chunks)
        material["status"] = MaterialStatus.READY.value
        material["updated_at"] = datetime.utcnow().isoformat()
        
    except Exception as e:
        material["status"] = MaterialStatus.ERROR.value
        material["error_message"] = str(e)
        material["updated_at"] = datetime.utcnow().isoformat()
        print(f"Material processing error: {e}")
    
    return MaterialOut(
        id=material["id"],
        course_id=material["course_id"],
        filename=material["filename"],
        file_type=material["file_type"],
        status=MaterialStatus(material["status"]),
        page_count=material.get("page_count"),
        chunk_count=material.get("chunk_count"),
        error_message=material.get("error_message"),
        created_at=datetime.fromisoformat(material["created_at"]),
        updated_at=datetime.fromisoformat(material["updated_at"]),
    )


@router.get("/course/{course_id}", response_model=List[MaterialOut])
async def list_materials(course_id: str, user: dict = Depends(get_current_user)):
    """List materials for a course."""
    mats = [
        MaterialOut(
            id=m["id"],
            course_id=m["course_id"],
            filename=m["filename"],
            file_type=m["file_type"],
            status=MaterialStatus(m["status"]),
            page_count=m.get("page_count"),
            chunk_count=m.get("chunk_count"),
            error_message=m.get("error_message"),
            created_at=datetime.fromisoformat(m["created_at"]),
            updated_at=datetime.fromisoformat(m["updated_at"]) if m.get("updated_at") else None,
        )
        for m in _dev_materials.values()
        if m["course_id"] == course_id and m["user_id"] == user["id"]
    ]
    return mats


@router.get("/{material_id}/status", response_model=MaterialOut)
async def get_material_status(material_id: str, user: dict = Depends(get_current_user)):
    """Get processing status of a material."""
    m = _dev_materials.get(material_id)
    if not m or m["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Material not found")
    
    return MaterialOut(
        id=m["id"],
        course_id=m["course_id"],
        filename=m["filename"],
        file_type=m["file_type"],
        status=MaterialStatus(m["status"]),
        page_count=m.get("page_count"),
        chunk_count=m.get("chunk_count"),
        error_message=m.get("error_message"),
        created_at=datetime.fromisoformat(m["created_at"]),
        updated_at=datetime.fromisoformat(m["updated_at"]) if m.get("updated_at") else None,
    )
