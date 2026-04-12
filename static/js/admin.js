// ============================================================================
// Admin Page
// ============================================================================

let entityTypes = {};

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(text) {
    if (text === null || text === undefined) return '<span class="null-value">null</span>';
    const str = String(text);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showBackupStatus(message, isError = false) {
    const el = document.getElementById('backupStatus');
    el.textContent = message;
    el.className = 'backup-status ' + (isError ? 'backup-status-error' : 'backup-status-ok');
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ── Section 1: Entity Browser ─────────────────────────────────────────────────

async function fetchEntityTypes() {
    const response = await fetch('/api/admin/entities');
    if (!response.ok) throw new Error('Failed to fetch entity types');
    return await response.json();
}

async function fetchEntities(type) {
    const response = await fetch(`/api/admin/${type}`);
    if (!response.ok) throw new Error('Failed to fetch entities');
    return await response.json();
}

async function deleteEntity(type, id) {
    const response = await fetch(`/api/admin/${type}/${id}`, { method: 'DELETE' });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete');
    }
    return await response.json();
}

function renderTable(columns, rows, entityType) {
    const container = document.getElementById('tableContainer');
    const countEl = document.getElementById('rowCount');
    countEl.textContent = `${rows.length} record${rows.length !== 1 ? 's' : ''}`;

    if (rows.length === 0) {
        container.innerHTML = '<p class="admin-placeholder">No records found for this entity type.</p>';
        return;
    }

    const headerCells = columns.map(col => `<th>${escapeHtml(col)}</th>`).join('') + '<th>Actions</th>';

    const bodyRows = rows.map(row => {
        const cells = columns.map(col => {
            const val = row[col];
            return `<td title="${col}">${escapeHtml(val)}</td>`;
        }).join('');
        const deleteBtn = `<td><button class="btn btn-danger btn-sm btn-delete" data-id="${row.id}" data-type="${entityType}">Delete</button></td>`;
        return `<tr>${cells}${deleteBtn}</tr>`;
    }).join('');

    container.innerHTML = `
        <div class="table-scroll">
            <table class="admin-table">
                <thead><tr>${headerCells}</tr></thead>
                <tbody>${bodyRows}</tbody>
            </table>
        </div>
    `;

    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const type = btn.dataset.type;
            if (!confirm(`Delete ${type} #${id}? This cannot be undone.`)) return;
            try {
                await deleteEntity(type, id);
                await loadEntities(type);
            } catch (err) {
                alert('Error: ' + err.message);
            }
        });
    });
}

async function loadEntities(type) {
    const container = document.getElementById('tableContainer');
    container.innerHTML = '<p class="admin-placeholder">Loading...</p>';
    try {
        const data = await fetchEntities(type);
        renderTable(data.columns, data.rows, type);
    } catch (err) {
        container.innerHTML = `<p class="admin-placeholder" style="color: var(--danger-color);">Error: ${escapeHtml(err.message)}</p>`;
    }
}

// ── Section 2: Database Backup ────────────────────────────────────────────────

async function loadBackupsList() {
    const container = document.getElementById('backupsListContainer');
    try {
        const response = await fetch('/api/backups');
        if (!response.ok) throw new Error('Failed to list backups');
        const backups = await response.json();

        if (backups.length === 0) {
            container.innerHTML = '<p class="admin-placeholder">No backups yet.</p>';
            return;
        }

        const rows = backups.map(b => {
            const name = escapeHtml(b.filename || b);
            const rawName = b.filename || b;
            return `<tr>
                <td>${name}</td>
                <td class="backup-action-cell">
                    <a href="/api/backup/download/${encodeURIComponent(rawName)}" class="btn btn-secondary btn-sm" download>Download</a>
                    <button class="btn btn-danger btn-sm btn-restore" data-path="${escapeHtml(b.path || rawName)}">Restore</button>
                </td>
            </tr>`;
        }).join('');

        container.innerHTML = `
            <div class="table-scroll">
                <table class="admin-table">
                    <thead><tr><th>Filename</th><th>Actions</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;

        container.querySelectorAll('.btn-restore').forEach(btn => {
            btn.addEventListener('click', async () => {
                const path = btn.dataset.path;
                if (!confirm(`Restore from "${path}"? This will overwrite the current database.`)) return;
                try {
                    const res = await fetch('/api/restore', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    showBackupStatus(data.message);
                } catch (err) {
                    showBackupStatus('Restore failed: ' + err.message, true);
                }
            });
        });

    } catch (err) {
        container.innerHTML = `<p class="admin-placeholder" style="color: var(--danger-color);">Error: ${escapeHtml(err.message)}</p>`;
    }
}

async function createBackup() {
    const btn = document.getElementById('createBackupBtn');
    btn.disabled = true;
    btn.textContent = 'Creating…';
    try {
        const res = await fetch('/api/backup', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showBackupStatus(`Backup created: ${data.filename}`);
        await loadBackupsList();
    } catch (err) {
        showBackupStatus('Backup failed: ' + err.message, true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create Backup';
    }
}

async function uploadAndRestoreBackup(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('restore', 'true');
    try {
        const res = await fetch('/api/backup/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showBackupStatus(data.message);
        await loadBackupsList();
    } catch (err) {
        showBackupStatus('Upload failed: ' + err.message, true);
    }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function initTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        });
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    // Entity browser
    const select = document.getElementById('entitySelect');
    try {
        entityTypes = await fetchEntityTypes();
        for (const name of Object.keys(entityTypes)) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name.charAt(0).toUpperCase() + name.slice(1);
            select.appendChild(opt);
        }
    } catch (err) {
        console.error('Failed to load entity types:', err);
    }

    select.addEventListener('change', () => {
        const type = select.value;
        document.getElementById('rowCount').textContent = '';
        if (!type) {
            document.getElementById('tableContainer').innerHTML = '<p class="admin-placeholder">Select an entity type to view its records.</p>';
            return;
        }
        loadEntities(type);
    });

    // Backup section
    await loadBackupsList();

    document.getElementById('createBackupBtn').addEventListener('click', createBackup);

    document.getElementById('exportJsonBtn').addEventListener('click', () => {
        window.location.href = '/api/export/json';
    });

    document.getElementById('uploadBackupInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!confirm(`Upload and restore "${file.name}"? This will overwrite the current database.`)) {
            e.target.value = '';
            return;
        }
        await uploadAndRestoreBackup(file);
        e.target.value = '';
    });

    document.getElementById('importTripInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const res = await fetch('/api/import/trip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            showBackupStatus(`Trip "${result.trip_name}" imported (ID ${result.trip_id})`);
        } catch (err) {
            showBackupStatus('Import failed: ' + err.message, true);
        }
        e.target.value = '';
    });
});
