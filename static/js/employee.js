// 1. Wait until the browser window fully loads the DOM elements
document.addEventListener("DOMContentLoaded", () => {
    const ticketForm = document.getElementById("ticketForm");
    const loadingIndicator = document.getElementById("loadingIndicator");
    const responseMessage = document.getElementById("responseMessage");
    const submitBtn = document.getElementById("submitBtn");
    const deflectBtn = document.getElementById("deflectBtn");
    const deflectionBox = document.getElementById("deflectionBox");
    const recentTicketsList = document.getElementById("recentTicketsList");
    const dashboardNotification = document.getElementById("dashboardNotification");

    // Modal elements
    const ticketModal = document.getElementById("ticketModal");
    const closeModalBtn = document.getElementById("closeModalBtn");
    const modalId = document.getElementById("modalId");
    const modalUrgency = document.getElementById("modalUrgency");
    const modalStatus = document.getElementById("modalStatus");
    const modalTitle = document.getElementById("modalTitle");
    const modalDescription = document.getElementById("modalDescription");
    const modalAgentNote = document.getElementById("modalAgentNote");
    const modalAgentNoteText = document.getElementById("modalAgentNoteText");

    // Close Modal Logic
    closeModalBtn.addEventListener("click", () => {
        ticketModal.classList.add("hidden");
    });
    window.addEventListener("click", (e) => {
        if (e.target === ticketModal) {
            ticketModal.classList.add("hidden");
        }
    });

    // Phase 3: AI Ticket Deflection
    deflectBtn.addEventListener("click", async () => {
        const description = document.getElementById("description").value.trim();

        if (!description) {
            deflectionBox.className = "alert-box alert-error";
            deflectionBox.innerHTML = "Please enter a description first.";
            deflectionBox.classList.remove("hidden");
            return;
        }

        deflectionBox.className = "alert-box";
        deflectionBox.innerHTML = "Checking for instant solutions...";
        deflectionBox.classList.remove("hidden");

        try {
            // POST to /api/tickets/deflect
            const response = await fetch("/api/tickets/deflect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description })
            });

            const data = await response.json();

            // If matched suggestion found:
            if (data.suggestions && data.suggestions.matched) {
                deflectionBox.className = "alert-box alert-success";
                deflectionBox.innerHTML = `
                    <h3 style="margin-bottom: 5px;">Wait! Is this your issue?</h3>
                    <p><strong>Past Issue:</strong> ${data.suggestions.past_issue}</p>
                    <p><strong>Solution:</strong> ${data.suggestions.resolution}</p>
                    <p style="margin-top: 10px;">If this solves your problem, you can skip submitting!</p>
                `;
            } else {
                deflectionBox.className = "alert-box";
                deflectionBox.innerHTML = "No instant solution found. Please submit your ticket.";
            }
        } catch (error) {
            console.error("Deflection error:", error);
            deflectionBox.className = "alert-box alert-error";
            deflectionBox.innerHTML = "Error checking for instant solutions.";
        }
    });

    // 2. Intercept the standard HTML form submission event
    ticketForm.addEventListener("submit", async (event) => {
        // Prevent the page from automatically refreshing
        event.preventDefault();

        // 3. Extract data values directly out of the form fields
        const title = document.getElementById("title").value.trim();
        const description = document.getElementById("description").value.trim();
        const department = document.getElementById("department").value;
        const urgency = document.getElementById("urgency").value;

        // 4. Update UI states to indicate loading
        // Hide old messages, show the AI loading spinner, disable the submit button
        responseMessage.classList.add("hidden");
        deflectionBox.classList.add("hidden");
        loadingIndicator.classList.remove("hidden");
        submitBtn.disabled = true;
        submitBtn.innerText = "Processing...";

        // 5. Package the data into a structured object matching our backend Pydantic schema
        const payload = {
            title: title,
            description: description,
            department: department,
            urgency: urgency
        };

        try {
            // 6. Execute the network API request
            const response = await fetch("/api/tickets", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Failed to submit ticket.");
            }

            // 7. Success State
            responseMessage.className = "alert-box alert-success";
            if (department === "Auto-Assign") {
                responseMessage.innerHTML = `<strong>Success!</strong> Ticket created and automatically routed to the <strong>${data.department}</strong> department by AI (Ticket ID: #${data.id}).`;
            } else {
                responseMessage.innerHTML = `<strong>Success!</strong> Ticket created and successfully routed to the <strong>${data.department}</strong> department (Ticket ID: #${data.id}).`;
            }
            responseMessage.classList.remove("hidden");

            // Phase 2: Save ticket locally
            saveTicketLocally(data.id);
            loadRecentTickets();

            // Clear out the form inputs
            ticketForm.reset();

        } catch (error) {
            // 8. Error State
            console.error("Submission error:", error);
            responseMessage.className = "alert-box alert-error";
            responseMessage.innerHTML = `<strong>Error:</strong> ${error.message}`;
            responseMessage.classList.remove("hidden");

        } finally {
            // 9. Revert UI loading indicators back to normal states
            loadingIndicator.classList.add("hidden");
            submitBtn.disabled = false;
            submitBtn.innerText = "Submit Ticket";
        }
    });

    // Phase 2: Browser Memory Tracking
    function saveTicketLocally(ticketId) {
        let myTickets = JSON.parse(localStorage.getItem("myTickets") || "[]");
        if (!myTickets.includes(ticketId)) {
            myTickets.push(ticketId);
            localStorage.setItem("myTickets", JSON.stringify(myTickets));
        }
    }

    async function loadRecentTickets() {
        let myTickets = JSON.parse(localStorage.getItem("myTickets") || "[]");
        if (myTickets.length === 0) {
            recentTicketsList.innerHTML = "<p class='empty-text' style='color: var(--gray-text);'>No recent tickets submitted.</p>";
            return;
        }

        recentTicketsList.innerHTML = "<p class='loading-text' style='color: var(--nudge-brown);'>Loading recent tickets...</p>";

        let hasResolvedTicket = false;
        let ticketsData = [];

        // Load in reverse chronological order
        for (let i = myTickets.length - 1; i >= 0; i--) {
            let ticketId = myTickets[i];
            try {
                const response = await fetch(`/api/tickets/${ticketId}`);
                if (response.ok) {
                    const ticket = await response.json();
                    ticketsData.push(ticket);
                    if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
                        hasResolvedTicket = true;
                    }
                }
            } catch (err) {
                console.error(`Failed to load ticket ${ticketId}`, err);
            }
        }

        // Show notification banner if there is a resolved ticket
        if (hasResolvedTicket) {
            dashboardNotification.className = "notification-banner";
            dashboardNotification.innerHTML = "You have a resolved ticket! Click on it to view the agent's remarks.";
            dashboardNotification.classList.remove("hidden");

            // Auto-hide the notification after 6 seconds
            setTimeout(() => {
                dashboardNotification.classList.add("hidden");
            }, 6000);
        } else {
            dashboardNotification.classList.add("hidden");
        }

        if (ticketsData.length === 0) {
            recentTicketsList.innerHTML = "<p class='empty-text' style='color: var(--gray-text);'>No recent tickets submitted.</p>";
        } else {
            recentTicketsList.innerHTML = "";
            ticketsData.forEach(ticket => {
                const card = document.createElement("div");
                card.className = "ticket-card";
                card.innerHTML = `
                    <h4>${escapeHTML(ticket.title)}</h4>
                    <div class="card-meta">
                        <span>#${ticket.id}</span>
                        <span class="badge ${ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'badge-success' : ''}">${ticket.status}</span>
                        <span class="badge dept-${ticket.department.toLowerCase()}">${ticket.department}</span>
                    </div>
                `;

                // Clicking opens the modal
                card.addEventListener("click", () => {
                    modalId.innerText = `#${ticket.id}`;
                    modalTitle.innerText = escapeHTML(ticket.title);
                    modalDescription.innerText = escapeHTML(ticket.description);
                    modalUrgency.innerText = ticket.urgency;
                    modalStatus.innerText = ticket.status;

                    if ((ticket.status === 'Resolved' || ticket.status === 'Closed') && ticket.agent_note) {
                        modalAgentNoteText.innerText = escapeHTML(ticket.agent_note);
                        modalAgentNote.classList.remove("hidden");
                    } else {
                        modalAgentNote.classList.add("hidden");
                    }

                    ticketModal.classList.remove("hidden");
                });

                recentTicketsList.appendChild(card);
            });
        }
    }

    function escapeHTML(str) {
        if (!str) return '';
        return str.toString().replace(/[&<>'"]/g,
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // Auto-load recent tickets on page load
    loadRecentTickets();
});