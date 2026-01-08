from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router as api_router
from app.api.graph import router as graph_router

app = FastAPI(
    title="Property Viewer API",
    description="API for viewing and managing properties with spatial data",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Health check endpoint for container orchestration."""
    return {"status": "healthy"}


@app.get("/")
def root():
    """Root endpoint with API information."""
    return {
        "name": "Property Viewer API",
        "version": "0.1.0",
        "docs": "/docs",
    }


# Include API routes
app.include_router(api_router)
app.include_router(graph_router)
