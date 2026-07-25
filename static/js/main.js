/**
 * POCKET C.A. — COMMERCIAL AI SAAS APPLICATION CORE
 * Features: SSE Streaming, Multi-Session History, AbortController, Real-time CA Calculators
 */

'use strict';

// ── DOM ELEMENTS ──────────────────────────────────────────
const appShell            = document.getElementById('appShell');
const sidebar             = document.getElementById('sidebar');
const sidebarBackdrop     = document.getElementById('sidebarBackdrop');
const sidebarToggle       = document.getElementById('sidebarToggle');
const chatThread          = document.getElementById('chatThread');
const messagesContainer    = document.getElementById('messagesContainer');
const welcomeScreen        = document.getElementById('welcomeScreen');
const chatInput            = document.getElementById('chatInput');
const sendBtn              = document.getElementById('sendBtn');
const charCounter          = document.getElementById('charCounter');
const btnNewChat           = document.getElementById('btnNewChat');
const btnClearChat         = document.getElementById('btnClearChat');
const historySearch        = document.getElementById('historySearch');
const sessionList          = document.getElementById('sessionList');
const historyCount         = document.getElementById('historyCount');
const currentSessionTitle  = document.getElementById('currentSessionTitle');
const starterGrid          = document.getElementById('starterGrid');
const btnRefreshStarters   = document.getElementById('btnRefreshStarters');
const stopGeneratingWrapper= document.getElementById('stopGeneratingWrapper');
const btnStopGenerating    = document.getElementById('btnStopGenerating');
const toast                = document.getElementById('toast');

// Modals
const toolsModal           = document.getElementById('toolsModal');
const btnOpenToolsModal    = document.getElementById('btnOpenToolsModal');
const btnCloseToolsModal   = document.getElementById('btnCloseToolsModal');
const clearModal           = document.getElementById('clearModal');
const btnCloseClearModal   = document.getElementById('btnCloseClearModal');
const btnCancelClear       = document.getElementById('btnCancelClear');
const btnConfirmClear      = document.getElementById('btnConfirmClear');
const renameModal          = document.getElementById('renameModal');
const renameInput          = document.getElementById('renameInput');
const btnCloseRenameModal  = document.getElementById('btnCloseRenameModal');
const btnCancelRename      = document.getElementById('btnCancelRename');
const btnSaveRename        = document.getElementById('btnSaveRename');

// ── STATE ─────────────────────────────────────────────────
let sessions = [];
let activeSessionId = null;
let isLoading = false;
let abortController = null;
let toastTimer = null;
let sessionToRenameId = null;

// Configure Marked.js
if (typeof marked !== 'undefined') {
  marked.setOptions({ breaks: true, gfm: true });
}

// Prompt Pool (12 items)
const STARTER_PROMPTS = [
  { label: 'Journal Entry', text: 'Depreciation entry of ₹25,000 on machinery', prompt: 'What journal entry should I pass for depreciation of ₹25,000 on machinery?' },
  { label: 'GST Calculation', text: '₹85,000 intra-state sale at 12% GST', prompt: 'Calculate GST on a ₹85,000 intra-state sale at 12% in Maharashtra.' },
  { label: 'Tax Planning', text: 'Old vs New Tax Regime comparison at ₹15 LPA', prompt: 'Should I opt for old or new income tax regime at ₹15 LPA with 80C ₹1.5L and HRA ₹2L?' },
  { label: 'Financial Statement', text: 'P&L Statement for retailer with ₹10L revenue', prompt: 'Prepare a Profit & Loss Statement for: sales ₹10L, COGS ₹6L, salaries ₹1L, rent ₹50K.' },
  { label: 'Depreciation', text: 'SLM vs WDV on ₹5,00,000 asset over 5 years', prompt: 'Calculate SLM and WDV depreciation on ₹5,00,000 asset over 5 years at 10%. Show year-wise schedule.' },
  { label: 'Ratio Analysis', text: 'Current & Debt-Equity Ratios interpretation', prompt: 'Explain Current Ratio, Debt-Equity Ratio, Gross Profit Ratio, and Return on Equity with worked examples.' },
  { label: 'TDS Provisions', text: 'TDS rates on salary, rent & professional fees', prompt: 'What are TDS rates on salary, rent, and professional fees? How does Form 16 reconciliation work?' },
  { label: 'Cost Accounting', text: 'Break-even point calculation in units and ₹', prompt: 'Calculate Break-Even Point: fixed costs ₹2,00,000, selling price ₹500, variable cost ₹300 per unit.' },
  { label: 'Deductions 80C', text: 'Maximize tax savings under 80C, 80D, 80G', prompt: 'What deductions are available under Section 80C, 80D, and 80G? What are the maximum limits?' },
  { label: 'Credit Purchase', text: 'Record credit purchase entry from supplier', prompt: 'Record a credit purchase of ₹50,000 goods from M/s ABC Traders under GST 18%. Show full double-entry table.' },
  { label: 'Balance Sheet', text: 'Schedule III Balance Sheet format & items', prompt: 'Explain the format of a Balance Sheet under Schedule III of Companies Act. Show a sample table.' },
  { label: 'GST Compliance', text: 'GSTR-1 vs GSTR-3B filing differences', prompt: 'What is the difference between GSTR-1 and GSTR-3B? What are their due dates and filing rules?' }
];

// ── UTILITY FUNCTIONS ─────────────────────────────────────
const esc = s => (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
const now = () => new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
const formatRupee = num => '₹' + Number(num || 0).toLocaleString('en-IN');

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function md(text) {
  if (typeof marked !== 'undefined') return marked.parse(text);
  return '<p>' + esc(text) + '</p>';
}

function scrollThreadToBottom() {
  chatThread.scrollTo({ top: chatThread.scrollHeight, behavior: 'smooth' });
}

// ── STARTER CARDS RANDOMIZER ──────────────────────────────
function renderStarterCards() {
  const selected = [...STARTER_PROMPTS].sort(() => Math.random() - 0.5).slice(0, 4);
  starterGrid.innerHTML = '';
  selected.forEach(item => {
    const card = document.createElement('div');
    card.className = 'starter-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.innerHTML = `
      <span class="starter-label">${item.label}</span>
      <span class="starter-text">${item.text}</span>
    `;
    const handleAction = () => sendMessage(item.prompt);
    card.addEventListener('click', handleAction);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') handleAction(); });
    starterGrid.appendChild(card);
  });
}

// ── SESSIONS MANAGEMENT (MULTI-TURN CHAT HISTORY) ─────────
function loadSessionsFromStorage() {
  try {
    const stored = localStorage.getItem('pocket_ca_sessions');
    if (stored) sessions = JSON.parse(stored);
  } catch (e) { sessions = []; }
  
  if (!sessions.length) {
    createNewSession();
  } else {
    activeSessionId = sessions[0].id;
    renderSessionList();
    renderActiveSessionMessages();
  }
}

function saveSessionsToStorage() {
  try {
    localStorage.setItem('pocket_ca_sessions', JSON.stringify(sessions));
  } catch (e) {}
}

function createNewSession() {
  const newId = 'sess_' + Date.now();
  const newSess = {
    id: newId,
    title: 'New Accounting Session',
    messages: [],
    updatedAt: new Date().toISOString()
  };
  sessions.unshift(newSess);
  activeSessionId = newId;
  saveSessionsToStorage();
  renderSessionList();
  renderActiveSessionMessages();
  // Clear backend memory
  fetch('/api/session/clear', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
}

function getActiveSession() {
  return sessions.find(s => s.id === activeSessionId) || sessions[0];
}

function renderSessionList(filterQuery = '') {
  sessionList.innerHTML = '';
  const filtered = sessions.filter(s => s.title.toLowerCase().includes(filterQuery.toLowerCase()));
  historyCount.textContent = filtered.length;

  filtered.forEach(sess => {
    const item = document.createElement('div');
    item.className = `session-item ${sess.id === activeSessionId ? 'active' : ''}`;
    item.setAttribute('role', 'option');
    item.innerHTML = `
      <span class="session-title-text">${esc(sess.title)}</span>
      <div class="session-actions">
        <button class="btn-session-action btn-rename" title="Rename Session">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
        </button>
        <button class="btn-session-action btn-delete" title="Delete Session">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.btn-rename')) {
        e.stopPropagation();
        openRenameModal(sess.id, sess.title);
        return;
      }
      if (e.target.closest('.btn-delete')) {
        e.stopPropagation();
        deleteSession(sess.id);
        return;
      }
      activeSessionId = sess.id;
      renderSessionList();
      renderActiveSessionMessages();
      closeSidebarMobile();
    });

    sessionList.appendChild(item);
  });
}

function deleteSession(id) {
  sessions = sessions.filter(s => s.id !== id);
  if (!sessions.length) createNewSession();
  else {
    activeSessionId = sessions[0].id;
    saveSessionsToStorage();
    renderSessionList();
    renderActiveSessionMessages();
  }
  showToast('Session deleted');
}

function openRenameModal(id, currentTitle) {
  sessionToRenameId = id;
  renameInput.value = currentTitle;
  renameModal.classList.remove('hidden');
  renameInput.focus();
}

function saveRenameSession() {
  const newTitle = renameInput.value.trim();
  if (newTitle && sessionToRenameId) {
    const sess = sessions.find(s => s.id === sessionToRenameId);
    if (sess) {
      sess.title = newTitle;
      saveSessionsToStorage();
      renderSessionList();
      if (sess.id === activeSessionId) {
        currentSessionTitle.textContent = newTitle;
      }
    }
  }
  renameModal.classList.add('hidden');
}

// ── CHAT MESSAGES RENDERER ────────────────────────────────
function renderActiveSessionMessages() {
  const current = getActiveSession();
  currentSessionTitle.textContent = current.title;
  messagesContainer.innerHTML = '';

  if (!current.messages || !current.messages.length) {
    welcomeScreen.classList.remove('hidden');
  } else {
    welcomeScreen.classList.add('hidden');
    current.messages.forEach(msg => {
      if (msg.role === 'user') appendUserMessageRow(msg.text, msg.time);
      else appendAssistantMessageRow(msg.text, msg.time);
    });
  }
  scrollThreadToBottom();
}

function appendUserMessageRow(text, timeStr = now()) {
  welcomeScreen.classList.add('hidden');
  const row = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `
    <div class="msg-av">You</div>
    <div class="msg-bubble">
      <div class="msg-body">${esc(text)}</div>
      <div class="msg-meta">
        <span class="msg-time">${timeStr}</span>
      </div>
    </div>
  `;
  messagesContainer.appendChild(row);
  scrollThreadToBottom();
}

function appendAssistantMessageRow(text, timeStr = now()) {
  welcomeScreen.classList.add('hidden');
  const row = document.createElement('div');
  row.className = 'msg-row assistant';
  row.innerHTML = `
    <div class="msg-av">CA</div>
    <div class="msg-bubble">
      <div class="msg-body">${md(text)}</div>
      <div class="msg-meta">
        <span class="msg-time">${timeStr}</span>
        <div class="msg-actions">
          <button class="action-btn-sm btn-copy" title="Copy response">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy
          </button>
          <button class="action-btn-sm btn-regen" title="Regenerate response">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg> Retry
          </button>
        </div>
      </div>
    </div>
  `;

  row.querySelector('.btn-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard'));
  });

  row.querySelector('.btn-regen').addEventListener('click', () => {
    const current = getActiveSession();
    if (current.messages.length >= 2) {
      const lastUser = [...current.messages].reverse().find(m => m.role === 'user');
      if (lastUser) sendMessage(lastUser.text);
    }
  });

  messagesContainer.appendChild(row);
  scrollThreadToBottom();
}

// ── STREAMING ASSISTANT ROW ───────────────────────────────
function createStreamingAssistantRow() {
  welcomeScreen.classList.add('hidden');
  const row = document.createElement('div');
  row.className = 'msg-row assistant';
  row.innerHTML = `
    <div class="msg-av">CA</div>
    <div class="msg-bubble">
      <div class="msg-body"><span class="stream-cursor">▍</span></div>
      <div class="msg-meta">
        <span class="msg-time">${now()}</span>
      </div>
    </div>
  `;
  messagesContainer.appendChild(row);
  scrollThreadToBottom();
  return {
    row,
    bodyEl: row.querySelector('.msg-body'),
    metaEl: row.querySelector('.msg-meta')
  };
}

function showTypingIndicator() {
  const row = document.createElement('div');
  row.id = 'typingIndicatorRow';
  row.className = 'typing-row';
  row.innerHTML = `
    <div class="msg-av" style="background:var(--accent-blue-glow);color:var(--accent-blue);">CA</div>
    <div class="typing-dots"><span></span><span></span><span></span></div>
  `;
  messagesContainer.appendChild(row);
  scrollThreadToBottom();
}

function removeTypingIndicator() {
  document.getElementById('typingIndicatorRow')?.remove();
}

// ── MAIN SEND MESSAGE (SSE STREAMING WITH ABORT CONTROLLER) ─
async function sendMessage(textPreset) {
  const text = (textPreset || chatInput.value).trim();
  if (!text || isLoading) return;

  const currentSess = getActiveSession();
  isLoading = true;
  chatInput.value = '';
  updateInputHeightAndCounter();

  // If new chat title, update title automatically based on first message
  if (currentSess.messages.length === 0) {
    currentSess.title = text.length > 28 ? text.slice(0, 28) + '…' : text;
    currentSessionTitle.textContent = currentSess.title;
  }

  // Append User message to memory
  currentSess.messages.push({ role: 'user', text, time: now() });
  saveSessionsToStorage();
  renderSessionList();
  appendUserMessageRow(text);

  showTypingIndicator();
  stopGeneratingWrapper.classList.remove('hidden');

  abortController = new AbortController();
  let streamRowObj = null;
  let fullReplyText = '';

  try {
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
      credentials: 'same-origin',
      signal: abortController.signal
    });

    if (!res.ok || !res.body) {
      removeTypingIndicator();
      showToast(`Server HTTP Error (${res.status})`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        let payload;
        try { payload = JSON.parse(line.slice(6)); } catch (e) { continue; }

        if (payload.error) {
          removeTypingIndicator();
          if (streamRowObj) streamRowObj.row.remove();
          appendAssistantMessageRow(`⚠️ ${payload.error}`);
          return;
        }

        if (payload.chunk) {
          if (!streamRowObj) {
            removeTypingIndicator();
            streamRowObj = createStreamingAssistantRow();
          }
          fullReplyText += payload.chunk;
          streamRowObj.bodyEl.innerHTML = md(fullReplyText) + '<span class="stream-cursor">▍</span>';
          scrollThreadToBottom();
        }

        if (payload.done) {
          if (streamRowObj) {
            streamRowObj.bodyEl.innerHTML = md(fullReplyText);
            // Save to session history
            currentSess.messages.push({ role: 'assistant', text: fullReplyText, time: now() });
            saveSessionsToStorage();
            renderActiveSessionMessages();
          }
        }
      }
    }

  } catch (err) {
    removeTypingIndicator();
    if (err.name === 'AbortError') {
      showToast('Generation stopped by user');
      if (fullReplyText && streamRowObj) {
        currentSess.messages.push({ role: 'assistant', text: fullReplyText + ' *(Stopped)*', time: now() });
        saveSessionsToStorage();
        renderActiveSessionMessages();
      }
    } else {
      showToast('Network error — check internet connection');
    }
  } finally {
    isLoading = false;
    abortController = null;
    stopGeneratingWrapper.classList.add('hidden');
    updateInputHeightAndCounter();
    chatInput.focus();
  }
}

// ── COMPOSER TEXTAREA AUTO-RESIZE & KEYBOARD SHORTCUTS ─────
function updateInputHeightAndCounter() {
  sendBtn.disabled = !chatInput.value.trim() || isLoading;
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
  const len = chatInput.value.length;
  charCounter.textContent = `${len}/4000`;
}

chatInput.addEventListener('input', updateInputHeightAndCounter);

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

sendBtn.addEventListener('click', () => sendMessage());

btnStopGenerating.addEventListener('click', () => {
  if (abortController) abortController.abort();
});

// ── CA UTILITY CALCULATORS LOGIC ──────────────────────────
function calculateGst() {
  const amt = parseFloat(document.getElementById('gstAmount').value) || 0;
  const rate = parseFloat(document.getElementById('gstRate').value) || 0;
  const type = document.getElementById('gstType').value;
  const calcMode = document.getElementById('gstCalculationType').value;

  let base = amt, tax = 0, total = amt;

  if (calcMode === 'exclusive') {
    base = amt;
    tax = (base * rate) / 100;
    total = base + tax;
  } else {
    total = amt;
    base = total / (1 + rate / 100);
    tax = total - base;
  }

  document.getElementById('gstBaseRes').textContent = formatRupee(base);
  document.getElementById('gstTotalRes').textContent = formatRupee(total);

  if (type === 'intra') {
    document.getElementById('cgstRow').classList.remove('hidden');
    document.getElementById('sgstRow').classList.remove('hidden');
    document.getElementById('igstRow').classList.add('hidden');
    document.getElementById('cgstRes').textContent = formatRupee(tax / 2);
    document.getElementById('sgstRes').textContent = formatRupee(tax / 2);
  } else {
    document.getElementById('cgstRow').classList.add('hidden');
    document.getElementById('sgstRow').classList.add('hidden');
    document.getElementById('igstRow').classList.remove('hidden');
    document.getElementById('igstRes').textContent = formatRupee(tax);
  }
}

function calculateDepreciation() {
  const cost = parseFloat(document.getElementById('assetCost').value) || 0;
  const salvage = parseFloat(document.getElementById('salvageValue').value) || 0;
  const rate = parseFloat(document.getElementById('deprRate').value) || 10;
  const years = parseInt(document.getElementById('usefulLife').value) || 5;

  const tableBody = document.getElementById('deprTableBody');
  tableBody.innerHTML = '';

  let wdv = cost;
  for (let y = 1; y <= years; y++) {
    const depr = (wdv * rate) / 100;
    const closing = wdv - depr;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>Year ${y}</td>
      <td>${formatRupee(wdv)}</td>
      <td>${formatRupee(depr)}</td>
      <td>${formatRupee(closing)}</td>
    `;
    tableBody.appendChild(tr);
    wdv = closing;
  }
}

function calculateTaxRegime() {
  const salary = parseFloat(document.getElementById('grossSalary').value) || 0;
  const d80C = parseFloat(document.getElementById('ded80C').value) || 0;
  const d80D = parseFloat(document.getElementById('ded80D').value) || 0;
  const hra = parseFloat(document.getElementById('hraExemption').value) || 0;

  // Simple Old Regime Calc
  const taxableOld = Math.max(0, salary - 50000 - d80C - d80D - hra);
  let oldTax = 0;
  if (taxableOld > 1000000) oldTax = 112500 + (taxableOld - 1000000) * 0.3;
  else if (taxableOld > 500000) oldTax = 12500 + (taxableOld - 500000) * 0.2;
  else if (taxableOld > 250000) oldTax = (taxableOld - 250000) * 0.05;

  // New Regime Calc (Std Ded 75k)
  const taxableNew = Math.max(0, salary - 75000);
  let newTax = 0;
  if (taxableNew > 1500000) newTax = 150000 + (taxableNew - 1500000) * 0.3;
  else if (taxableNew > 1200000) newTax = 90000 + (taxableNew - 1200000) * 0.2;
  else if (taxableNew > 900000) newTax = 45000 + (taxableNew - 900000) * 0.15;
  else if (taxableNew > 600000) newTax = 15000 + (taxableNew - 600000) * 0.1;
  else if (taxableNew > 300000) newTax = (taxableNew - 300000) * 0.05;

  document.getElementById('oldTaxRes').textContent = formatRupee(oldTax * 1.04);
  document.getElementById('newTaxRes').textContent = formatRupee(newTax * 1.04);
}

function calculateRatios() {
  const ca = parseFloat(document.getElementById('currentAssets').value) || 1;
  const cl = parseFloat(document.getElementById('currentLiabilities').value) || 1;
  const debt = parseFloat(document.getElementById('totalDebt').value) || 0;
  const equity = parseFloat(document.getElementById('totalEquity').value) || 1;

  const currRatio = (ca / cl).toFixed(2);
  const debtEq = (debt / equity).toFixed(2);

  document.getElementById('currRatioRes').textContent = `${currRatio} : 1 (${currRatio >= 1.5 ? 'Healthy' : 'Low Liquidity'})`;
  document.getElementById('debtEquityRes').textContent = `${debtEq} : 1 (${debtEq <= 1.5 ? 'Conservative' : 'High Leverage'})`;
}

// Bind Calculator Inputs
['gstAmount', 'gstRate', 'gstType', 'gstCalculationType'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', calculateGst);
  document.getElementById(id)?.addEventListener('input', calculateGst);
});

['assetCost', 'salvageValue', 'deprRate', 'usefulLife'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', calculateDepreciation);
});

['grossSalary', 'ded80C', 'ded80D', 'hraExemption'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', calculateTaxRegime);
});

['currentAssets', 'currentLiabilities', 'totalDebt', 'totalEquity'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', calculateRatios);
});

// "Ask AI about these numbers" triggers
document.getElementById('btnAskAiGst')?.addEventListener('click', () => {
  const amt = document.getElementById('gstAmount').value;
  const rate = document.getElementById('gstRate').value;
  toolsModal.classList.add('hidden');
  sendMessage(`Calculate GST and pass the double-entry journal entry for an invoice of ₹${amt} at ${rate}% GST.`);
});

document.getElementById('btnAskAiDepr')?.addEventListener('click', () => {
  const cost = document.getElementById('assetCost').value;
  const rate = document.getElementById('deprRate').value;
  toolsModal.classList.add('hidden');
  sendMessage(`Generate WDV depreciation schedule and journal entry for asset worth ₹${cost} at ${rate}% rate.`);
});

document.getElementById('btnAskAiTax')?.addEventListener('click', () => {
  const sal = document.getElementById('grossSalary').value;
  toolsModal.classList.add('hidden');
  sendMessage(`Detailed Tax Planning breakdown for annual salary ₹${sal} under Old vs New Tax Regime for FY 2024-25.`);
});

document.getElementById('btnAskAiRatio')?.addEventListener('click', () => {
  const ca = document.getElementById('currentAssets').value;
  const cl = document.getElementById('currentLiabilities').value;
  toolsModal.classList.add('hidden');
  sendMessage(`Perform financial analysis for Current Assets ₹${ca} and Current Liabilities ₹${cl}. Suggest solvency improvements.`);
});

// Modal Tab Switcher
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ── MODAL DIALOGS CONTROLS ────────────────────────────────
btnOpenToolsModal?.addEventListener('click', () => {
  calculateGst(); calculateDepreciation(); calculateTaxRegime(); calculateRatios();
  toolsModal.classList.remove('hidden');
});
btnCloseToolsModal?.addEventListener('click', () => toolsModal.classList.add('hidden'));

btnClearChat?.addEventListener('click', () => clearModal.classList.remove('hidden'));
btnCloseClearModal?.addEventListener('click', () => clearModal.classList.add('hidden'));
btnCancelClear?.addEventListener('click', () => clearModal.classList.add('hidden'));

btnConfirmClear?.addEventListener('click', () => {
  clearModal.classList.add('hidden');
  const current = getActiveSession();
  current.messages = [];
  current.title = 'New Accounting Session';
  saveSessionsToStorage();
  renderSessionList();
  renderActiveSessionMessages();
  fetch('/api/session/clear', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
  showToast('Session reset');
});

btnCloseRenameModal?.addEventListener('click', () => renameModal.classList.add('hidden'));
btnCancelRename?.addEventListener('click', () => renameModal.classList.add('hidden'));
btnSaveRename?.addEventListener('click', saveRenameSession);

// Global Keyboard Shortcuts (Esc to close modal, Ctrl+K for new chat)
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    toolsModal.classList.add('hidden');
    clearModal.classList.add('hidden');
    renameModal.classList.add('hidden');
    closeSidebarMobile();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    createNewSession();
  }
});

// Sidebar Mobile Toggle
function closeSidebarMobile() {
  sidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('open');
}

sidebarToggle?.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  sidebarBackdrop.classList.toggle('open');
});
sidebarBackdrop?.addEventListener('click', closeSidebarMobile);

// Sidebar practice area items & new chat
btnNewChat?.addEventListener('click', createNewSession);

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.prompt) {
      sendMessage(btn.dataset.prompt);
      closeSidebarMobile();
    }
  });
});

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    calculateGst(); calculateDepreciation(); calculateTaxRegime(); calculateRatios();
    toolsModal.classList.remove('hidden');
    const tabTarget = tool === 'gst' ? 'gstTab' : tool === 'depreciation' ? 'deprTab' : tool === 'tax' ? 'taxTab' : 'ratioTab';
    document.querySelector(`.tab-btn[data-tab="${tabTarget}"]`)?.click();
    closeSidebarMobile();
  });
});

btnRefreshStarters?.addEventListener('click', renderStarterCards);

historySearch?.addEventListener('input', e => renderSessionList(e.target.value));

// ── INITIALIZATION ────────────────────────────────────────
(() => {
  renderStarterCards();
  loadSessionsFromStorage();
  updateInputHeightAndCounter();
})();
