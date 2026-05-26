// ===== ALBUM VIEWER — viewer.js =====

let album = null;
let spreads = [];
let comments = [];
let currentIndex = 0;
let albumId = null;
let isAdmin = false;

// ── Init ─────────────────────────────────────────────────────
async function initViewer() {
  const params = new URLSearchParams(window.location.search);
  albumId = params.get('id');
  isAdmin = params.get('admin') === '1';

  if (!albumId) {
    document.getElementById('spread-display').innerHTML =
      '<span style="color:#888;font-family:\'Cormorant Garamond\',serif;font-style:italic">No album specified.</span>';
    return;
  }

  // Show admin-only controls
  if (isAdmin) {
    document.getElementById('btn-add-spreads').style.display = '';
  }

  await loadAlbumData();

  // Poll for new comments every 15s (so photographer sees client activity)
  setInterval(refreshComments, 15000);
}

async function loadAlbumData() {
  try {
    const [albumArr, spreadArr, commentArr] = await Promise.all([
      db.get('albums', `?id=eq.${albumId}`),
      db.get('spreads', `?album_id=eq.${albumId}&order=position.asc`),
      db.get('comments', `?album_id=eq.${albumId}&order=created_at.asc`)
    ]);

    if (!albumArr.length) {
      document.getElementById('spread-display').innerHTML =
        '<span style="color:#888;font-family:\'Cormorant Garamond\',serif;font-style:italic">Album not found.</span>';
      return;
    }

    album = albumArr[0];
    spreads = spreadArr;
    comments = commentArr;

    // Set header title
    document.getElementById('album-title-header').textContent =
      `${album.client} — ${album.title}`;
    document.title = `${album.title} · Heather Carraway Photography`;

    // Set share URL
    const shareUrl = `${window.location.origin}/album.html?id=${albumId}`;
    document.getElementById('share-url').textContent = shareUrl;

    renderViewer();
  } catch (err) {
    document.getElementById('spread-display').innerHTML =
      `<span style="color:var(--blush);font-size:13px">Error: ${err.message}</span>`;
  }
}

async function refreshComments() {
  try {
    comments = await db.get('comments', `?album_id=eq.${albumId}&order=created_at.asc`);
    renderSpreadComments();
    updateTabCount();
  } catch (e) { /* silent fail */ }
}

// ── Rendering ────────────────────────────────────────────────
function renderViewer() {
  renderSpread();
  renderThumbs();
  renderStatus();
  renderSpreadComments();
  updateTabCount();
}

function renderSpread() {
  const display = document.getElementById('spread-display');
  if (!spreads.length) {
    display.innerHTML = '<span style="color:#888;font-family:\'Cormorant Garamond\',serif;font-style:italic">No spreads in this album yet.</span>';
    document.getElementById('spread-counter').textContent = '—';
    document.getElementById('btn-prev').disabled = true;
    document.getElementById('btn-next').disabled = true;
    return;
  }
  const s = spreads[currentIndex];
  display.innerHTML = `<img src="${s.src}" alt="Spread ${currentIndex + 1}" style="max-width:100%;max-height:100%;object-fit:contain">`;
  document.getElementById('spread-counter').textContent = `Spread ${currentIndex + 1} of ${spreads.length}`;
  document.getElementById('btn-prev').disabled = currentIndex === 0;
  document.getElementById('btn-next').disabled = currentIndex >= spreads.length - 1;
}

function renderThumbs() {
  const strip = document.getElementById('thumb-strip');
  if (!spreads.length) { strip.innerHTML = '<span class="no-data">No spreads yet</span>'; return; }
  strip.innerHTML = spreads.map((s, i) => `
    <div class="thumb ${i === currentIndex ? 'active' : ''}" onclick="goTo(${i})" title="Spread ${i+1}">
      <img src="${s.src}" alt="">
      <span class="thumb-num">${i + 1}</span>
      ${s.status !== 'pending' ? `<span class="thumb-status ${s.status}"></span>` : ''}
    </div>`).join('');
}

function renderStatus() {
  if (!spreads.length) return;
  const s = spreads[currentIndex];
  const badge = document.getElementById('status-badge');
  badge.textContent = s.status === 'approved' ? 'Approved' : s.status === 'changes' ? 'Revision Needed' : 'Pending';
  badge.className = 'badge ' + (s.status === 'approved' ? 'badge-approved' : s.status === 'changes' ? 'badge-changes' : 'badge-pending');
  document.getElementById('btn-approve').classList.toggle('active', s.status === 'approved');
  document.getElementById('btn-changes').classList.toggle('active', s.status === 'changes');
}

function renderSpreadComments() {
  const cont = document.getElementById('spread-comments');
  if (!spreads.length) { cont.innerHTML = '<span class="no-data">No notes yet</span>'; return; }
  const sid = spreads[currentIndex].id;
  const cs = comments.filter(c => c.spread_id === sid);
  if (!cs.length) { cont.innerHTML = '<span class="no-data">No notes yet</span>'; return; }
  cont.innerHTML = cs.map(c => `
    <div class="comment ${c.author !== 'You' ? 'client-comment' : ''}">
      <div class="comment-meta">
        <span class="comment-author">${c.author}</span>
        <span class="comment-time">${new Date(c.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
      </div>
      <div class="comment-text">${c.text}</div>
    </div>`).join('');
  cont.scrollTop = cont.scrollHeight;
}

function updateTabCount() {
  document.getElementById('comment-count').textContent = comments.length;
}

// ── Navigation ───────────────────────────────────────────────
function goTo(i) { currentIndex = i; renderViewer(); }
function prevSpread() { if (currentIndex > 0) { currentIndex--; renderViewer(); } }
function nextSpread() { if (currentIndex < spreads.length - 1) { currentIndex++; renderViewer(); } }

// ── Status update ────────────────────────────────────────────
async function setStatus(s) {
  if (!spreads.length) return;
  const spread = spreads[currentIndex];
  const newStatus = spread.status === s ? 'pending' : s;

  try {
    await db.patch('spreads', spread.id, { status: newStatus });
    spread.status = newStatus;
    renderStatus();
    renderThumbs();
  } catch (err) {
    alert('Could not save status: ' + err.message);
  }
}

// ── Add comment ──────────────────────────────────────────────
async function addComment() {
  if (!spreads.length) return;
  const text = document.getElementById('comment-text').value.trim();
  const nameInput = document.getElementById('commenter-name');
  const author = nameInput ? (nameInput.value.trim() || 'Client') : 'You';
  if (!text) return;

  const spread = spreads[currentIndex];

  try {
    const [newComment] = await db.post('comments', {
      id: generateId(),
      album_id: albumId,
      spread_id: spread.id,
      spread_num: currentIndex + 1,
      author,
      text
    });

    comments.push(newComment);
    document.getElementById('comment-text').value = '';
    renderSpreadComments();
    updateTabCount();
  } catch (err) {
    alert('Could not save comment: ' + err.message);
  }
}

// ── Add more spreads (admin only) ─────────────────────────────
async function handleSpreadUpload(files) {
  const sorted = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
  const startPos = spreads.length;

  for (let i = 0; i < sorted.length; i++) {
    const file = sorted[i];
    const path = `${albumId}/${generateId()}-${file.name.replace(/\s+/g, '-')}`;
    const publicUrl = await db.uploadImage(path, file);
    const [spread] = await db.post('spreads', {
      id: generateId(),
      album_id: albumId,
      name: file.name,
      src: publicUrl,
      status: 'pending',
      position: startPos + i
    });
    spreads.push(spread);
  }

  renderViewer();
}

// ── Tabs ──────────────────────────────────────────────────────
function switchTab(t) {
  ['viewer', 'comments', 'summary'].forEach(k => {
    document.getElementById('tab-' + k).classList.toggle('active', k === t);
  });
  document.getElementById('view-viewer').style.display = t === 'viewer' ? 'block' : 'none';
  document.getElementById('view-comments').style.display = t === 'comments' ? 'block' : 'none';
  document.getElementById('view-summary').style.display = t === 'summary' ? 'block' : 'none';
  if (t === 'comments') renderAllComments();
  if (t === 'summary') renderSummary();
}

function renderAllComments() {
  const cont = document.getElementById('all-comments-list');
  if (!comments.length) { cont.innerHTML = '<span class="no-data">No comments yet.</span>'; return; }
  cont.innerHTML = comments.map(c => `
    <div class="comment" style="margin-bottom:10px;cursor:pointer" onclick="goTo(${c.spread_num - 1});switchTab('viewer')">
      <div class="comment-meta">
        <span class="comment-author">${c.author}</span>
        <span class="comment-time">${new Date(c.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
      </div>
      <div class="comment-text">${c.text}</div>
      <div class="comment-spread-label">Spread ${c.spread_num}</div>
    </div>`).join('');
}

function renderSummary() {
  const approved = spreads.filter(s => s.status === 'approved').length;
  const changes = spreads.filter(s => s.status === 'changes').length;
  document.getElementById('sum-total').textContent = spreads.length;
  document.getElementById('sum-approved').textContent = approved;
  document.getElementById('sum-changes').textContent = changes;
  document.getElementById('sum-comments').textContent = comments.length;

  document.getElementById('summary-spread-list').innerHTML = spreads.map((s, i) => {
    const cs = comments.filter(c => c.spread_id === s.id);
    const col = s.status === 'approved' ? 'var(--sage)' : s.status === 'changes' ? 'var(--blush)' : 'var(--taupe)';
    return `<div class="summary-row" onclick="goTo(${i});switchTab('viewer')">
      <img src="${s.src}" style="width:56px;height:28px;object-fit:cover;background:#1a1715">
      <div style="flex:1">
        <div class="summary-spread-name">Spread ${i + 1}</div>
        <div class="summary-comment-count">${cs.length} comment${cs.length !== 1 ? 's' : ''}</div>
      </div>
      <span class="summary-status" style="color:${col}">${s.status === 'approved' ? 'Approved' : s.status === 'changes' ? 'Revision' : 'Pending'}</span>
    </div>`;
  }).join('');
}

function copyLink() {
  const url = document.getElementById('share-url').textContent;
  navigator.clipboard.writeText(url).catch(() => {});
  const btn = event.currentTarget;
  btn.innerHTML = '<i class="ti ti-check" style="font-size:13px;color:var(--sage)"></i>';
  setTimeout(() => { btn.innerHTML = '<i class="ti ti-copy" style="font-size:13px"></i>'; }, 1500);
}

function exportSummary() {
  if (!album) return;
  let txt = `ALBUM PROOF SUMMARY\n${'—'.repeat(40)}\n${album.title}\n${album.client}\nExported: ${new Date().toLocaleDateString()}\n\n`;
  spreads.forEach((s, i) => {
    const cs = comments.filter(c => c.spread_id === s.id);
    txt += `Spread ${i + 1}: ${s.status.toUpperCase()}\n`;
    cs.forEach(c => txt += `  ${c.author}: ${c.text}\n`);
    txt += '\n';
  });
  const blob = new Blob([txt], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${album.title.replace(/\s+/g, '-')}-proof-summary.txt`;
  a.click();
}
