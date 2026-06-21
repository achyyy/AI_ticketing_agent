import os
from groq import Groq
from dotenv import load_dotenv
import chromadb
from pydantic import BaseModel

load_dotenv()

#initialize groq
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

#initialize chromadb
chroma_client = chromadb.PersistentClient(path="./chroma_data")

#vector collection of the tickets for future retreival and context
collection = chroma_client.get_or_create_collection(name="resolved_tickets")

#classify a ticket based on its description into IT, hr, finance and admin.
def categorize_ticket(description: str) -> str:
    system_prompt = ("You are an automated internal routing assistant for a corporate ticketing system.\n"
        "Your sole job is to analyze the user's issue and classify it into exactly ONE of these four departments:\n"
        "- IT (For hardware, software, passwords, network, access, accounts)\n"
        "- HR (For payroll, leaves, insurance, onboarding, policy queries)\n"
        "- Finance (For expense reports, invoices, reimbursements, tax forms)\n"
        "- Admin (For office supplies, desk allocation, ID cards, building maintenance)\n\n"
        "CRITICAL RULE: Reply with ONLY the category name (IT, HR, Finance, or Admin). "
        "Do not include any explanation, introductory text, markdown formatting, or punctuation."
    )

    try:
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Ticket Description: {description}"}
            ],
            temperature=0.0,
            max_tokens=10
        )
        category = completion.choices[0].message.content.strip()
        
        valid_categories = ["IT", "HR", "Finance", "Admin"]
        if category in valid_categories:
            return category
        else:
            # if llm goes rogue and returns something else, default to IT 
            return "IT"
            
    except Exception as e:
        print(f"AI Categorization Error: {e}")
        return "IT"

def seed_historical_tickets():
    """
    Seeds the vector database with historical, resolved tickets on application boot.
    This guarantees the RAG system has a knowledge base to query against.
    """
    if collection.count() == 0:
        print("Vector database is empty. Inserting some previously resolved records...")
        
        # Sample resolved ticket data
        historical_tickets = [
            {
                "id": "hist_1",
                "text": "My office VPN keeps disconnecting every 10 minutes when working from home.",
                "resolution": "Update Cisco AnyConnect client to v4.10, clear local profile caches, and flush DNS settings."
            },
            {
                "id": "hist_2",
                "text": "Where do I submit my medical insurance tax declaration forms?",
                "resolution": "Upload all tax exemption proofs directly to the BambooHR portal under the 'My Documents' -> 'Tax declarations' submenu."
            },
            {
                "id": "hist_3",
                "text": "I lost my physical corporate building entry ID badge.",
                "resolution": "Report to the ground floor reception security desk. Fill out Form 102B, pay a Rs 200 processing fee, and a new RFID card will be printed in 15 minutes."
            },
            {
                "id": "hist_4",
                "text": "How do I claim reimbursement for client business dinner lunches?",
                "resolution": "Log into the Expensify dashboard, create a new monthly report, attach itemized restaurant receipts, and select the 'Client Entertainment' cost code."
            }
        ]

        collection.add(
            documents=[ticket["text"] for ticket in historical_tickets],
            metadatas=[{"resolution": ticket["resolution"]} for ticket in historical_tickets],
            ids=[ticket["id"] for ticket in historical_tickets]
        )
        print("Vector store successfully seeded.")

def generate_auto_draft(current_issue: str) -> str:
    """
    RAG Implementation:
    1. Embeds the current ticket text.
    2. Queries ChromaDB for the most semantically similar historical ticket.
    3. Feeds the current issue and historical resolution into Llama 3 to draft a reply.
    """
    try:
        search_results = collection.query(
            query_texts=[current_issue],
            n_results=1 # Fetch the top 1 closest matching resolved ticket
        )
        
        # Fallback
        past_issue = "No exact historical match found."
        past_resolution = "Review system dependencies and respond following generic internal triage workflows."
        
        if search_results["documents"] and len(search_results["documents"][0]) > 0:
            past_issue = search_results["documents"][0][0]
            past_resolution = search_results["metadatas"][0][0]["resolution"]

        # RAG Context Prompt
        system_prompt = (
            "You are an expert corporate support agent assistant. Your job is to draft a polite, "
            "helpful first response to an employee's issue based on how a similar past issue was resolved.\n\n"
            f"HISTORICAL CONTEXT FOR REFERENCE:\n"
            f"- Past Similar Issue: {past_issue}\n"
            f"- How It Was Resolved: {past_resolution}\n\n"
            "CRITICAL RULES:\n"
            "1. Use the historical context to draft the response if it matches the user's issue.\n"
            "2. Be concise, professional, and empathetic.\n"
            "3. Do not include placeholders like '[Agent Name]'. End with 'Best regards, Corporate Support Team'.\n"
            "4. Output ONLY the raw response body. Do not include conversational preambles or notes."
        )

        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"New Incoming Ticket Issue: {current_issue}"}
            ],
            temperature=0.3,
            max_tokens=250
        )
        
        return completion.choices[0].message.content.strip()

    except Exception as e:
        print(f"Auto-Draft Generation Failure: {e}")
        return "Hello, thank you for reaching out. We have received your request and our internal engineering teams are actively investigating the issue. We will update you shortly."

def check_deflection(description: str, threshold: float = 1.0):
    """
    Queries ChromaDB for semantically similar past tickets.
    Returns match only if vector distance is extremely close (high confidence).
    """
    results = collection.query(
        query_texts=[description],
        n_results=1
    )
    
    if results["distances"] and len(results["distances"][0]) > 0:
        best_distance = results["distances"][0][0]
        
        # If distance < threshold, high confidence match found
        if best_distance < threshold:
            matched_issue = results["documents"][0][0]
            matched_resolution = results["metadatas"][0][0]["resolution"]
            
            return {
                "matched": True,
                "past_issue": matched_issue,
                "resolution": matched_resolution,
                "distance": round(best_distance, 3)
            }
    
    return {"matched": False}
