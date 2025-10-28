// ⚙️ CONFIG - REPLACE THIS WITH YOUR DEPLOYED GOOGLE SCRIPT URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz1X_7YhdBDWJr4IZbAZNET1ls-epqUs0DgIk50nhdBup7QF_JbJy_7Sqz3JbYwMc9e/exec";

// ===============================
// LOAD DATA ON PAGE LOAD
// ===============================
window.addEventListener("DOMContentLoaded", () => {
  loadEmailLogs();
  loadStats();

  const form = document.getElementById("emailForm");
  form.addEventListener("submit", sendManualEmail);
});

// ===============================
// 📤 SEND MANUAL EMAIL
// ===============================
async function sendManualEmail(e) {
  e.preventDefault();

  const recipient = document.getElementById("recipient").value.trim();
  const subject = document.getElementById("subject").value.trim();
  const message = document.getElementById("message").value.trim();
  const statusEl = document.getElementById("statusMessage");

  statusEl.textContent = "Sending...";
  statusEl.style.color = "#666";

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: new URLSearchParams({
        action: "sendEmail",
        recipient,
        subject,
        message
      }),
    });

    const result = await response.json();

    if (result.success) {
      statusEl.textContent = result.message;
      statusEl.style.color = "green";
      document.getElementById("emailForm").reset();
      loadEmailLogs();
      loadStats();
    } else {
      statusEl.textContent = "❌ " + result.error;
      statusEl.style.color = "red";
    }
  } catch (err) {
    statusEl.textContent = "⚠️ Failed to send email: " + err.message;
    statusEl.style.color = "red";
  }
}

// ===============================
// 📥 LOAD EMAIL LOGS
// ===============================
async function loadEmailLogs() {
  const tbody = document.getElementById("emailTableBody");
  tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Loading...</td></tr>";

  try {
    const res = await fetch(`${SCRIPT_URL}?action=getEmails`);
    const data = await res.json();

    if (data.success && data.emails.length > 0) {
      tbody.innerHTML = data.emails.map(email => `
        <tr>
          <td>${email.timestamp}</td>
          <td>${email.from}</td>
          <td>${email.to}</td>
          <td>${email.subject}</td>
          <td>${email.status}</td>
          <td>${email.message}</td>
        </tr>
      `).join("");
    } else {
      tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>No emails logged yet</td></tr>";
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan='6' style='text-align:center;color:red;'>Error loading data</td></tr>`;
  }
}

// ===============================
// 📊 LOAD STATS
// ===============================
async function loadStats() {
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getStats`);
    const data = await res.json();

    if (data.success) {
      document.getElementById("totalEmails").textContent = data.stats.total;
      document.getElementById("manualEmails").textContent = data.stats.manual;
    }
  } catch (err) {
    console.error("Failed to load stats", err);
  }
}
