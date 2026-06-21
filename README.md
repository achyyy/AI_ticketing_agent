# Internal Ticketing System

## Overview
This application is a comprehensive web based internal ticketing tool designed to help employees efficiently raise support tickets for various departments including IT, HR, Finance, and Admin. It provides a complete lifecycle for tracking issues from submission to resolution, ensuring a streamlined and transparent support process for the entire organization.

## Core Features

### Employee Interface
* Employees can raise tickets by providing a title, detailed description, category, and urgency level.
* Employees can track the progress of their requests and see when the status updates to Open, In Progress, Resolved, or Closed.
* A notification system alerts the employee when there is a status change or resolution note added by an agent.

### Agent Workflow
* Dedicated queues for each department allow agents to easily manage relevant tickets.
* Agents can update ticket statuses, review the issue context, and leave resolution notes for the employee.

### AI Integration
* Automated Ticket Categorization: If an employee is unsure where to send a request, the AI engine analyzes the description and automatically routes the ticket to the correct department.
* Smart Ticket Deflection: The system attempts to surface similar, previously resolved tickets before a new submission to reduce duplicate requests and provide instant solutions.
* Agent Response Generation: The AI automatically drafts a suggested first response for agents based on the ticket description.

### Built In Analytics
* An interactive reporting dashboard provides a global overview of ticket metrics.
* Visual breakdowns of ticket statuses, urgency levels, and department loads.
* Real time tracking of AI routing accuracy to ensure the model remains reliable.

## Architecture
* Backend built with FastAPI.
* Data persistence using SQLite with SQLAlchemy.
* Frontend created using clean HTML, CSS, and vanilla JavaScript.
* Analytics charts powered by Chart.js.

## Getting Started
1. Ensure Python is installed on your system.
2. Install the required dependencies using pip:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the main server application using Uvicorn:
   ```bash
   uvicorn main:app --reload
   ```
4. Open your web browser and navigate to `http://localhost:8000` to access the application.
