# app.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json

app = FastAPI()

class RangeReq(BaseModel):
  start: Optional[str] = None  
  end: Optional[str] = None

@app.post("/api/traffic_source/range")
def traffic_source_range(req: RangeReq):
  try:
    # TODO: 

    data = [
      {"id":"YouTube Search","label":"YouTube Search","views":1200,"estimatedMinutesWatched":3400,"averageViewDuration":170,"averageViewPercentage":31.2,"engagedViews":900},
      {"id":"Suggested Videos","label":"Suggested Videos","views":900,"estimatedMinutesWatched":2200,"averageViewDuration":146,"averageViewPercentage":28.4,"engagedViews":640},
    ]
    return data
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
