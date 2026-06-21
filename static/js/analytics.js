document.addEventListener("DOMContentLoaded", async () => {
    const loadingIndicator = document.getElementById("loadingIndicator");
    const analyticsContent = document.getElementById("analyticsContent");

    const statTotal = document.getElementById("statTotal");
    const statAiAccuracy = document.getElementById("statAiAccuracy");

    try {
        const response = await fetch("/api/analytics");
        const data = await response.json();

        statTotal.innerText = data.total;

        let totalAiEvaluated = data.ai_accuracy.correct + data.ai_accuracy.incorrect;
        let accuracyPercent = totalAiEvaluated > 0 
            ? Math.round((data.ai_accuracy.correct / totalAiEvaluated) * 100) 
            : 0;
        
        statAiAccuracy.innerText = totalAiEvaluated > 0 ? `${accuracyPercent}%` : "N/A";

        // Setup common chart styling
        const nudgeColors = {
            brown: '#603B2A',
            dark: '#2C1A12',
            beige: '#D6C2A9',
            btn: '#7A4F3A',
            lightBrown: '#8C6A53',
            danger: '#b91c1c',
            success: '#15803d'
        };

        // 1. Department Chart (Bar)
        const deptCtx = document.getElementById('deptChart').getContext('2d');
        new Chart(deptCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(data.by_department),
                datasets: [{
                    label: 'Tickets',
                    data: Object.values(data.by_department),
                    backgroundColor: nudgeColors.brown,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        // 2. Status Chart (Doughnut)
        const statusCtx = document.getElementById('statusChart').getContext('2d');
        new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(data.by_status),
                datasets: [{
                    data: Object.values(data.by_status),
                    backgroundColor: [nudgeColors.beige, nudgeColors.btn, nudgeColors.dark, nudgeColors.brown]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        // 3. Urgency Chart (Pie)
        const urgencyCtx = document.getElementById('urgencyChart').getContext('2d');
        new Chart(urgencyCtx, {
            type: 'pie',
            data: {
                labels: Object.keys(data.by_urgency),
                datasets: [{
                    data: Object.values(data.by_urgency),
                    backgroundColor: [nudgeColors.beige, nudgeColors.lightBrown, nudgeColors.btn, nudgeColors.danger]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        // 4. AI Accuracy Chart (Doughnut)
        const aiCtx = document.getElementById('aiAccuracyChart').getContext('2d');
        new Chart(aiCtx, {
            type: 'doughnut',
            data: {
                labels: ['Correctly Routed', 'Incorrectly Routed', 'Pending Agent Review'],
                datasets: [{
                    data: [data.ai_accuracy.correct, data.ai_accuracy.incorrect, data.ai_accuracy.pending_review],
                    backgroundColor: [nudgeColors.success, nudgeColors.danger, nudgeColors.beige]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        loadingIndicator.classList.add("hidden");
        analyticsContent.classList.remove("hidden");

    } catch (error) {
        console.error("Error loading analytics:", error);
        loadingIndicator.innerHTML = `<p style="color: red;">Error loading analytics data.</p>`;
    }
});
