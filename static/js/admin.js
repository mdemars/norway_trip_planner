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
    // Auto-hide successes; keep errors visible until the next action clears them
    if (!isError) setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function showTabError(panelId, message) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    let el = panel.querySelector('.admin-tab-error');
    if (!el) {
        el = document.createElement('div');
        el.className = 'admin-tab-error';
        panel.appendChild(el);
    }
    el.textContent = 'Error: ' + message;
    el.style.display = 'block';
}

function clearTabError(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const el = panel.querySelector('.admin-tab-error');
    if (el) el.style.display = 'none';
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
            clearTabError('tab-entities');
            try {
                await deleteEntity(type, id);
                await loadEntities(type);
            } catch (err) {
                showTabError('tab-entities', err.message);
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

// ── Section 3: Stop-Link Fix ──────────────────────────────────────────────────

let chainLocations = [];        // current ordered array from the server
let chainPendingDeletes = new Set(); // guids staged for deletion
let chainTripId = null;
let chainDragSrcIdx = null;

function updateChainBackButton(tripId) {
    const btn = document.getElementById('chainBackToTripBtn');
    if (tripId) {
        btn.href = `/trip/${tripId}`;
        btn.style.display = 'inline-flex';
    } else {
        btn.style.display = 'none';
    }
}

async function loadChainTrips() {
    const select = document.getElementById('chainTripSelect');
    try {
        const res = await fetch('/api/admin/chain/trips');
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to load trips');
        const trips = await res.json();
        for (const t of trips) {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            select.appendChild(opt);
        }
    } catch (err) {
        showTabError('tab-ordering', err.message);
    }
}

async function loadChainLocations(tripId) {
    const container = document.getElementById('chainContainer');
    container.innerHTML = '<p class="admin-placeholder">Loading…</p>';
    document.getElementById('chainLocationCount').textContent = '';
    document.getElementById('chainSaveBtn').style.display = 'none';
    chainPendingDeletes = new Set();
    try {
        const res = await fetch(`/api/admin/chain/trips/${tripId}/locations`);
        if (!res.ok) throw new Error((await res.json()).error);
        chainLocations = await res.json();
        chainTripId = tripId;
        clearTabError('tab-ordering');
        renderChainTable();
    } catch (err) {
        container.innerHTML = `<p class="admin-placeholder" style="color:var(--danger-color);">Error: ${escapeHtml(err.message)}</p>`;
        showTabError('tab-ordering', err.message);
    }
}

function formatDateRange(loc) {
    if (!loc.start_date && !loc.end_date) return '—';
    const fmt = iso => iso ? iso.slice(0, 10) : '?';
    if (loc.start_date && loc.end_date) return `${fmt(loc.start_date)} → ${fmt(loc.end_date)}`;
    return fmt(loc.start_date || loc.end_date);
}

function shortGuid(guid) {
    return guid ? guid.slice(0, 8) + '…' : '<span class="null-value">null</span>';
}

function renderChainTable() {
    const container = document.getElementById('chainContainer');
    const countEl = document.getElementById('chainLocationCount');
    countEl.textContent = `${chainLocations.length} location${chainLocations.length !== 1 ? 's' : ''}`;
    document.getElementById('chainSaveBtn').style.display = chainLocations.length ? 'inline-flex' : 'none';

    if (!chainLocations.length) {
        container.innerHTML = '<p class="admin-placeholder">No locations found for this trip.</p>';
        return;
    }

    // Date-error detection — skip pending deletes
    const dateErrors = new Set();
    let prevStop = null;
    for (let i = 0; i < chainLocations.length; i++) {
        const loc = chainLocations[i];
        if (chainPendingDeletes.has(loc.guid)) continue;
        if (loc.type !== 'stop' || !loc.start_date) continue;
        if (prevStop && prevStop.end_date) {
            if (new Date(loc.start_date) < new Date(prevStop.end_date)) {
                dateErrors.add(i);
            }
        }
        prevStop = loc;
    }

    const rows = chainLocations.map((loc, i) => {
        const isDeleted = chainPendingDeletes.has(loc.guid);
        const badge = loc.type === 'stop'
            ? '<span class="chain-badge chain-badge-stop">stop</span>'
            : '<span class="chain-badge chain-badge-waypoint">waypoint</span>';
        const errorClass = !isDeleted && dateErrors.has(i) ? ' chain-row-date-error' : '';
        const deletedClass = isDeleted ? ' chain-row-pending-delete' : '';
        const errorIcon = !isDeleted && dateErrors.has(i)
            ? ' <svg style="vertical-align:middle;color:#dc3545;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
            : '';
        const unreachableIcon = !isDeleted && loc.unreachable
            ? ' <span class="chain-unreachable-badge" title="Unreachable — not connected to the main chain">orphan</span>'
            : '';
        const deleteBtn = isDeleted
            ? `<button class="btn btn-secondary btn-sm chain-delete-toggle" data-guid="${loc.guid}" title="Undo delete">Undo</button>`
            : `<button class="btn btn-danger btn-sm chain-delete-toggle" data-guid="${loc.guid}" title="Stage for deletion">Delete</button>`;
        return `<tr class="chain-row${errorClass}${deletedClass}" ${isDeleted ? '' : 'draggable="true"'} data-idx="${i}">
            <td class="chain-drag-handle" title="${isDeleted ? '' : 'Drag to reorder'}" style="${isDeleted ? 'opacity:0.3;' : ''}">
                ${isDeleted ? '' : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/>
                </svg>`}
            </td>
            <td>${escapeHtml(loc.name)}${errorIcon}${unreachableIcon}</td>
            <td>${badge}</td>
            <td class="chain-dates">${formatDateRange(loc)}</td>
            <td class="chain-guid" title="${loc.previous_location_guid || 'null'}">${shortGuid(loc.previous_location_guid)}</td>
            <td class="chain-action-cell">${deleteBtn}</td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="table-scroll">
            <table class="admin-table chain-table">
                <thead><tr>
                    <th style="width:32px;"></th>
                    <th>Name</th><th>Type</th><th>Date range</th><th>Previous link (current)</th><th style="width:80px;"></th>
                </tr></thead>
                <tbody id="chainTbody">${rows}</tbody>
            </table>
        </div>`;

    // Delete toggle buttons
    document.querySelectorAll('.chain-delete-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const guid = btn.dataset.guid;
            if (chainPendingDeletes.has(guid)) {
                chainPendingDeletes.delete(guid);
            } else {
                chainPendingDeletes.add(guid);
            }
            renderChainTable();
        });
    });

    attachChainDragHandlers();
}

function attachChainDragHandlers() {
    const tbody = document.getElementById('chainTbody');
    if (!tbody) return;

    tbody.addEventListener('dragstart', e => {
        const row = e.target.closest('.chain-row');
        if (!row) return;
        chainDragSrcIdx = parseInt(row.dataset.idx);
        row.classList.add('chain-dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    tbody.addEventListener('dragend', e => {
        const row = e.target.closest('.chain-row');
        if (row) row.classList.remove('chain-dragging');
        tbody.querySelectorAll('.chain-row').forEach(r => r.classList.remove('chain-drop-target'));
        chainDragSrcIdx = null;
    });

    tbody.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const row = e.target.closest('.chain-row');
        tbody.querySelectorAll('.chain-row').forEach(r => r.classList.remove('chain-drop-target'));
        if (row && parseInt(row.dataset.idx) !== chainDragSrcIdx) {
            row.classList.add('chain-drop-target');
        }
    });

    tbody.addEventListener('drop', e => {
        e.preventDefault();
        const targetRow = e.target.closest('.chain-row[draggable="true"]');
        if (!targetRow) return;
        const targetIdx = parseInt(targetRow.dataset.idx);
        if (chainDragSrcIdx === null || chainDragSrcIdx === targetIdx) return;

        const moved = chainLocations.splice(chainDragSrcIdx, 1)[0];
        const insertAt = chainDragSrcIdx < targetIdx ? targetIdx : targetIdx;
        chainLocations.splice(insertAt, 0, moved);
        renderChainTable();
    });
}

function computeChainDiff() {
    // Non-deleted locations in their current display order
    const active = chainLocations.filter(loc => !chainPendingDeletes.has(loc.guid));
    const nameByGuid = {};
    active.forEach(loc => { nameByGuid[loc.guid] = loc.name; });

    const linkChanges = [];
    active.forEach((loc, i) => {
        const newPrev = i > 0 ? active[i - 1].guid : null;
        if (loc.previous_location_guid !== newPrev) {
            linkChanges.push({
                name: loc.name,
                type: loc.type,
                old_prev_name: nameByGuid[loc.previous_location_guid] || null,
                new_prev_name: nameByGuid[newPrev] || null,
            });
        }
    });

    const deletions = chainLocations.filter(loc => chainPendingDeletes.has(loc.guid));
    return { linkChanges, deletions };
}

function showChainDiffModal({ linkChanges, deletions }) {
    const badge = type => type === 'stop'
        ? '<span class="chain-badge chain-badge-stop">stop</span>'
        : '<span class="chain-badge chain-badge-waypoint">waypoint</span>';

    const delSection = document.getElementById('chainDiffDeletionsSection');
    if (deletions.length) {
        document.getElementById('chainDiffDeleteCount').textContent = deletions.length;
        document.getElementById('chainDiffDeleteTbody').innerHTML = deletions.map(d =>
            `<tr class="chain-row-pending-delete"><td>${escapeHtml(d.name)}</td><td>${badge(d.type)}</td></tr>`
        ).join('');
        delSection.style.display = '';
    } else {
        delSection.style.display = 'none';
    }

    const linkSection = document.getElementById('chainDiffLinksSection');
    if (linkChanges.length) {
        document.getElementById('chainDiffLinkCount').textContent = linkChanges.length;
        document.getElementById('chainDiffLinkTbody').innerHTML = linkChanges.map(c => {
            const oldCell = c.old_prev_name
                ? escapeHtml(c.old_prev_name)
                : `<span class="null-value">null (chain head)</span>`;
            const newCell = c.new_prev_name
                ? escapeHtml(c.new_prev_name)
                : `<span class="null-value">null (chain head)</span>`;
            return `<tr><td>${escapeHtml(c.name)}</td><td>${badge(c.type)}</td><td>${oldCell}</td><td>${newCell}</td></tr>`;
        }).join('');
        linkSection.style.display = '';
    } else {
        linkSection.style.display = 'none';
    }

    document.getElementById('chainDiffModal').style.display = 'flex';
}

async function commitChain() {
    const active = chainLocations.filter(loc => !chainPendingDeletes.has(loc.guid));
    const guids = active.map(l => l.guid);
    const delete_ids = chainLocations
        .filter(loc => chainPendingDeletes.has(loc.guid))
        .map(loc => loc.id);
    try {
        const res = await fetch(`/api/admin/chain/trips/${chainTripId}/rechain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guids, delete_ids })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        document.getElementById('chainDiffModal').style.display = 'none';
        const parts = [];
        if (data.deleted?.length) parts.push(`${data.deleted.length} deleted`);
        if (data.changes?.length) parts.push(`${data.changes.length} link(s) updated`);
        showBackupStatus(`Done — ${parts.join(', ') || 'no changes'}.`);
        await loadChainLocations(chainTripId);
    } catch (err) {
        showBackupStatus('Failed: ' + err.message, true);
    }
}

// ── Section 4: Delete Trip ────────────────────────────────────────────────────

async function loadDeleteTripList() {
    const select = document.getElementById('deleteTripSelect');
    try {
        const res = await fetch('/api/trips');
        if (!res.ok) throw new Error('Failed to load trips');
        const trips = await res.json();
        select.innerHTML = '<option value="">-- Select a trip --</option>';
        for (const trip of trips) {
            const opt = document.createElement('option');
            opt.value = trip.id;
            opt.textContent = trip.name;
            select.appendChild(opt);
        }
        clearTabError('tab-delete-trip');
    } catch (err) {
        showTabError('tab-delete-trip', err.message);
    }
}

async function loadDeleteTripPreview(tripId) {
    const preview = document.getElementById('deleteTripPreview');
    const actions = document.getElementById('deleteTripActions');
    actions.style.display = 'none';

    if (!tripId) {
        preview.innerHTML = '<p class="admin-placeholder">Select a trip to see its details before deleting.</p>';
        return;
    }

    preview.innerHTML = '<p class="admin-placeholder">Loading…</p>';
    try {
        const res = await fetch(`/api/trips/${tripId}`);
        if (!res.ok) throw new Error('Failed to load trip');
        const trip = await res.json();
        const stops = trip.stops || [];
        const stopRows = stops.map(s => `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.start_date || '—')}</td><td>${escapeHtml(s.end_date || '—')}</td></tr>`).join('');
        preview.innerHTML = `
            <div class="table-scroll">
                <table class="admin-table">
                    <thead><tr><th colspan="3"><strong>${escapeHtml(trip.name)}</strong> — ${stops.length} stop${stops.length !== 1 ? 's' : ''}</th></tr>
                    <tr><th>Stop</th><th>Start</th><th>End</th></tr></thead>
                    <tbody>${stopRows || '<tr><td colspan="3" style="color:var(--text-muted)">No stops</td></tr>'}</tbody>
                </table>
            </div>`;
        actions.style.display = 'block';
    } catch (err) {
        preview.innerHTML = `<p class="admin-placeholder" style="color:var(--danger-color);">Error: ${escapeHtml(err.message)}</p>`;
    }
}

async function handleDeleteTripConfirm() {
    const select = document.getElementById('deleteTripSelect');
    const tripId = select.value;
    const tripName = select.options[select.selectedIndex]?.text;
    if (!tripId) return;
    if (!confirm(`Permanently delete trip "${tripName}" and all its stops, waypoints, and activities? This cannot be undone.`)) return;

    try {
        const res = await fetch(`/api/trips/${tripId}`, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to delete trip');
        }
        showBackupStatus(`Trip "${tripName}" deleted.`);
        await loadDeleteTripList();
        document.getElementById('deleteTripPreview').innerHTML = '<p class="admin-placeholder">Select a trip to see its details before deleting.</p>';
        document.getElementById('deleteTripActions').style.display = 'none';
    } catch (err) {
        showBackupStatus('Delete failed: ' + err.message, true);
    }
}

// ── Section 5: AI Prompts ─────────────────────────────────────────────────────

async function loadAiPrompts() {
    const container = document.getElementById('aiPromptsContainer');
    const countEl   = document.getElementById('aiPromptCount');
    container.innerHTML = '<p class="admin-placeholder">Loading…</p>';
    try {
        const res = await fetch('/api/ai/prompts');
        if (!res.ok) throw new Error('Failed to load prompts');
        const prompts = await res.json();
        countEl.textContent = `${prompts.length} prompt${prompts.length !== 1 ? 's' : ''}`;

        if (!prompts.length) {
            container.innerHTML = '<p class="admin-placeholder">No AI prompts yet.</p>';
            return;
        }

        const rows = prompts.map(p => {
            const date = new Date(p.created_at).toLocaleString();
            const tripCell = p.trip_id
                ? `<a href="/trip/${p.trip_id}" target="_blank">Trip #${p.trip_id}</a>`
                : '<span class="null-value">—</span>';
            return `<tr>
                <td>${escapeHtml(p.id)}</td>
                <td class="ai-admin-prompt-text" title="${escapeHtml(p.prompt_text)}">${escapeHtml(p.prompt_text)}</td>
                <td><span class="ai-status-badge ${p.status}">${p.status}</span></td>
                <td>${tripCell}</td>
                <td>${escapeHtml(date)}</td>
                <td><button class="btn btn-danger btn-sm" data-id="${p.id}">Delete</button></td>
            </tr>`;
        }).join('');

        container.innerHTML = `
            <div class="table-scroll">
                <table class="admin-table">
                    <thead><tr>
                        <th>ID</th><th>Prompt</th><th>Status</th><th>Trip</th><th>Created</th><th>Actions</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        container.querySelectorAll('button[data-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm(`Delete prompt #${btn.dataset.id}?`)) return;
                try {
                    const r = await fetch(`/api/ai/prompts/${btn.dataset.id}`, { method: 'DELETE' });
                    if (!r.ok) throw new Error((await r.json()).error);
                    await loadAiPrompts();
                } catch (err) {
                    showBackupStatus('Delete failed: ' + err.message, true);
                }
            });
        });
    } catch (err) {
        container.innerHTML = `<p class="admin-placeholder" style="color:var(--danger-color);">Error: ${escapeHtml(err.message)}</p>`;
    }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function activateTab(tabName) {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(t => {
        const isActive = t.dataset.tab === tabName;
        t.classList.toggle('active', isActive);
    });
    document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('tab-' + tabName);
    if (panel) panel.classList.add('active');
}

function initTabs() {
    activateTab(ADMIN_ACTIVE_TAB);
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            activateTab(tab.dataset.tab);
            history.pushState(null, '', tab.dataset.url);
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
        showTabError('tab-entities', err.message);
    }

    select.addEventListener('change', () => {
        clearTabError('tab-entities');
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

    // Stop-Link Fix
    await loadChainTrips();

    // Pre-select trip from URL param if present
    if (ADMIN_PRESELECT_TRIP) {
        const select = document.getElementById('chainTripSelect');
        select.value = ADMIN_PRESELECT_TRIP;
        if (select.value) {
            updateChainBackButton(ADMIN_PRESELECT_TRIP);
            await loadChainLocations(ADMIN_PRESELECT_TRIP);
        }
    }

    document.getElementById('chainTripSelect').addEventListener('change', e => {
        const id = e.target.value;
        updateChainBackButton(id ? parseInt(id) : null);
        if (id) loadChainLocations(id);
        else {
            chainLocations = [];
            chainTripId = null;
            document.getElementById('chainContainer').innerHTML = '<p class="admin-placeholder">Select a trip to view and reorder its stops and waypoints.</p>';
            document.getElementById('chainLocationCount').textContent = '';
            document.getElementById('chainSaveBtn').style.display = 'none';
        }
    });

    document.getElementById('chainSaveBtn').addEventListener('click', () => {
        const diff = computeChainDiff();
        if (!diff.deletions.length && !diff.linkChanges.length) {
            showBackupStatus('No changes — order is already up to date.');
            return;
        }
        showChainDiffModal(diff);
    });

    document.getElementById('chainDiffClose').addEventListener('click', () => {
        document.getElementById('chainDiffModal').style.display = 'none';
    });
    document.getElementById('chainDiffCancel').addEventListener('click', () => {
        document.getElementById('chainDiffModal').style.display = 'none';
    });
    document.getElementById('chainDiffCommit').addEventListener('click', commitChain);

    // Delete Trip tab
    await loadDeleteTripList();
    document.getElementById('deleteTripSelect').addEventListener('change', e => {
        loadDeleteTripPreview(e.target.value);
    });
    document.getElementById('deleteTripConfirmBtn').addEventListener('click', handleDeleteTripConfirm);

    // AI Prompts tab
    await loadAiPrompts();
    document.getElementById('aiPromptsRefreshBtn').addEventListener('click', loadAiPrompts);

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
