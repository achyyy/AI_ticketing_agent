document.addEventListener("DOMContentLoaded", () => {
    // 1. Parse URL Query Parameters to discover the active department identity
    const urlParams = new URLSearchParams(window.location.search);
    const currentDept = urlParams.get("department") || "IT"; // Fallback to IT if empty

    // 2. Select and capture DOM structural layout elements
    const dashboardTitle = document.getElementById("dashboardTitle");
    const ticketQueueList = document.getElementById("ticketQueueList");
    const detailPanel = document.getElementById("detailPanel");
    const detailPlaceholder = document.getElementById("detailPlaceholder");
    const detailContent = document.getElementById("detailContent");
    
    // Captured detail data slots
    const detailId = document.getElementById("detailId");
    const detailUrgency = document.getElementById("detailUrgency");
    const detailStatus = document.getElementById("detailStatus");
    const detailTitle = document.getElementById("detailTitle");
    const detailDescription = document.getElementById("detailDescription");
    
    // Analytics HUD counters
    const statTotal = document.getElementById("statTotal");
    const statOpen = document.getElementById("statOpen");


    // Global in-memory data store cache to track records without re-querying the network
    let globalTicketsList = [];
    let selectedTicketId = null;

    // 3. Initialize Workspace Context Configuration
    dashboardTitle.innerText = `${currentDept} Operations Dashboard`;

    // 4. Fetch Core Queue Data Function
    async function fetchDepartmentQueue() {
        try {
            // Request the filtered API dataset using our dynamic URL query text parameter
            const response = await fetch(`/api/tickets?department=${currentDept}`);
            if (!response.ok) throw new Error("Failed to load queue data records.");
            
            globalTicketsList = await response.json();
            
            // Re-render interfaces and recalculate analytics scorecards
            renderQueueSidebar(globalTicketsList);
            calculateDashboardMetrics(globalTicketsList);
            
        } catch (error) {
            console.error("Queue loading error:", error);
            ticketQueueList.innerHTML = `<p class="error-text">⚠️ Error loading records: ${error.message}</p>`;
        }
    }

    // 5. Render Sidebar Ticket Cards List
    function renderQueueSidebar(tickets) {
        if (tickets.length === 0) {
            ticketQueueList.innerHTML = `<p class="empty-text">No active tickets inside this queue.</p>`;
            return;
        }

        // Wipe the loader string template clear before appending items
        ticketQueueList.innerHTML = "";

        tickets.forEach(ticket => {
            const card = document.createElement("div");
            card.className = `ticket-card ${selectedTicketId === ticket.id ? 'active' : ''}`;
            
            // Build the interior text card markup tracking string
            card.innerHTML = `
                <h4>${escapeHTML(ticket.title)}</h4>
                <div class="card-meta">
                    <span>#${ticket.id}</span>
                    <span class="badge-mini">${ticket.urgency}</span>
                </div>
            `;

            // Bind click event listener right to the dynamic element card
            card.addEventListener("click", () => {
                selectedTicketId = ticket.id;
                
                // Toggle active highlighting styling across card siblings
                document.querySelectorAll(".ticket-card").forEach(c => c.classList.remove("active"));
                card.classList.add("active");
                
                showTicketDetail(ticket);
            });

            ticketQueueList.appendChild(card);
        });
    }

    // 6. Populate Right Panel Detailed Info View
    function showTicketDetail(ticket) {
        // Swap workspace hidden states to bring up details panel
        detailPlaceholder.classList.add("hidden");
        detailPanel.classList.remove("empty-state");
        detailContent.classList.remove("hidden");

        // Inject the textual records context fields inside DOM positions safely
        detailId.innerText = `#${ticket.id}`;
        detailTitle.innerText = ticket.title;
        detailDescription.innerText = ticket.description;
        
        detailUrgency.innerText = ticket.urgency;
        detailUrgency.className = `badge dept-${currentDept.toLowerCase()}`;
        
        detailStatus.innerText = ticket.status;
        detailStatus.className = "badge";

        // Pre-fill the update form
        document.getElementById("updateStatus").value = ticket.status;
        document.getElementById("agentNotesTextarea").value = ticket.agent_note || "";
        
        const aiCorrectnessGroup = document.getElementById("aiCorrectnessGroup");
        const aiRoutingCorrect = document.getElementById("aiRoutingCorrect");
        
        if (ticket.is_ai_routed) {
            aiCorrectnessGroup.classList.remove("hidden");
            aiRoutingCorrect.checked = ticket.ai_routing_correct === true;
        } else {
            aiCorrectnessGroup.classList.add("hidden");
            aiRoutingCorrect.checked = false;
        }

    }

    // 7. Calculate Analytics Scorecard Summaries
    function calculateDashboardMetrics(tickets) {
        const total = tickets.length;
        const openCount = tickets.filter(t => t.status === "Open" || t.status === "In Progress").length;

        statTotal.innerText = total;
        statOpen.innerText = openCount;
    }

    // XSS Anti-Injection Helper Method to safely display user inputs
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // Kick off the queue fetch sequence on page execution
    fetchDepartmentQueue();

    const btnSaveResolution = document.getElementById("btnSaveResolution");
    const saveStatusMessage = document.getElementById("saveStatusMessage");

    btnSaveResolution.addEventListener("click", async () => {
        if (!selectedTicketId) return;

        const updatedStatus = document.getElementById("updateStatus").value;
        const agentNote = document.getElementById("agentNotesTextarea").value;
        
        const ticket = globalTicketsList.find(t => t.id === selectedTicketId);
        let aiRoutingCorrect = null;
        if (ticket && ticket.is_ai_routed) {
            aiRoutingCorrect = document.getElementById("aiRoutingCorrect").checked;
        }

        btnSaveResolution.disabled = true;
        saveStatusMessage.classList.remove("hidden");
        saveStatusMessage.innerText = "Saving...";
        saveStatusMessage.style.color = "blue";

        try {
            const payload = { status: updatedStatus, agent_note: agentNote };
            if (aiRoutingCorrect !== null) {
                payload.ai_routing_correct = aiRoutingCorrect;
            }
            const response = await fetch(`/api/tickets/${selectedTicketId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Failed to save ticket resolution.");
            
            const updatedTicket = await response.json();

            // Update in-memory store
            const ticketIndex = globalTicketsList.findIndex(t => t.id === selectedTicketId);
            if (ticketIndex !== -1) {
                globalTicketsList[ticketIndex] = updatedTicket;
            }

            // Re-render UI elements
            saveStatusMessage.innerText = "Saved successfully!";
            saveStatusMessage.style.color = "green";
            
            // Update labels
            document.getElementById("detailStatus").innerText = updatedTicket.status;
            
            renderQueueSidebar(globalTicketsList);
            calculateDashboardMetrics(globalTicketsList);

            setTimeout(() => {
                saveStatusMessage.classList.add("hidden");
            }, 3000);

        } catch (error) {
            console.error("Save Error:", error);
            saveStatusMessage.innerText = `⚠️ Error: ${error.message}`;
            saveStatusMessage.style.color = "red";
        } finally {
            btnSaveResolution.disabled = false;
        }
    });
});
