import os
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from pydantic import BaseModel

import models
import database
from database import engine, get_db
import ai_categorize

#create database tables if they dont exist (tickets.db)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Internal Ticketing Tool")

class TicketCreate(BaseModel):
    title: str
    description: str
    department: str  # Can be "IT", "HR", "Finance", "Admin", or "Auto-Assign"
    urgency: str

class TicketResponse(BaseModel):
    id: int
    title: str
    description: str
    department: str
    urgency: str
    status: str
    agent_note: str | None = None
    is_ai_routed: bool
    ai_routing_correct: bool | None = None
    
    class Config:
        from_attributes = True

class TicketUpdate(BaseModel):
    status: str
    agent_note: str | None = None
    ai_routing_correct: bool | None = None

class DraftRequest(BaseModel):
    description: str

class DeflectRequest(BaseModel):
    description: str

#routes

@app.post("/api/tickets", response_model=TicketResponse)
def create_ticket(ticket_data: TicketCreate, db: Session = Depends(get_db)):
    
    #endpoint that receives a new ticket submission from the frontend form.
    
    chosen_dept = ticket_data.department
    
    is_auto = False
    if chosen_dept == "Auto-Assign" or not chosen_dept:
       #pass to llama
        chosen_dept = ai_categorize.categorize_ticket(ticket_data.description)
        is_auto = True
        
    new_ticket = models.Ticket(
        title=ticket_data.title,
        description=ticket_data.description,
        department=chosen_dept,
        urgency=ticket_data.urgency,
        status="Open",
        is_ai_routed=is_auto
    )
    
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    return new_ticket

@app.get("/api/tickets", response_model=List[TicketResponse])
def get_tickets(department: str = Query(None), db: Session = Depends(get_db)):

    #Endpoint for the agent dashboard. Dynamically filters tickets 
    
    query = db.query(models.Ticket)
    
    if department:
        query = query.filter(models.Ticket.department == department)
        
    return query.order_by(models.Ticket.id.desc()).all()

@app.put("/api/tickets/{ticket_id}", response_model=TicketResponse)
def update_ticket(ticket_id: int, ticket_data: TicketUpdate, db: Session = Depends(get_db)):
    db_ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    db_ticket.status = ticket_data.status
    if ticket_data.agent_note is not None:
        db_ticket.agent_note = ticket_data.agent_note
    if ticket_data.ai_routing_correct is not None:
        db_ticket.ai_routing_correct = ticket_data.ai_routing_correct
        
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

@app.get("/api/analytics")
def get_analytics(db: Session = Depends(get_db)):
    total_tickets = db.query(models.Ticket).count()
    status_counts = db.query(models.Ticket.status, func.count(models.Ticket.id)).group_by(models.Ticket.status).all()
    dept_counts = db.query(models.Ticket.department, func.count(models.Ticket.id)).group_by(models.Ticket.department).all()
    urgency_counts = db.query(models.Ticket.urgency, func.count(models.Ticket.id)).group_by(models.Ticket.urgency).all()
    
    # AI correctness
    ai_routed_tickets = db.query(models.Ticket).filter(models.Ticket.is_ai_routed == True).all()
    total_ai_routed = len(ai_routed_tickets)
    correct_ai_routed = sum(1 for t in ai_routed_tickets if t.ai_routing_correct is True)
    incorrect_ai_routed = sum(1 for t in ai_routed_tickets if t.ai_routing_correct is False)
    pending_ai_routed = total_ai_routed - correct_ai_routed - incorrect_ai_routed
    
    return {
        "total": total_tickets,
        "by_status": {k: v for k, v in status_counts},
        "by_department": {k: v for k, v in dept_counts},
        "by_urgency": {k: v for k, v in urgency_counts},
        "ai_accuracy": {
            "total_routed": total_ai_routed,
            "correct": correct_ai_routed,
            "incorrect": incorrect_ai_routed,
            "pending_review": pending_ai_routed
        }
    }

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def redirect_to_login():
    """Redirects the base URL root directly to our login selector landing page."""
    return RedirectResponse(url="/static/index.html")\
    
@app.on_event("startup")
def on_startup():
    #seeds vector database with synthetic tickets
    ai_categorize.seed_historical_tickets()

@app.post("/api/tickets/draft")
def get_ticket_draft(payload: DraftRequest):
    #generates draft response
    if not payload.description:
        raise HTTPException(status_code=400, detail="Description text is required.")
    
    suggested_draft = ai_categorize.generate_auto_draft(payload.description)
    
    return {"draft": suggested_draft}

@app.get("/api/tickets/{ticket_id}", response_model=TicketResponse)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    """Fetch a single ticket by ID for employee portal."""
    db_ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return db_ticket

@app.post("/api/tickets/deflect")
def deflect_ticket(payload: DeflectRequest):
    """Check if ticket description matches any resolved historical tickets."""
    if not payload.description:
        raise HTTPException(status_code=400, detail="Description required")
    
    suggestions = ai_categorize.check_deflection(payload.description)
    return {"suggestions": suggestions}