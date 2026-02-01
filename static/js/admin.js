// ============================================================================
// Admin Page
// ============================================================================

let entityTypes = {};

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

function escapeHtml(text) {
    if (text === null || text === undefined) return '<span class="null-value">null</span>';
    const str = String(text);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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

    // Attach delete handlers
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

document.addEventListener('DOMContentLoaded', async () => {
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
});
