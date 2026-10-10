import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router, seed_samples
from app.db.database import init_db
from app.db.repository import Repository

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("tracepoint")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema
    logger.info("Initializing TRACEPOINT SQLite database...")
    init_db()

    # Automatically seed sample traces if none exist
    traces = Repository.list_traces()
    if not traces:
        logger.info("No traces detected. Seeding built-in sample traces...")
        try:
            seed_samples()
            logger.info("Sample traces and demo investigation successfully initialized.")
        except Exception as e:
            logger.error(f"Failed to auto-seed samples: {e}")

    yield
    logger.info("TRACEPOINT engine shutting down.")


app = FastAPI(
    title="TRACEPOINT Engine API",
    description="AI-Assisted Agent Black Box: Replay & Failure Investigation Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits local Vite frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "platform": "TRACEPOINT",
        "description": "AI-Assisted Agent Black Box Replay & Failure Investigation Platform",
        "tagline": "Find the First Divergence. Understand the Failure. Fix It with Evidence.",
        "api_docs": "/docs",
        "health": "/api/health",
    }
