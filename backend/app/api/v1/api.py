from fastapi import APIRouter
from app.api.v1.endpoints import etc

api_router = APIRouter()
api_router.include_router(etc.router, prefix="/etc", tags=["etc"])
