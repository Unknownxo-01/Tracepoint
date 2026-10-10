import os
import sqlite3
from typing import Generator

DB_PATH = os.environ.get("TRACEPOINT_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "..", "tracepoint.db"))


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS traces (
        id TEXT PRIMARY KEY,
        agent_name TEXT,
        run_id TEXT,
        metadata_json TEXT,
        events_json TEXT,
        created_at TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS investigations (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        trace_a_id TEXT,
        trace_b_id TEXT,
        comparison_id TEXT,
        created_at TEXT,
        status TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS comparisons (
        id TEXT PRIMARY KEY,
        trace_a_id TEXT,
        trace_b_id TEXT,
        result_json TEXT,
        created_at TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS explanations (
        investigation_id TEXT PRIMARY KEY,
        result_json TEXT,
        created_at TEXT
    );
    """)

    conn.commit()
    conn.close()
