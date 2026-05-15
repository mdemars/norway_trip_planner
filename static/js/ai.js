/* ============================================================================
   Ask AI page — frontend logic
   ============================================================================ */

// ── SVG icon helpers ──────────────────────────────────────────────────────────
const _spinnerSVG = `
  <svg class="ai-step-icon ai-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>`;

const _checkSVG = `
  <svg class="ai-step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>`;

const _errorSVG = `
  <svg class="ai-step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>`;

const _infoSVG = `
  <svg class="ai-step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>`;

// ── State ─────────────────────────────────────────────────────────────────────
let activePromptId = null;
let activeEventSource = null;
// step elements keyed by tool call label (so we can replace spinner with check)
let pendingStepEl = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const promptInput   = document.getElementById('promptInput');
const charCount     = document.getElementById('charCount');
const submitBtn     = document.getElementById('submitBtn');
const cancelBtn     = document.getElementById('cancelBtn');
const progressPanel = document.getElementById('progressPanel');
const progressSteps = document.getElementById('progressSteps');
const finalResponse = document.getElementById('finalResponse');
const tripLink      = document.getElementById('tripLink');
const modelBadge    = document.getElementById('modelBadge');
const tripSelector  = document.getElementById('tripSelector');
const promptsList   = document.getElementById('promptsList');

// ── Textarea char counter ─────────────────────────────────────────────────────
promptInput.addEventListener('input', () => {
    charCount.textContent = promptInput.value.length;
});

// ── Suggestion chips ──────────────────────────────────────────────────────────
document.querySelectorAll('.ai-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        promptInput.value = chip.dataset.prompt;
        charCount.textContent = promptInput.value.length;
        promptInput.focus();
    });
});

// ── Load trip list for the selector ──────────────────────────────────────────
async function loadTrips() {
    try {
        const res = await fetch('/api/trips');
        if (!res.ok) return;
        const trips = await res.json();
        trips.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            tripSelector.appendChild(opt);
        });
    } catch (_) { /* ignore */ }
}

// ── Submit ────────────────────────────────────────────────────────────────────
submitBtn.addEventListener('click', handleSubmit);
promptInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
});

async function handleSubmit() {
    const prompt = promptInput.value.trim();
    if (!prompt) { promptInput.focus(); return; }

    const tripId = tripSelector.value ? parseInt(tripSelector.value) : null;

    // Reset UI
    resetProgress();
    progressPanel.style.display = 'block';
    submitBtn.disabled = true;
    cancelBtn.style.display = 'flex';
    modelBadge.style.display = 'none';

    try {
        const res = await fetch('/api/ai/plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, trip_id: tripId }),
        });

        if (!res.ok) {
            const err = await res.json();
            addStep('error', err.error || 'Failed to start');
            resetButtons();
            return;
        }

        const { prompt_id, model } = await res.json();
        activePromptId = prompt_id;

        modelBadge.textContent = `Using ${model}`;
        modelBadge.style.display = 'flex';

        openStream(prompt_id);
    } catch (err) {
        addStep('error', `Network error: ${err.message}`);
        resetButtons();
    }
}

// ── Cancel ────────────────────────────────────────────────────────────────────
cancelBtn.addEventListener('click', async () => {
    if (!activePromptId) return;
    cancelBtn.disabled = true;
    try {
        await fetch(`/api/ai/plan/${activePromptId}/cancel`, { method: 'POST' });
    } catch (_) { /* ignore */ }
});

// ── SSE stream ────────────────────────────────────────────────────────────────
function openStream(promptId) {
    if (activeEventSource) activeEventSource.close();

    const es = new EventSource(`/api/ai/plan/${promptId}/stream`);
    activeEventSource = es;

    es.onmessage = e => {
        let evt;
        try { evt = JSON.parse(e.data); } catch (_) { return; }
        handleEvent(evt);
    };

    es.onerror = () => {
        es.close();
        activeEventSource = null;
        resetButtons();
    };
}

function handleEvent(evt) {
    switch (evt.type) {

        case 'status':
            addStep('info', evt.message);
            break;

        case 'tool_call':
            // Show spinning step; save reference so we can update it on result
            pendingStepEl = addStep('running', evt.label);
            break;

        case 'tool_result':
            // Replace the pending spinner with success or error
            if (pendingStepEl) {
                updateStep(pendingStepEl, evt.success ? 'ok' : 'error', evt.summary);
                pendingStepEl = null;
            } else {
                addStep(evt.success ? 'ok' : 'error', evt.summary);
            }
            break;

        case 'text':
            // Accumulate Claude's prose response
            if (finalResponse.textContent) {
                finalResponse.textContent += '\n' + evt.message;
            } else {
                finalResponse.textContent = evt.message;
            }
            break;

        case 'done':
            if (activeEventSource) { activeEventSource.close(); activeEventSource = null; }
            addStep('ok', 'Done!');
            if (evt.trip_id) {
                tripLink.href = `/trip/${evt.trip_id}`;
                tripLink.style.display = 'inline-flex';
            }
            resetButtons();
            loadPrompts(); // refresh history
            break;

        case 'cancelled':
            if (activeEventSource) { activeEventSource.close(); activeEventSource = null; }
            addStep('info', 'Cancelled.');
            resetButtons();
            loadPrompts();
            break;

        case 'error':
            if (activeEventSource) { activeEventSource.close(); activeEventSource = null; }
            addStep('error', evt.message || 'An error occurred.');
            resetButtons();
            loadPrompts();
            break;
    }

    // Auto-scroll steps
    progressSteps.scrollTop = progressSteps.scrollHeight;
}

// ── Step rendering helpers ─────────────────────────────────────────────────────
function addStep(state, text) {
    const row = document.createElement('div');
    row.className = `ai-step step-${state}`;
    row.innerHTML = `${_iconFor(state)}<span class="ai-step-text">${escHtml(text)}</span>`;
    progressSteps.appendChild(row);
    progressSteps.scrollTop = progressSteps.scrollHeight;
    return row;
}

function updateStep(el, state, text) {
    el.className = `ai-step step-${state}`;
    el.innerHTML = `${_iconFor(state)}<span class="ai-step-text">${escHtml(text)}</span>`;
}

function _iconFor(state) {
    if (state === 'running') return _spinnerSVG;
    if (state === 'ok')      return _checkSVG;
    if (state === 'error')   return _errorSVG;
    return _infoSVG;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function resetProgress() {
    progressSteps.innerHTML = '';
    finalResponse.textContent = '';
    tripLink.style.display = 'none';
    tripLink.href = '#';
    pendingStepEl = null;
}

function resetButtons() {
    submitBtn.disabled = false;
    cancelBtn.style.display = 'none';
    cancelBtn.disabled = false;
    activePromptId = null;
}

// ── Prompts history ───────────────────────────────────────────────────────────
async function loadPrompts() {
    try {
        const res = await fetch('/api/ai/prompts');
        if (!res.ok) return;
        const prompts = await res.json();
        renderPrompts(prompts);
    } catch (_) {
        promptsList.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;">Could not load history.</p>';
    }
}

function renderPrompts(prompts) {
    if (!prompts.length) {
        promptsList.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;">No sessions yet.</p>';
        return;
    }
    promptsList.innerHTML = '';
    prompts.forEach(p => {
        const row = document.createElement('div');
        row.className = 'ai-prompt-row';
        row.title = 'Click to reuse this prompt';

        const date = new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

        const tripBadge = p.trip_id
            ? `<a class="ai-trip-badge" href="/trip/${p.trip_id}" onclick="event.stopPropagation()">Trip #${p.trip_id} →</a>`
            : '';

        row.innerHTML = `
            <span class="ai-prompt-text">${escHtml(p.prompt_text)}</span>
            <span class="ai-prompt-meta">
                <span class="ai-status-badge ${p.status}">${p.status}</span>
                ${tripBadge}
                <span>${date}</span>
            </span>`;

        row.addEventListener('click', () => {
            promptInput.value = p.prompt_text;
            charCount.textContent = promptInput.value.length;
            promptInput.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        promptsList.appendChild(row);
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadTrips();
loadPrompts();
