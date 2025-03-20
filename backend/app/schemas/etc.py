from pydantic import BaseModel
from typing import List, Optional, Union
from fastapi.responses import StreamingResponse


class ETCData(BaseModel):
    card_number: str
    usage_month: str
    usage_date: str
    vehicle_type: str
    vehicle_number: str
    entry_ic: str
    exit_ic: str
    original_fee: str
    final_fee: str


class ETCResponse(BaseModel):
    markdown: Optional[str] = None
    error: Optional[str] = None


# レスポンスの型を定義（StreamingResponseは除外）
ETCResponseType = ETCResponse
