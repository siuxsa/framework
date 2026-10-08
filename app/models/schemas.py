"""
Pydantic request body models for all API endpoints.
"""

from typing import Any, List, Optional
from pydantic import BaseModel


class StateBody(BaseModel):
    key: str
    value: Any


class ToolBody(BaseModel):
    name: str
    description: Optional[str] = ""
    command: Optional[str] = ""
    folder_id: Optional[str] = None


class ToolUpdateBody(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    command: Optional[str] = None


class FolderBody(BaseModel):
    name: str


class MoveToolBody(BaseModel):
    # None → move the tool out of any folder (unfiled / "All Tools" only)
    folderId: Optional[str] = None


class ReorderBody(BaseModel):
    order: List[str]


class PipeBody(BaseModel):
    name: str
    tools: List[Any]


class FsListBody(BaseModel):
    path: Optional[str] = None


class FsReadBody(BaseModel):
    filePath: str


class FsWriteBody(BaseModel):
    filePath: str
    content: Optional[str] = ""


class FsDeleteBody(BaseModel):
    filePath: str


class TerminalBody(BaseModel):
    command: str


class TerminalInputBody(BaseModel):
    input: str


class TerminalCompleteBody(BaseModel):
    line: str


class StopToolBody(BaseModel):
    id: int


class ExecuteTaskBody(BaseModel):
    toolName: str
    target: str
    rawCommand: str


class ResetBody(BaseModel):
    # "cache" → clear generated logs/run data + transient pipeline state (keeps tools & pipes)
    # "all"   → factory reset: wipe tools, pipes, logs, state; restore default tools
    mode: str
