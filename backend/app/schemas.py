from typing import Literal

from pydantic import BaseModel, Field, field_validator


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    priority: Literal["low", "normal", "high"] = "normal"
    due_at: str | None = None

    @field_validator("title")
    @classmethod
    def trim_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be blank")
        return value


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    status: Literal["open", "done"] | None = None
    priority: Literal["low", "normal", "high"] | None = None
    due_at: str | None = None


class MemoryCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    category: Literal[
        "preferences", "projects", "tasks", "notes", "workflows", "technical_context"
    ]

    @field_validator("content")
    @classmethod
    def trim_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Memory content cannot be blank")
        return value


class AutomationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    trigger: str = Field(min_length=1, max_length=240)
    actions: list[str] = Field(default_factory=list, max_length=20)


class AutomationRunRequest(BaseModel):
    confirmed: bool = False


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)

    @field_validator("content")
    @classmethod
    def trim_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message content cannot be blank")
        return value


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)