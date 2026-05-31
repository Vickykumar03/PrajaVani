// ===== CIVIC ALERT APP =====
const API = 'http://localhost:5000/api';

// State
let token = localStorage.getItem('ca_token');
let currentUser = JSON.parse(localStorage.getItem('ca_user') || 'null');
let citizenFilter = 'recent';
let munFilter = 'recent';
let citizenPage = 1;
let munPage = 1;
let citizenTotal = 0;
let munTotal = 0;
let locationCoords = null;
let uploadedImages = [];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  if (token && currentUser) {
    showApp();
    loadCitizenComplaints();
    if (currentUser.role === 'municipality') {
      loadStats();
    }
  }
  bindForms();
});

function bindForms() {
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('registerForm').addEventListener('submit', handleRegister);
  document.getElementById('reportForm').addEventListener('submit', handleReport);
}

// ===== AUTH =====
function switchAuthTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
  event.target.classList.add('active');
  document.getElementById(tab === 'login' ? 'loginForm' : 'registerForm').classList.remove('hidden');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!data.success) return errEl.textContent = data.message;
    saveAuth(data);
    showApp();
    loadCitizenComplaints();
    if (currentUser.role === 'municipality') loadStats();
    showToast('Welcome back, ' + currentUser.name + '!', 'success');
  } catch (err) {
    errEl.textContent = 'Connection error. Is the server running?';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const errEl = document.getElementById('registerError');
  errEl.textContent = '';
  const body = {
    name: document.getElementById('regName').value,
    email: document.getElementById('regEmail').value,
    password: document.getElementById('regPassword').value,
    phone: document.getElementById('regPhone').value,
    ward: document.getElementById('regWard').value,
    role: document.getElementById('regRole').value
  };
  try {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.success) return errEl.textContent = data.message;
    saveAuth(data);
    showApp();
    loadCitizenComplaints();
    if (currentUser.role === 'municipality') loadStats();
    showToast('Account created! Welcome, ' + currentUser.name, 'success');
  } catch (err) {
    errEl.textContent = 'Connection error. Is the server running?';
  }
}

function saveAuth(data) {
  token = data.token;
  currentUser = data.user;
  localStorage.setItem('ca_token', token);
  localStorage.setItem('ca_user', JSON.stringify(currentUser));
}

function logout() {
  token = null; currentUser = null;
  localStorage.removeItem('ca_token');
  localStorage.removeItem('ca_user');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('authModal').classList.remove('hidden');
  document.getElementById('authModal').classList.add('active');
}

function showApp() {
  document.getElementById('authModal').classList.remove('active');
  document.getElementById('authModal').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('headerUser').textContent = `${currentUser.name} (${currentUser.role})`;
  if (currentUser.ward) document.getElementById('headerWard').textContent = currentUser.ward;
  // Hide municipality nav if citizen
  if (currentUser.role === 'citizen') {
    document.getElementById('btnMunicipality').style.opacity = '0.5';
  }
}

// ===== BOARD SWITCHING =====
function switchBoard(board) {
  if (board === 'municipality' && currentUser.role !== 'municipality') {
    showToast('Access restricted to municipality officers', 'error');
    return;
  }
  document.querySelectorAll('.board').forEach(b => { b.classList.remove('active'); b.classList.add('hidden'); });
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(board === 'citizen' ? 'citizenBoard' : 'municipalityBoard').classList.remove('hidden');
  document.getElementById(board === 'citizen' ? 'citizenBoard' : 'municipalityBoard').classList.add('active');
  document.getElementById(board === 'citizen' ? 'btnCitizen' : 'btnMunicipality').classList.add('active');
  if (board === 'municipality') {
    loadMunicipalityComplaints();
    loadStats();
  }
}

// ===== FILTERS =====
function setCitizenFilter(f) {
  citizenFilter = f;
  citizenPage = 1;
  document.querySelectorAll('#citizenBoard .filter-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === f);
  });
  loadCitizenComplaints();
}

function setMunFilter(f) {
  munFilter = f;
  munPage = 1;
  document.querySelectorAll('#municipalityBoard .filter-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === f);
  });
  loadMunicipalityComplaints();
}

// ===== LOAD CITIZEN COMPLAINTS =====
async function loadCitizenComplaints() {
  citizenPage = 1;
  const category = document.getElementById('citizenCategoryFilter').value;
  const status = document.getElementById('citizenStatusFilter').value;
  const grid = document.getElementById('citizenGrid');
  grid.innerHTML = '<div class="empty-state"><div class="skeleton" style="height:200px;border-radius:8px;grid-column:1/-1"></div></div>';
  try {
    let url = `${API}/complaints?filter=${citizenFilter}&page=1&limit=12`;
    if (category) url += `&category=${category}`;
    if (status) url += `&status=${status}`;
    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    citizenTotal = data.total;
    document.getElementById('citizenCount').textContent = `${data.total} reports`;
    grid.innerHTML = '';
    if (!data.complaints.length) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No complaints found. Be the first to report!</p></div>';
      return;
    }
    data.complaints.forEach(c => grid.appendChild(buildCitizenCard(c)));
    const loadMore = document.getElementById('citizenLoadMore');
    loadMore.classList.toggle('hidden', data.complaints.length >= data.total);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠</div><p>${err.message}</p></div>`;
  }
}

async function loadMoreCitizen() {
  citizenPage++;
  const category = document.getElementById('citizenCategoryFilter').value;
  const status = document.getElementById('citizenStatusFilter').value;
  let url = `${API}/complaints?filter=${citizenFilter}&page=${citizenPage}&limit=12`;
  if (category) url += `&category=${category}`;
  if (status) url += `&status=${status}`;
  const res = await fetch(url, { headers: authHeaders() });
  const data = await res.json();
  const grid = document.getElementById('citizenGrid');
  data.complaints.forEach(c => grid.appendChild(buildCitizenCard(c)));
  const loaded = grid.querySelectorAll('.complaint-card').length;
  document.getElementById('citizenLoadMore').classList.toggle('hidden', loaded >= citizenTotal);
}

// ===== LOAD MUNICIPALITY COMPLAINTS =====
async function loadMunicipalityComplaints() {
  munPage = 1;
  const category = document.getElementById('munCategoryFilter').value;
  const status = document.getElementById('munStatusFilter').value;
  const severity = document.getElementById('munSeverityFilter').value;
  const grid = document.getElementById('municipalityGrid');
  grid.innerHTML = '<div class="empty-state"><div class="skeleton" style="height:200px;grid-column:1/-1;border-radius:8px"></div></div>';
  try {
    let url = `${API}/municipality/dashboard?filter=${munFilter}&page=1&limit=12`;
    if (category) url += `&category=${category}`;
    if (status) url += `&status=${status}`;
    if (severity) url += `&severity=${severity}`;
    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    munTotal = data.total;
    document.getElementById('munCount').textContent = `${data.total} reports`;
    grid.innerHTML = '';
    if (!data.complaints.length) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>No complaints match the current filters.</p></div>';
      return;
    }
    data.complaints.forEach(c => grid.appendChild(buildMunicipalityCard(c)));
    document.getElementById('munLoadMore').classList.toggle('hidden', data.complaints.length >= data.total);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠</div><p>${err.message}</p></div>`;
  }
}

async function loadMoreMun() {
  munPage++;
  const category = document.getElementById('munCategoryFilter').value;
  const status = document.getElementById('munStatusFilter').value;
  const severity = document.getElementById('munSeverityFilter').value;
  let url = `${API}/municipality/dashboard?filter=${munFilter}&page=${munPage}&limit=12`;
  if (category) url += `&category=${category}`;
  if (status) url += `&status=${status}`;
  if (severity) url += `&severity=${severity}`;
  const res = await fetch(url, { headers: authHeaders() });
  const data = await res.json();
  const grid = document.getElementById('municipalityGrid');
  data.complaints.forEach(c => grid.appendChild(buildMunicipalityCard(c)));
  const loaded = grid.querySelectorAll('.complaint-card').length;
  document.getElementById('munLoadMore').classList.toggle('hidden', loaded >= munTotal);
}

// ===== LOAD STATS =====
async function loadStats() {
  try {
    const res = await fetch(`${API}/municipality/stats`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success) return;
    const s = data.stats;
    document.getElementById('statsBar').innerHTML = `
      <div class="stat-card stat-total"><div class="stat-num">${s.totalComplaints}</div><div class="stat-label">Total Reports</div></div>
      <div class="stat-card stat-pending"><div class="stat-num">${s.pendingCount}</div><div class="stat-label">Pending</div></div>
      <div class="stat-card stat-progress"><div class="stat-num">${s.inProgressCount}</div><div class="stat-label">In Progress</div></div>
      <div class="stat-card stat-resolved"><div class="stat-num">${s.resolvedCount}</div><div class="stat-label">Resolved</div></div>
      <div class="stat-card" style="border-color:rgba(39,199,110,0.3)"><div class="stat-num" style="color:var(--green)">${s.verifiedDone}</div><div class="stat-label">✅ Verified Done</div></div>
      <div class="stat-card" style="border-color:rgba(232,64,64,0.3)"><div class="stat-num" style="color:var(--red)">${s.notDone}</div><div class="stat-label">❌ Not Done</div></div>
    `;
  } catch (err) { /* silent */ }
}

// ===== BUILD CITIZEN CARD =====
function buildCitizenCard(c) {
  const card = document.createElement('div');
  card.className = `complaint-card severity-${c.severity}`;
  card.dataset.id = c._id;

  const isResolved = c.status === 'resolved';
  const yesVotes = c.workDoneVotes?.yes?.length || 0;
  const noVotes = c.workDoneVotes?.no?.length || 0;
  const totalVotes = yesVotes + noVotes;
  const verifyStatus = c.workVerificationStatus || 'pending';
  const userVotedYes = currentUser && c.workDoneVotes?.yes?.includes(currentUser.id);
  const userVotedNo = currentUser && c.workDoneVotes?.no?.includes(currentUser.id);
  const userUpvoted = currentUser && c.upvotes?.includes(currentUser.id);

  let verifyHtml = '';
  if (isResolved) {
    const dotClass = verifyStatus === 'verified_done' ? 'dot-green' : verifyStatus === 'not_done' ? 'dot-red' : 'dot-gray';
    const barClass = verifyStatus === 'verified_done' ? 'verified' : verifyStatus === 'not_done' ? 'not-done' : 'pending';
    const label = verifyStatus === 'verified_done' ? '✅ Work Verified Complete' : verifyStatus === 'not_done' ? '❌ Work Not Done' : '⏳ Pending Citizen Verification';
    verifyHtml = `
      <div class="work-verify-bar ${barClass}">
        <div class="verify-dot ${dotClass}"></div>
        <span>${label}</span>
        <span style="margin-left:auto;font-size:0.7rem;color:var(--text3)">${totalVotes} votes</span>
      </div>
      ${currentUser && currentUser.role === 'citizen' ? `
      <div class="vote-btns">
        <button class="vote-btn yes ${userVotedYes ? 'voted-yes' : ''}" onclick="voteWork(event,'${c._id}','yes')">
          ✅ Done (${yesVotes})
        </button>
        <button class="vote-btn no ${userVotedNo ? 'voted-no' : ''}" onclick="voteWork(event,'${c._id}','no')">
          ❌ Not Done (${noVotes})
        </button>
      </div>` : ''}
    `;
  }

  card.innerHTML = `
    <div class="card-header">
      <span class="card-category">${categoryIcon(c.category)} ${formatCategory(c.category)}</span>
      <span class="card-id">${c.complaintId || 'ID-N/A'}</span>
    </div>
    <div class="card-title">${escHtml(c.title)}</div>
    <div class="card-desc">${escHtml(c.description)}</div>
    <div class="card-location">📍 ${escHtml(c.location?.address || c.location?.ward || 'Location recorded')}</div>
    <div class="card-meta">
      <span class="status-badge status-${c.status}">${formatStatus(c.status)}</span>
      <span class="severity-tag sev-${c.severity}">${c.severity}</span>
      <span class="card-time">${timeAgo(c.createdAt)}</span>
      <button class="card-upvote ${userUpvoted ? 'upvoted' : ''}" onclick="upvote(event,'${c._id}',this)">
        ▲ <span>${c.upvotes?.length || 0}</span>
      </button>
    </div>
    ${verifyHtml}
  `;
  card.addEventListener('click', (e) => {
    if (!e.target.closest('button')) openDetail(c._id);
  });
  return card;
}

// ===== BUILD MUNICIPALITY CARD =====
function buildMunicipalityCard(c) {
  const card = document.createElement('div');
  card.className = `complaint-card severity-${c.severity}`;

  const reporter = c.reportedBy;
  const yesVotes = c.workDoneVotes?.yes?.length || 0;
  const noVotes = c.workDoneVotes?.no?.length || 0;
  const verifyStatus = c.workVerificationStatus || 'pending';
  const dotClass = verifyStatus === 'verified_done' ? 'dot-green' : verifyStatus === 'not_done' ? 'dot-red' : 'dot-gray';
  const barClass = verifyStatus === 'verified_done' ? 'verified' : verifyStatus === 'not_done' ? 'not-done' : 'pending';

  card.innerHTML = `
    <div class="card-header">
      <span class="card-category">${categoryIcon(c.category)} ${formatCategory(c.category)}</span>
      <span class="card-id">${c.complaintId || 'ID-N/A'}</span>
    </div>
    <div class="card-title">${escHtml(c.title)}</div>
    <div class="card-desc">${escHtml(c.description)}</div>
    <div class="card-location">📍 ${escHtml(c.location?.address || c.location?.ward || '')} | 👤 ${reporter?.name || 'Unknown'} ${reporter?.ward ? '· ' + reporter.ward : ''}</div>
    <div class="card-meta">
      <span class="status-badge status-${c.status}">${formatStatus(c.status)}</span>
      <span class="severity-tag sev-${c.severity}">${c.severity}</span>
      <span class="card-time">${timeAgo(c.createdAt)}</span>
      <span style="margin-left:auto;font-size:0.7rem;color:var(--text3)">▲ ${c.upvotes?.length || 0}</span>
    </div>
    <div class="work-verify-bar ${barClass}" style="margin-top:10px">
      <div class="verify-dot ${dotClass}"></div>
      <span style="font-size:0.75rem">${verifyStatus === 'verified_done' ? '✅ Verified Done' : verifyStatus === 'not_done' ? '❌ Not Done' : '⏳ Awaiting Verification'}</span>
      <span style="margin-left:auto;font-size:0.7rem;color:var(--text3)">Yes: ${yesVotes} / No: ${noVotes}</span>
    </div>
    <div class="mun-actions" id="actions-${c._id}">
      ${['pending','in_progress','resolved','rejected'].map(s =>
        `<button class="status-btn ${c.status===s?'active-btn':''}" onclick="updateStatus(event,'${c._id}','${s}',this)">${formatStatus(s)}</button>`
      ).join('')}
    </div>
    <textarea class="note-input" id="note-${c._id}" placeholder="Add municipality notes..." rows="2">${escHtml(c.municipalityNotes || '')}</textarea>
    <button class="save-note-btn" onclick="saveNote(event,'${c._id}')">Save Note</button>
  `;
  return card;
}

// ===== ACTIONS =====
async function upvote(e, id, btn) {
  e.stopPropagation();
  if (!token) return showToast('Please login to upvote', 'error');
  try {
    const res = await fetch(`${API}/complaints/${id}/upvote`, {
      method: 'POST', headers: authHeaders()
    });
    const data = await res.json();
    if (!data.success) return showToast(data.message, 'error');
    btn.querySelector('span').textContent = data.upvotes;
    btn.classList.toggle('upvoted', data.upvoted);
  } catch (err) { showToast('Error', 'error'); }
}

async function voteWork(e, id, vote) {
  e.stopPropagation();
  if (!token) return showToast('Please login to vote', 'error');
  try {
    const res = await fetch(`${API}/complaints/${id}/vote-work`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote })
    });
    const data = await res.json();
    if (!data.success) return showToast(data.message, 'error');
    showToast('Vote recorded! ' + (data.workVerificationStatus === 'verified_done' ? '✅ Work verified done' : '❌ Work not done'), 'success');
    loadCitizenComplaints();
  } catch (err) { showToast('Error voting', 'error'); }
}

async function updateStatus(e, id, status, btn) {
  e.stopPropagation();
  try {
    const noteEl = document.getElementById(`note-${id}`);
    const res = await fetch(`${API}/municipality/${id}/status`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, municipalityNotes: noteEl?.value || '' })
    });
    const data = await res.json();
    if (!data.success) return showToast(data.message, 'error');
    // Update UI
    const actionsDiv = document.getElementById(`actions-${id}`);
    actionsDiv.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active-btn'));
    btn.classList.add('active-btn');
    showToast(`Status updated to: ${formatStatus(status)}`, 'success');
    loadStats();
  } catch (err) { showToast('Error updating status', 'error'); }
}

async function saveNote(e, id) {
  e.stopPropagation();
  const noteEl = document.getElementById(`note-${id}`);
  try {
    const res = await fetch(`${API}/municipality/${id}/status`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ municipalityNotes: noteEl.value })
    });
    const data = await res.json();
    if (!data.success) return showToast(data.message, 'error');
    showToast('Note saved!', 'success');
  } catch (err) { showToast('Error saving note', 'error'); }
}

// ===== REPORT MODAL =====
function openReportModal() {
  if (!token) return showToast('Please login first', 'error');
  document.getElementById('reportModal').classList.remove('hidden');
  document.getElementById('reportModal').classList.add('active');
  document.getElementById('reportError').textContent = '';
}

function closeReportModal() {
  document.getElementById('reportModal').classList.add('hidden');
  document.getElementById('reportModal').classList.remove('active');
  document.getElementById('reportForm').reset();
  document.getElementById('imagePreviews').innerHTML = '';
  uploadedImages = [];
  locationCoords = null;
  document.getElementById('locationStatus').textContent = 'Location not set';
  document.getElementById('locationStatus').className = 'location-status';
}

function getLocation() {
  if (!navigator.geolocation) {
    document.getElementById('locationStatus').textContent = 'Geolocation not supported';
    document.getElementById('locationStatus').className = 'location-status error';
    return;
  }
  document.getElementById('locationStatus').textContent = 'Getting your location...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locationCoords = [pos.coords.longitude, pos.coords.latitude];
      document.getElementById('rLat').value = pos.coords.latitude;
      document.getElementById('rLng').value = pos.coords.longitude;
      document.getElementById('locationStatus').textContent = `📍 ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} — Accuracy: ±${Math.round(pos.coords.accuracy)}m`;
      document.getElementById('locationStatus').className = 'location-status success';
      // Try reverse geocode
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
        .then(r => r.json()).then(d => {
          const addr = d.display_name || '';
          document.getElementById('rAddress').value = addr.split(',').slice(0,3).join(',');
          document.getElementById('rCity').value = d.address?.city || d.address?.town || d.address?.village || 'Jamshedpur';
          document.getElementById('rWard').value = d.address?.suburb || d.address?.neighbourhood || '';
        }).catch(() => {});
    },
    (err) => {
      document.getElementById('locationStatus').textContent = 'Could not get location: ' + err.message;
      document.getElementById('locationStatus').className = 'location-status error';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function previewImages(e) {
  const files = Array.from(e.target.files).slice(0, 3);
  const previews = document.getElementById('imagePreviews');
  previews.innerHTML = '';
  uploadedImages = [];
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      uploadedImages.push({ data: base64, contentType: file.type });
      const img = document.createElement('img');
      img.src = base64;
      previews.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

async function handleReport(e) {
  e.preventDefault();
  const errEl = document.getElementById('reportError');
  errEl.textContent = '';

  const lat = parseFloat(document.getElementById('rLat').value);
  const lng = parseFloat(document.getElementById('rLng').value);
  if (!lat || !lng) {
    errEl.textContent = 'Please set your location using the "Use My Location" button.';
    return;
  }

  const body = {
    title: document.getElementById('rTitle').value,
    description: document.getElementById('rDescription').value,
    category: document.getElementById('rCategory').value,
    severity: document.getElementById('rSeverity').value,
    location: {
      coordinates: [lng, lat],
      address: document.getElementById('rAddress').value,
      ward: document.getElementById('rWard').value,
      city: document.getElementById('rCity').value,
      state: 'Jharkhand'
    },
    images: uploadedImages
  };

  try {
    const submitBtn = e.target.querySelector('[type="submit"]');
    submitBtn.textContent = 'Submitting...'; submitBtn.disabled = true;
    const res = await fetch(`${API}/complaints`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    submitBtn.textContent = 'Submit Report →'; submitBtn.disabled = false;
    if (!data.success) return errEl.textContent = data.message;
    showToast(`Report filed! ID: ${data.complaint.complaintId}`, 'success');
    closeReportModal();
    loadCitizenComplaints();
    if (currentUser.role === 'municipality') loadMunicipalityComplaints();
  } catch (err) {
    document.querySelector('[type="submit"]').textContent = 'Submit Report →';
    document.querySelector('[type="submit"]').disabled = false;
    errEl.textContent = 'Connection error.';
  }
}

// ===== DETAIL MODAL =====
async function openDetail(id) {
  document.getElementById('detailModal').classList.remove('hidden');
  document.getElementById('detailModal').classList.add('active');
  document.getElementById('detailContent').innerHTML = '<div class="skeleton" style="height:200px;border-radius:8px"></div>';
  try {
    const res = await fetch(`${API}/complaints/${id}`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    const c = data.complaint;
    document.getElementById('detailTitle').textContent = c.title;
    const [lng, lat] = c.location.coordinates;
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const yesVotes = c.workDoneVotes?.yes?.length || 0;
    const noVotes = c.workDoneVotes?.no?.length || 0;
    document.getElementById('detailContent').innerHTML = `
      <div class="card-meta" style="margin-bottom:16px">
        <span class="status-badge status-${c.status}">${formatStatus(c.status)}</span>
        <span class="severity-tag sev-${c.severity}">${c.severity}</span>
        <span class="card-category">${categoryIcon(c.category)} ${formatCategory(c.category)}</span>
        <span class="card-id">${c.complaintId}</span>
      </div>
      <div class="detail-field"><label>Description</label><p>${escHtml(c.description)}</p></div>
      <div class="detail-field"><label>📍 Location</label>
        <p>${escHtml(c.location.address || '')} ${c.location.ward ? '— ' + c.location.ward : ''} ${c.location.city ? ', ' + c.location.city : ''}</p>
        <span class="detail-coords">GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}</span>
        <a href="${mapsUrl}" target="_blank" class="map-link" style="margin-left:10px">🗺 Open in Maps</a>
      </div>
      <div class="detail-field"><label>Reported By</label><p>${c.reportedBy?.name || 'Unknown'} ${c.reportedBy?.ward ? '· ' + c.reportedBy.ward : ''}</p></div>
      <div class="detail-field"><label>Filed On</label><p>${new Date(c.createdAt).toLocaleString()}</p></div>
      ${c.municipalityNotes ? `<div class="detail-field"><label>Municipality Notes</label><p>${escHtml(c.municipalityNotes)}</p></div>` : ''}
      ${c.status === 'resolved' ? `
        <div class="detail-field"><label>Citizen Work Verification</label>
          <div class="work-verify-bar ${c.workVerificationStatus === 'verified_done' ? 'verified' : c.workVerificationStatus === 'not_done' ? 'not-done' : 'pending'}">
            <div class="verify-dot ${c.workVerificationStatus === 'verified_done' ? 'dot-green' : c.workVerificationStatus === 'not_done' ? 'dot-red' : 'dot-gray'}"></div>
            <span>${c.workVerificationStatus === 'verified_done' ? '✅ Work Verified Complete' : c.workVerificationStatus === 'not_done' ? '❌ Work Not Done' : '⏳ Awaiting Votes'}</span>
          </div>
          <p style="font-size:0.8rem;color:var(--text2);margin-top:6px">Votes: ✅ ${yesVotes} Yes | ❌ ${noVotes} No</p>
        </div>` : ''}
      ${c.images?.length ? `
        <div class="detail-field"><label>Photos</label>
          <div class="detail-images">${c.images.map(img => `<img src="${img.data}" alt="evidence">`).join('')}</div>
        </div>` : ''}
      <div class="modal-actions" style="margin-top:16px">
        <button class="btn-secondary" onclick="closeDetailModal()">Close</button>
        <a href="${mapsUrl}" target="_blank" class="btn-primary" style="text-decoration:none;display:inline-block;padding:12px 20px">📍 View on Map</a>
      </div>
    `;
  } catch (err) {
    document.getElementById('detailContent').innerHTML = `<p style="color:var(--red)">${err.message}</p>`;
  }
}

function closeDetailModal() {
  document.getElementById('detailModal').classList.add('hidden');
  document.getElementById('detailModal').classList.remove('active');
}

// ===== HELPERS =====
function authHeaders() {
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  setTimeout(() => t.classList.add('hidden'), 3500);
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const m = Math.floor(diff/60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

function formatStatus(s) {
  return { pending: '⏳ Pending', in_progress: '🔧 In Progress', resolved: '✅ Resolved', rejected: '❌ Rejected' }[s] || s;
}

function formatCategory(c) {
  return { pothole: 'Pothole', road_damage: 'Road Damage', electricity: 'Electricity', water_shortage: 'Water', drainage: 'Drainage', streetlight: 'Streetlight', garbage: 'Garbage', other: 'Other' }[c] || c;
}

function categoryIcon(c) {
  return { pothole: '🕳', road_damage: '🛣', electricity: '⚡', water_shortage: '💧', drainage: '🌊', streetlight: '💡', garbage: '🗑', other: '📌' }[c] || '📌';
}
