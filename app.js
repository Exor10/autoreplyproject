// Configuration
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz1YLGic1Q8ng6ofC62fP1O6J_x_JhWAmfQy2MLNv3MCo81n6D0RHN-eFLFgyVTGVLa/exec';
const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

// State management
let currentEmail = null;
let autoRefreshTimer = null;
let emailsData = [];

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
    setupEventListeners();
    startAutoRefresh();
});

// Initialize dashboard
function initializeDashboard() {
    updateConnectionStatus('loading', 'Connecting...');
    fetchDashboardData();
}

// Setup event listeners
function setupEventListeners() {
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        fetchDashboardData();
    });

    // Retry button
    document.getElementById('retryBtn').addEventListener('click', () => {
        hideError();
        fetchDashboardData();
    });

    // Modal close buttons
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlay') closeModal();
    });

    // Follow-up modal
    document.getElementById('sendFollowUpBtn').addEventListener('click', openFollowUpModal);
    document.getElementById('followUpModalClose').addEventListener('click', closeFollowUpModal);
    document.getElementById('cancelFollowUpBtn').addEventListener('click', closeFollowUpModal);
    document.getElementById('followUpModal').addEventListener('click', (e) => {
        if (e.target.id === 'followUpModal') closeFollowUpModal();
    });

    // Follow-up form submission
    document.getElementById('followUpForm').addEventListener('submit', handleFollowUpSubmit);
}

// Fetch dashboard data
async function fetchDashboardData() {
    try {
        updateConnectionStatus('loading', 'Loading...');
        hideError();

        // Fetch stats and emails in parallel
        const [stats, emails] = await Promise.all([
            fetchStats(),
            fetchEmails()
        ]);

        if (stats) updateStatistics(stats);
        if (emails) {
            emailsData = emails;
            renderEmailFeed(emails);
        }

        updateConnectionStatus('connected', 'Connected');
        updateLastUpdated();
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        updateConnectionStatus('error', 'Disconnected');
        showError('Unable to fetch data from the server. Please check your connection and try again.');
    }
}

// Fetch statistics
async function fetchStats() {
    try {
        console.log('Fetching stats from:', `${SCRIPT_URL}?action=getStats`);
        
        const response = await fetch(`${SCRIPT_URL}?action=getStats`, {
            method: 'GET',
            redirect: 'follow',
            mode: 'cors'
        });

        console.log('Stats response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Stats data received:', data);

        if (data.success && data.stats) {
            return data.stats;
        } else {
            throw new Error('Invalid stats data format');
        }
    } catch (error) {
        console.error('Error fetching stats:', error);
        throw error;
    }
}

// Fetch emails
async function fetchEmails() {
    try {
        console.log('Fetching emails from:', `${SCRIPT_URL}?action=getEmails`);
        
        const response = await fetch(`${SCRIPT_URL}?action=getEmails`, {
            method: 'GET',
            redirect: 'follow',
            mode: 'cors'
        });

        console.log('Emails response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Emails data received:', data);

        if (data.success && data.emails) {
            return data.emails;
        } else {
            throw new Error('Invalid emails data format');
        }
    } catch (error) {
        console.error('Error fetching emails:', error);
        throw error;
    }
}

// Update statistics display
function updateStatistics(stats) {
    document.getElementById('totalEmails').textContent = stats.totalEmails || 0;
    document.getElementById('autoResponded').textContent = stats.autoResponded || 0;
    document.getElementById('avgResponseTime').textContent = stats.avgResponseTime || '--';
    
    // Calculate success rate with fallback logic
    let successRate = '--';
    if (stats.successRate !== undefined && stats.successRate !== null) {
        // Backend provided success rate directly
        successRate = `${stats.successRate}%`;
    } else if (stats.totalEmails && stats.totalEmails > 0) {
        // Calculate success rate from autoResponded/totalEmails
        const calculated = Math.round((stats.autoResponded / stats.totalEmails) * 100);
        successRate = `${calculated}%`;
    } else if (stats.totalEmails === 0) {
        // Edge case: no emails yet
        successRate = '0%';
    }
    
    document.getElementById('successRate').textContent = successRate;
}

// Render email feed
function renderEmailFeed(emails) {
    const emailFeed = document.getElementById('emailFeed');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const emailCount = document.getElementById('emailCount');

    loadingSpinner.style.display = 'none';
    emailCount.textContent = `${emails.length} email${emails.length !== 1 ? 's' : ''}`;

    if (emails.length === 0) {
        emailFeed.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <h3>No emails yet</h3>
                <p>Emails will appear here when they are received</p>
            </div>
        `;
        return;
    }

    emailFeed.innerHTML = emails.map(email => createEmailCard(email)).join('');

    // Add click event listeners to email cards
    emailFeed.querySelectorAll('.email-card').forEach((card, index) => {
        card.addEventListener('click', () => openEmailDetail(emails[index]));
    });
}

// Create email card HTML
function createEmailCard(email) {
    const inquiryTypeLower = (email.inquiryType || 'general').toLowerCase();
    const timeAgo = getTimeAgo(email.timestamp);
    const preview = email.body ? email.body.substring(0, 80) + '...' : 'No preview available';

    return `
        <div class="email-card">
            <div class="email-card-header">
                <div class="email-from">${escapeHtml(email.from)}</div>
                <div class="email-time">${timeAgo}</div>
            </div>
            <div class="email-subject">${escapeHtml(email.subject)}</div>
            <div class="email-preview">${escapeHtml(preview)}</div>
            <div class="email-card-footer">
                <span class="badge ${inquiryTypeLower}">${email.inquiryType || 'General'}</span>
                ${email.status === 'Auto-Responded' ? '<span class="status-badge">✓ Auto-Responded</span>' : ''}
                ${email.responseTime ? `<span class="response-time">⏱ ${email.responseTime}</span>` : ''}
            </div>
        </div>
    `;
}

// Open email detail modal
function openEmailDetail(email) {
    currentEmail = email;
    const modalBody = document.getElementById('modalBody');
    const inquiryTypeLower = (email.inquiryType || 'general').toLowerCase();

    modalBody.innerHTML = `
        <div class="email-detail-section">
            <div class="email-detail-label">From</div>
            <div class="email-detail-value">${escapeHtml(email.from)}</div>
        </div>
        <div class="email-detail-section">
            <div class="email-detail-label">Subject</div>
            <div class="email-detail-value">${escapeHtml(email.subject)}</div>
        </div>
        <div class="email-detail-section">
            <div class="email-detail-label">Received</div>
            <div class="email-detail-value">${formatDateTime(email.timestamp)}</div>
        </div>
        <div class="email-detail-section">
            <div class="email-detail-label">Inquiry Type</div>
            <div class="email-detail-value">
                <span class="badge ${inquiryTypeLower}">${email.inquiryType || 'General'}</span>
            </div>
        </div>
        <div class="email-detail-section">
            <div class="email-detail-label">Status</div>
            <div class="email-detail-value">
                ${email.status === 'Auto-Responded' ? '<span class="status-badge">✓ Auto-Responded</span>' : '<span>Pending</span>'}
                ${email.responseTime ? ` in ${email.responseTime}` : ''}
            </div>
        </div>
        <div class="email-detail-section">
            <div class="email-detail-label">Message</div>
            <div class="email-detail-value email-detail-body">${escapeHtml(email.body || 'No message content')}</div>
        </div>
        ${email.reply ? `
        <div class="email-detail-section">
            <div class="email-detail-label">Auto-Response Sent</div>
            <div class="email-detail-value email-detail-body">${escapeHtml(email.reply)}</div>
        </div>
        ` : ''}
    `;

    document.getElementById('modalOverlay').style.display = 'flex';
}

// Close email detail modal
function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    currentEmail = null;
}

// Open follow-up modal
function openFollowUpModal() {
    if (!currentEmail) return;

    document.getElementById('followUpRecipient').value = currentEmail.from;
    document.getElementById('followUpSubject').value = `Re: ${currentEmail.subject}`;
    document.getElementById('followUpMessage').value = '';

    closeModal();
    document.getElementById('followUpModal').style.display = 'flex';
}

// Close follow-up modal
function closeFollowUpModal() {
    document.getElementById('followUpModal').style.display = 'none';
    document.getElementById('followUpForm').reset();
}

// Handle follow-up form submission
async function handleFollowUpSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submitFollowUpBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');

    try {
        // Show loading state
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnSpinner.style.display = 'block';

        const formData = {
            action: 'sendEmail',
            recipient: document.getElementById('followUpRecipient').value,
            subject: document.getElementById('followUpSubject').value,
            message: document.getElementById('followUpMessage').value
        };

        console.log('Sending follow-up email:', formData);

        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            redirect: 'follow',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams(formData)
        });

        console.log('Follow-up response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Follow-up response data:', data);

        if (data.success) {
            showToast('Follow-up email sent successfully!', 'success');
            closeFollowUpModal();
        } else {
            throw new Error(data.message || 'Failed to send email');
        }
    } catch (error) {
        console.error('Error sending follow-up email:', error);
        showToast('Failed to send follow-up email. Please try again.', 'error');
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        btnText.style.display = 'block';
        btnSpinner.style.display = 'none';
    }
}

// Update connection status
function updateConnectionStatus(status, text) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    statusDot.className = `status-dot ${status}`;
    statusText.textContent = text;
}

// Show error banner
function showError(message) {
    const errorBanner = document.getElementById('errorBanner');
    const errorText = document.getElementById('errorText');

    errorText.textContent = message;
    errorBanner.style.display = 'block';
}

// Hide error banner
function hideError() {
    document.getElementById('errorBanner').style.display = 'none';
}

// Update last updated timestamp
function updateLastUpdated() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('lastUpdated').textContent = `Last updated: ${timeString}`;
}

// Start auto-refresh timer
function startAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }
    autoRefreshTimer = setInterval(() => {
        console.log('Auto-refreshing data...');
        fetchDashboardData();
    }, AUTO_REFRESH_INTERVAL);
}

// Utility: Get time ago string
function getTimeAgo(timestamp) {
    if (!timestamp) return 'Unknown time';

    const now = new Date();
    const emailDate = new Date(timestamp);
    const diffMs = now - emailDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    return emailDate.toLocaleDateString();
}

// Utility: Format date and time
function formatDateTime(timestamp) {
    if (!timestamp) return 'Unknown';

    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Utility: Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Toast notification system
function showToast(message, type = 'success') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? '✓' : '✕';
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    toastContainer.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('toast-show'), 10);

    // Auto-dismiss success toasts after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }
});
