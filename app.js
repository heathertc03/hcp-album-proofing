// ===== ADMIN DASHBOARD — app.js =====

let pendingFiles = [];

// ── Load all albums ──────────────────────────────────────────
async function loadAlbums() {
  try {
    const albums = await db.get('albums', '?order=created_at.desc');
    const spreads = await db.get('spreads', '?select=album_id,status&order=position.asc');
    const comments = await db.get('comments', '?select=album_id');

    const grid = document.getElementById('album-grid');
    const loading = document.getElementById('loading-state');
    const empty = document.getElementById('empty-state');

    loading.style.display = 'none';

    if (albums.length === 0) {
      empty.style.display = 'block';
      return;
    }

    // Group spreads and comments by album
    const spreadsByAlbum = {};
    spreads.forEach(s => {
      if (!spreadsByAlbum[s.album_id]) spreadsByAlbum[s.album_id] = [];
      spreadsByAlbum[s.album_id].push(s);
    });
    const commentsByAlbum = {};
    comments.forEach(c => {
      commentsByAlbum[c.album_id] = (commentsByAlbum[c.album_id] || 0) + 1;
    });

    // Render cards
    const cards = albums.map(a => {
      const sp = spreadsByAlbum[a.id] || [];
      const commentCount = commentsByAlbum[a.id] || 0;
      const approved = sp.filter(s => s.status === 'approved').length;
      const changes = sp.filter(s => s.status === 'changes').length;
      const status = sp.length === 0 ? 'empty'
        : changes > 0 ? 'changes'
        : approved === sp.length && sp.length > 0 ? 'approved'
        : 'pending';
      const label = status === 'approved' ? 'All Approved'
        : status === 'changes' ? 'Has Revisions'
        : status === 'empty' ? 'Empty' : 'In Review';
      const badgeCls = status === 'approved' ? 'badge-approved'
        : status === 'changes' ? 'badge-changes' : 'badge-pending';

      return `<div class="album-card" onclick="window.location.href='album.html?id=${a.id}'">
        <div class="album-thumb">
          ${a.cover_url
            ? `<img src="${a.cover_url}" alt="${a.title}">`
            : `<i class="ti ti-photo" style="font-size:24px;color:#555"></i>`}
        </div>
        <div class="album-info">
          <div class="album-name">${a.title}</div>
          <div class="album-client">${a.client}</div>
          <div class="album-meta-row">
            <span class="album-stats">${sp.length} spread${sp.length !== 1 ? 's' : ''} · ${commentCount} note${commentCount !== 1 ? 's' : ''}</span>
            <span class="badge ${badgeCls}">${label}</span>
          </div>
        </div>
      </div>`;
    }).join('');

    grid.innerHTML = `<div class="album-grid-inner">${cards}</div>`;
    grid.style.display = 'block';

  } catch (err) {
    document.getElementById('loading-state').innerHTML = `<span style="color:var(--blush)">Error loading albums: ${err.message}</span>`;
  }
}

// ── Modal ────────────────────────────────────────────────────
function openNewAlbumModal() {
  document.getElementById('new-album-modal').classList.add('open');
  pendingFiles = [];
  document.getElementById('modal-upload-label').textContent = 'Click to select spread images';
  document.getElementById('modal-client').value = '';
  document.getElementById('modal-title-inp').value = '';
  document.getElementById('modal-progress').style.display = 'none';
  document.getElementById('modal-create-btn').disabled = false;
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function previewModalFiles(files) {
  pendingFiles = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
  document.getElementById('modal-upload-label').textContent =
    `${pendingFiles.length} spread${pendingFiles.length !== 1 ? 's' : ''} selected`;
}

// ── Quick upload from dashboard ──────────────────────────────
function handleQuickUpload(files) {
  pendingFiles = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
  document.getElementById('modal-client').value = '';
  document.getElementById('modal-title-inp').value = '';
  document.getElementById('modal-upload-label').textContent =
    `${pendingFiles.length} spread${pendingFiles.length !== 1 ? 's' : ''} selected`;
  openNewAlbumModal();
  document.getElementById('modal-progress').style.display = 'none';
}

// ── Create album + upload spreads ────────────────────────────
async function createAlbum() {
  const client = document.getElementById('modal-client').value.trim() || 'Client';
  const title = document.getElementById('modal-title-inp').value.trim() || 'Untitled Album';
  const btn = document.getElementById('modal-create-btn');
  const progress = document.getElementById('modal-progress');
  const progressBar = document.getElementById('progress-bar');
  const progressLabel = document.getElementById('progress-label');

  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader spin"></i> Creating…';
  progress.style.display = 'block';

  try {
    const albumId = generateId();

    // 1. Create album record
    progressLabel.textContent = 'Creating album…';
    await db.post('albums', { id: albumId, title, client });

    // 2. Upload each spread
    const total = pendingFiles.length;
    let coverUrl = null;

    for (let i = 0; i < total; i++) {
      const file = pendingFiles[i];
      progressLabel.textContent = `Uploading spread ${i + 1} of ${total}…`;
      progressBar.style.width = `${Math.round(((i) / total) * 100)}%`;

      const path = `${albumId}/${generateId()}-${file.name.replace(/\s+/g, '-')}`;
      const publicUrl = await db.uploadImage(path, file);

      if (i === 0) coverUrl = publicUrl;

      await db.post('spreads', {
        id: generateId(),
        album_id: albumId,
        name: file.name,
        src: publicUrl,
        status: 'pending',
        position: i
      });

      progressBar.style.width = `${Math.round(((i + 1) / total) * 100)}%`;
    }

    // 3. Save cover URL on album
    if (coverUrl) {
      await db.patch('albums', albumId, { cover_url: coverUrl });
    }

    progressLabel.textContent = 'Done!';
    progressBar.style.width = '100%';

    setTimeout(() => {
      window.location.href = `album.html?id=${albumId}`;
    }, 400);

  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-plus"></i> Create Album';
    progress.style.display = 'none';
    alert('Something went wrong: ' + err.message);
  }
}
