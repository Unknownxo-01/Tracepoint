import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.db.database import get_db_connection
from app.schemas.trace_schemas import (
    AIExplanation,
    ComparisonResult,
    InvestigationRecord,
    TraceEvent,
    TraceMetadata,
)


class Repository:
    @staticmethod
    def save_trace(trace_id: str, events: List[TraceEvent], metadata: TraceMetadata):
        conn = get_db_connection()
        cursor = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            """
            INSERT OR REPLACE INTO traces (id, agent_name, run_id, metadata_json, events_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                trace_id,
                metadata.agent_name,
                metadata.run_id,
                json.dumps(metadata.model_dump()),
                json.dumps([e.model_dump() for e in events]),
                now,
            ),
        )
        conn.commit()
        conn.close()

    @staticmethod
    def get_trace_metadata(trace_id: str) -> Optional[TraceMetadata]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT metadata_json FROM traces WHERE id = ?", (trace_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        return TraceMetadata(**json.loads(row["metadata_json"]))

    @staticmethod
    def get_trace_events(trace_id: str) -> Optional[List[TraceEvent]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT events_json FROM traces WHERE id = ?", (trace_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        data = json.loads(row["events_json"])
        return [TraceEvent(**item) for item in data]

    @staticmethod
    def list_traces() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, agent_name, run_id, metadata_json, created_at FROM traces ORDER BY created_at DESC")
        rows = cursor.fetchall()
        conn.close()
        result = []
        for r in rows:
            meta = json.loads(r["metadata_json"]) if r["metadata_json"] else {}
            result.append(
                {
                    "id": r["id"],
                    "agent_name": r["agent_name"],
                    "run_id": r["run_id"],
                    "event_count": meta.get("event_count", 0),
                    "error_count": meta.get("error_count", 0),
                    "status_summary": meta.get("status_summary", "UNKNOWN"),
                    "created_at": r["created_at"],
                }
            )
        return result

    @staticmethod
    def create_investigation(
        inv_id: str,
        name: str,
        description: Optional[str] = None,
        trace_a_id: Optional[str] = None,
        trace_b_id: Optional[str] = None,
        comparison_id: Optional[str] = None,
    ) -> InvestigationRecord:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            """
            INSERT INTO investigations (id, name, description, trace_a_id, trace_b_id, comparison_id, created_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (inv_id, name, description, trace_a_id, trace_b_id, comparison_id, now, "active"),
        )
        conn.commit()
        conn.close()
        return InvestigationRecord(
            id=inv_id,
            name=name,
            description=description,
            created_at=now,
            trace_a_id=trace_a_id,
            trace_b_id=trace_b_id,
            comparison_id=comparison_id,
            status="active",
        )

    @staticmethod
    def list_investigations() -> List[InvestigationRecord]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM investigations ORDER BY created_at DESC")
        rows = cursor.fetchall()
        conn.close()
        return [
            InvestigationRecord(
                id=r["id"],
                name=r["name"],
                description=r["description"],
                created_at=r["created_at"],
                trace_a_id=r["trace_a_id"],
                trace_b_id=r["trace_b_id"],
                comparison_id=r["comparison_id"],
                status=r["status"],
            )
            for r in rows
        ]

    @staticmethod
    def get_investigation(inv_id: str) -> Optional[InvestigationRecord]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM investigations WHERE id = ?", (inv_id,))
        r = cursor.fetchone()
        conn.close()
        if not r:
            return None
        return InvestigationRecord(
            id=r["id"],
            name=r["name"],
            description=r["description"],
            created_at=r["created_at"],
            trace_a_id=r["trace_a_id"],
            trace_b_id=r["trace_b_id"],
            comparison_id=r["comparison_id"],
            status=r["status"],
        )

    @staticmethod
    def update_investigation_comparison(inv_id: str, comparison_id: str, trace_a_id: str, trace_b_id: str):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE investigations
            SET comparison_id = ?, trace_a_id = ?, trace_b_id = ?
            WHERE id = ?
            """,
            (comparison_id, trace_a_id, trace_b_id, inv_id),
        )
        conn.commit()
        conn.close()

    @staticmethod
    def save_comparison(comparison: ComparisonResult):
        conn = get_db_connection()
        cursor = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            """
            INSERT OR REPLACE INTO comparisons (id, trace_a_id, trace_b_id, result_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                comparison.comparison_id,
                comparison.trace_a_id,
                comparison.trace_b_id,
                json.dumps(comparison.model_dump()),
                now,
            ),
        )
        conn.commit()
        conn.close()

    @staticmethod
    def get_comparison(cmp_id: str) -> Optional[ComparisonResult]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT result_json FROM comparisons WHERE id = ?", (cmp_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        return ComparisonResult(**json.loads(row["result_json"]))

    @staticmethod
    def save_explanation(inv_id: str, explanation: AIExplanation):
        conn = get_db_connection()
        cursor = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            """
            INSERT OR REPLACE INTO explanations (investigation_id, result_json, created_at)
            VALUES (?, ?, ?)
            """,
            (inv_id, json.dumps(explanation.model_dump()), now),
        )
        conn.commit()
        conn.close()

    @staticmethod
    def get_explanation(inv_id: str) -> Optional[AIExplanation]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT result_json FROM explanations WHERE investigation_id = ?", (inv_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        return AIExplanation(**json.loads(row["result_json"]))
