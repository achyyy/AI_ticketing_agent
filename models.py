from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from datetime import datetime, timezone
from database import Base

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    department = Column(String, index=True)
    urgency = Column(String)
    status = Column(String, default="open", index=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    agent_note = Column(Text, nullable=True)
    is_ai_routed = Column(Boolean, default=False)
    ai_routing_correct = Column(Boolean, nullable=True)