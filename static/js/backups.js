// ============================================================================
// Backups Page - Database Backup and Restore UI
// ============================================================================

let backupsData = [];

// ============================================================================
// Modal Helpers
// ============================================================================

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showConfirmation(title, message, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmBtn').onclick = function() {
        closeModal('confirmModal');
        onConfirm();
    };
    openModal('confirmModal');
}

function showNotification(title, message) {
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationMessage').textContent = message;
    openModal('notificationModal');
}

// ============================================================================
// Backup Operations
// ============================================================================

async function loadBackups() {
    const container = document.getElementById('backupsList');
    container.innerHTML = '<div class="loading">Loading backups...</div>';

    try {
        const response = await fetch('/api/backups');
        if (!response.ok) throw new Error('Failed to load backups');
        
        backupsData = await response.json();
        renderBackupsList();
    } catch (error) {
        console.error('Error loading backups:', error);
        container.innerHTML = `<div class="empty-state-small"><p>Error loading backups: ${error.message}</p></div>`;
    }
}

function renderBackupsList() {
    const container = document.getElementById('backupsList');

    if (!backupsData || backupsData.length === 0) {
        container.innerHTML = `
            <div class="empty-state-small">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                <p>No backups yet. Create one to get started.</p>
            </div>
        `;
        return;
    }

    let html = '';
    backupsData.forEach((backup) => {
        const date = new Date(backup.created_at);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        const sizeStr = backup.size_mb ? `${backup.size_mb.toFixed(2)} MB` : 'N/A';

        html += `
            <div class="backup-item">
                <div class="backup-item-info">
                    <div class="backup-filename">${escapeHtml(backup.filename)}</div>
                    <div class="backup-date">Created: ${dateStr} • Size: ${sizeStr}</div>
                </div>
                <div class="backup-item-actions">
                    <button class="btn btn-primary btn-sm" onclick="downloadBackup('${escapeHtml(backup.filename)}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="restoreBackup('${escapeHtml(backup.path)}', '${escapeHtml(backup.filename)}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <polyline points="1 20 1 14 7 14"></polyline>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36M20.49 15a9 9 0 0 1-14.85 3.36"></path>
                        </svg>
                        Restore
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function createBackup() {
    const btn = document.getElementById('createBackupBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Creating...</span>';

    try {
        const response = await fetch('/api/backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to create backup');
        }

        showNotification('Success', `Backup created: ${data.filename}`);
        await loadBackups();
    } catch (error) {
        console.error('Error creating backup:', error);
        showNotification('Error', `Failed to create backup: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function restoreBackup(backupPath, filename) {
    showConfirmation(
        'Restore Backup',
        `Are you sure you want to restore from ${filename}?\n\nThis will replace your current database. Make sure you have a recent backup!`,
        async () => {
            try {
                const response = await fetch('/api/restore', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: backupPath })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to restore backup');
                }

                showNotification(
                    'Success',
                    `Database restored successfully. The page will reload shortly.`
                );

                // Reload the page after a short delay
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            } catch (error) {
                console.error('Error restoring backup:', error);
                showNotification('Error', `Failed to restore backup: ${error.message}`);
            }
        }
    );
}

async function downloadBackup(filename) {
    try {
        const response = await fetch(`/api/backup/download/${encodeURIComponent(filename)}`);
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to download backup');
        }

        // Create a blob from the response
        const blob = await response.blob();

        // Create a temporary URL for the blob
        const url = window.URL.createObjectURL(blob);

        // Create a temporary link element and click it
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the URL
        window.URL.revokeObjectURL(url);

        showNotification('Success', `Backup '${filename}' downloaded successfully`);
    } catch (error) {
        console.error('Error downloading backup:', error);
        showNotification('Error', `Failed to download backup: ${error.message}`);
    }
}

function uploadBackup() {
    const fileInput = document.getElementById('backupFileInput');
    fileInput.click();
}

async function handleBackupFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    const restoreAfterUpload = document.getElementById('restoreAfterUpload').checked;

    const formData = new FormData();
    formData.append('file', file);
    if (restoreAfterUpload) {
        formData.append('restore', 'true');
    }

    const uploadBtn = document.getElementById('uploadBackupBtn');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span>Uploading...</span>';

    try {
        const response = await fetch('/api/backup/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to upload backup');
        }

        showNotification('Success', data.message);

        // Reload the page if restored
        if (data.restored) {
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            // Reload backups list if just uploaded
            await loadBackups();
        }
    } catch (error) {
        console.error('Error uploading backup:', error);
        showNotification('Error', `Failed to upload backup: ${error.message}`);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = originalText;
        // Reset the file input
        document.getElementById('backupFileInput').value = '';
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ============================================================================
// Event Listeners & Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    // Load language and initialize
    const initApp = () => {
        loadBackups();
        
        // Refresh backups every 30 seconds
        setInterval(loadBackups, 30000);
    };

    // Check if i18next is ready
    if (typeof i18next !== 'undefined' && i18next.isInitialized) {
        initApp();
    } else {
        // Wait for i18next initialization
        setTimeout(initApp, 500);
    }

    // Set up event listeners
    document.getElementById('createBackupBtn').addEventListener('click', createBackup);
    document.getElementById('uploadBackupBtn').addEventListener('click', uploadBackup);
    document.getElementById('backupFileInput').addEventListener('change', handleBackupFileSelected);

    // Close modals when clicking outside
    document.getElementById('confirmModal').addEventListener('click', function(event) {
        if (event.target === this) {
            closeModal('confirmModal');
        }
    });

    document.getElementById('notificationModal').addEventListener('click', function(event) {
        if (event.target === this) {
            closeModal('notificationModal');
        }
    });
});
