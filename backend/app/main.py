import json
import os
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware

from backend.app.ai import AIUnavailable, complete_chat, get_status as get_ai_status
from backend.app.schemas import (
    AutomationCreate,
    AutomationRunRequest,
    ChatRequest,
    MemoryCreate,
    TaskCreate,
    TaskUpdate,
)
from backend.app.storage import connect, initialize


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def create_app(database_path: Path | None = None) -> FastAPI:
    default_data_dir = Path.home() / ".local" / "share" / "nova"
    db_path = database_path or Path(os.getenv("NOVA_DATA_DIR", default_data_dir)) / "nova.sqlite3"
    initialize(db_path)
    app = FastAPI(title="NOVA Local API", version="0.1.0")

    allowed_origins = [
        origin.strip()
        for origin in os.getenv("NOVA_ALLOWED_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
    )

    def get_db():
        connection = connect(db_path)
        try:
            yield connection
        finally:
            connection.close()

    Db = Annotated[sqlite3.Connection, Depends(get_db)]

    @app.get("/health")
    def health(db: Db):
        try:
            db.execute("SELECT 1")
            return {"status": "ok", "storage": "ok", "ai": "local_provider", "sync": "offline"}
        except sqlite3.Error as error:
            raise HTTPException(status_code=503, detail="Local database is unavailable") from error

    @app.get("/api/v1/ai/status")
    def ai_status():
        return get_ai_status()

    @app.post("/api/v1/ai/chat")
    def ai_chat(request: ChatRequest):
        try:
            reply = complete_chat([message.model_dump() for message in request.messages])
        except AIUnavailable as error:
            raise HTTPException(
                status_code=503,
                detail={"code": "local_model_unavailable", "message": str(error)},
            ) from error
        return {"reply": reply, "provider": "ollama", "stored": False}

    @app.get("/api/v1/tasks")
    def list_tasks(db: Db):
        rows = db.execute("SELECT * FROM tasks ORDER BY status, created_at DESC").fetchall()
        return [dict(row) for row in rows]

    @app.post("/api/v1/tasks", status_code=status.HTTP_201_CREATED)
    def create_task(task: TaskCreate, db: Db):
        task_id = str(uuid.uuid4())
        created_at = now_iso()
        db.execute(
            "INSERT INTO tasks (id, title, priority, due_at, created_at) VALUES (?, ?, ?, ?, ?)",
            (task_id, task.title, task.priority, task.due_at, created_at),
        )
        db.commit()
        return {
            "id": task_id,
            "title": task.title,
            "status": "open",
            "priority": task.priority,
            "due_at": task.due_at,
            "created_at": created_at,
        }

    @app.patch("/api/v1/tasks/{task_id}")
    def update_task(task_id: str, update: TaskUpdate, db: Db):
        changes = update.model_dump(exclude_unset=True, exclude_none=True)
        if "title" in changes:
            changes["title"] = changes["title"].strip()
            if not changes["title"]:
                raise HTTPException(status_code=422, detail="Task title cannot be blank")
        if not changes:
            raise HTTPException(status_code=400, detail="Provide at least one task field to update")
        columns = ", ".join(f"{key} = ?" for key in changes)
        cursor = db.execute(
            f"UPDATE tasks SET {columns} WHERE id = ?", (*changes.values(), task_id)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        db.commit()
        return dict(db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone())

    @app.delete("/api/v1/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_task(task_id: str, db: Db):
        cursor = db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @app.get("/api/v1/memory")
    def list_memories(db: Db):
        rows = db.execute("SELECT * FROM memories ORDER BY created_at DESC").fetchall()
        return [dict(row) for row in rows]

    @app.post("/api/v1/memory", status_code=status.HTTP_201_CREATED)
    def create_memory(memory: MemoryCreate, db: Db):
        memory_id = str(uuid.uuid4())
        created_at = now_iso()
        db.execute(
            "INSERT INTO memories (id, content, category, created_at) VALUES (?, ?, ?, ?)",
            (memory_id, memory.content, memory.category, created_at),
        )
        db.commit()
        return {"id": memory_id, "content": memory.content, "category": memory.category, "created_at": created_at}

    @app.delete("/api/v1/memory/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_memory(memory_id: str, db: Db):
        cursor = db.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Memory not found")
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @app.get("/api/v1/automations")
    def list_automations(db: Db):
        rows = db.execute("SELECT * FROM automations ORDER BY created_at DESC").fetchall()
        return [{**dict(row), "actions": json.loads(row["actions_json"])} for row in rows]

    @app.post("/api/v1/automations", status_code=status.HTTP_201_CREATED)
    def create_automation(automation: AutomationCreate, db: Db):
        automation_id = str(uuid.uuid4())
        created_at = now_iso()
        db.execute(
            "INSERT INTO automations (id, name, trigger_text, actions_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (automation_id, automation.name, automation.trigger, json.dumps(automation.actions), created_at),
        )
        db.commit()
        return {
            "id": automation_id,
            "name": automation.name,
            "trigger_text": automation.trigger,
            "actions": automation.actions,
            "enabled": False,
            "created_at": created_at,
        }

    @app.post("/api/v1/automations/{automation_id}/run")
    def run_automation(automation_id: str, request: AutomationRunRequest, db: Db):
        automation = db.execute("SELECT id FROM automations WHERE id = ?", (automation_id,)).fetchone()
        if automation is None:
            raise HTTPException(status_code=404, detail="Automation not found")
        if not request.confirmed:
            raise HTTPException(
                status_code=409,
                detail={"code": "confirmation_required", "message": "Review and confirm this run first."},
            )
        run_id = str(uuid.uuid4())
        created_at = now_iso()
        db.execute(
            "INSERT INTO automation_runs (id, automation_id, outcome, created_at) VALUES (?, ?, ?, ?)",
            (run_id, automation_id, "simulation_only", created_at),
        )
        db.execute(
            "INSERT INTO audit_logs (id, event, detail, created_at) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), "automation_run_simulated", automation_id, created_at),
        )
        db.commit()
        return {
            "run_id": run_id,
            "status": "simulation_only",
            "message": "Recorded for review; no system actions were executed.",
            "created_at": created_at,
        }

    return app


app = create_app()