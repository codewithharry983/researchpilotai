import os
import shutil
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO
from fastapi import HTTPException, UploadFile, status
from app.core.config import settings


class StorageBackend(ABC):
    @abstractmethod
    def save_file(self, file_obj: BinaryIO, filename: str, user_id: str) -> str:
        """Save a file and return the unique storage key/path."""
        pass

    @abstractmethod
    def get_file_path(self, storage_path: str) -> Path:
        """Retrieve the absolute path to the stored file."""
        pass

    @abstractmethod
    def delete_file(self, storage_path: str) -> bool:
        """Delete a stored file safely."""
        pass


class LocalStorageBackend(StorageBackend):
    def __init__(self, base_dir: str = settings.UPLOAD_DIR):
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, storage_path: str) -> Path:
        """Prevent directory traversal attacks by ensuring path stays within base_dir."""
        target = (self.base_dir / storage_path).resolve()
        if not str(target).startswith(str(self.base_dir)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file path security violation."
            )
        return target

    def save_file(self, file_obj: BinaryIO, filename: str, user_id: str) -> str:
        # Create user-specific upload directory
        user_folder = self.base_dir / user_id
        user_folder.mkdir(parents=True, exist_ok=True)

        # Generate a unique server-controlled storage filename
        allowed_extensions = {".pdf", ".mp3", ".wav", ".m4a", ".json", ".txt", ".md"}
        file_ext = Path(filename).suffix.lower()
        if file_ext not in allowed_extensions:
            file_ext = ".pdf"
        unique_name = f"{uuid.uuid4().hex}{file_ext}"
        storage_rel_path = f"{user_id}/{unique_name}"
        destination = user_folder / unique_name

        with open(destination, "wb") as buffer:
            shutil.copyfileobj(file_obj, buffer)

        return storage_rel_path

    def save_bytes(self, data: bytes, filename: str, user_id: str) -> str:
        import io
        return self.save_file(io.BytesIO(data), filename, user_id)

    def get_file_path(self, storage_path: str) -> Path:
        target = self._resolve_safe_path(storage_path)
        if not target.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document file not found on disk."
            )
        return target

    def delete_file(self, storage_path: str) -> bool:
        try:
            target = self._resolve_safe_path(storage_path)
            if target.exists():
                os.remove(target)
                return True
            return False
        except Exception:
            return False


storage_service = LocalStorageBackend()
