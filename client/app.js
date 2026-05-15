/**
 * DELTARESERVE — Client JavaScript
 * Plateforme de Réservation Intelligente
 */

const API = '/api';
const GQL = '/graphql';

// ============================================
// Navigation
// ============================================

function navigate(section) {
  document.querySelectorAll('.page-section').forEach(s => {
    s.classList.add('d-none');
    s.classList.remove('active');
  });
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  
  const sectionEl = document.getElementById(`section-${section}`);
  sectionEl.classList.remove('d-none');
  sectionEl.classList.add('active');
  
  const navBtn = document.querySelector(`[data-section="${section}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Load data for section
  if (section === 'rooms') loadRooms();
  else if (section === 'bookings') loadBookings();
  else if (section === 'notifications') loadNotifications();
  else if (section === 'payments') loadPayments();
  else if (section === 'home') loadStats();
}

document.querySelectorAll('.nav-link').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.section));
});

// ============================================
// Toast Notifications
// ============================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-bg-${type === 'error' ? 'danger' : type} border-0 mb-2`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body fw-medium">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  
  container.appendChild(toastEl);
  const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
  toast.show();
  
  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}

// ============================================
// Modal Management
// ============================================

let modalInstances = {};

function getModal(id) {
  if (!modalInstances[id]) {
    modalInstances[id] = new bootstrap.Modal(document.getElementById(id));
  }
  return modalInstances[id];
}

function openModal(id) { 
  getModal(id).show(); 
}

function closeModal(id) { 
  getModal(id).hide(); 
}

async function openCreateBookingModal() {
  const select = document.getElementById('booking-room');
  select.innerHTML = '<option value="">Chargement...</option>';
  try {
    const res = await fetch(`${API}/rooms`);
    const data = await res.json();
    select.innerHTML = data.data.map(r => `<option value="${r.id}">${r.nom} — ${r.localisation} (${r.prix}€/j)</option>`).join('');
  } catch (e) { 
    select.innerHTML = '<option value="">Erreur de chargement</option>'; 
  }
  openModal('modalCreateBooking');
}

// ============================================
// API Helpers
// ============================================

async function apiGet(endpoint) {
  const res = await fetch(`${API}${endpoint}`);
  return res.json();
}

async function apiPost(endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return res.json();
}

async function apiPut(endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return res.json();
}

async function apiDelete(endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

// ============================================
// Stats (Home)
// ============================================

async function loadStats() {
  try {
    const [roomsRes, bookingsRes, notifsRes] = await Promise.allSettled([
      apiGet('/rooms'), apiGet('/bookings'), apiGet('/notifications')
    ]);
    document.getElementById('stat-rooms').textContent = roomsRes.status === 'fulfilled' ? (roomsRes.value.total || roomsRes.value.data?.length || 0) : '—';
    document.getElementById('stat-bookings').textContent = bookingsRes.status === 'fulfilled' ? (bookingsRes.value.total || bookingsRes.value.data?.length || 0) : '—';
    document.getElementById('stat-notifs').textContent = notifsRes.status === 'fulfilled' ? (notifsRes.value.total || notifsRes.value.data?.length || 0) : '—';
  } catch (e) { console.error('Stats error:', e); }
}

// ============================================
// Rooms
// ============================================

let allRooms = [];

function getSpinnerHTML(text) {
  return `<div class="text-center text-muted my-5">
    <div class="spinner-border text-primary mb-3" role="status"></div>
    <div>${text}</div>
  </div>`;
}

function getEmptyStateHTML(text) {
  return `<div class="text-center text-muted my-5 py-5 bg-body-tertiary rounded">
    <div class="fs-1 mb-3 text-secondary">📭</div>
    <p class="mb-0 fw-medium">${text}</p>
  </div>`;
}

async function loadRooms() {
  const container = document.getElementById('rooms-container');
  container.innerHTML = getSpinnerHTML('Chargement des salles...');
  try {
    const data = await apiGet('/rooms');
    allRooms = data.data || [];
    renderRooms(allRooms);
  } catch (e) {
    container.innerHTML = getEmptyStateHTML('Impossible de charger les salles. Vérifiez que les services sont démarrés.');
  }
}

async function searchRooms() {
  const location = document.getElementById('search-location').value;
  const type = document.getElementById('filter-type').value;
  const capacity = document.getElementById('filter-capacity').value;
  const container = document.getElementById('rooms-container');
  
  container.innerHTML = getSpinnerHTML('Recherche...');
  try {
    let url = `/rooms/search?`;
    if (type) url += `type=${type}&`;
    if (capacity) url += `capacity=${capacity}&`;
    if (location) url += `ville=${location}&`;
    const data = await apiGet(url);
    renderRooms(data.data || []);
  } catch (e) {
    container.innerHTML = getEmptyStateHTML('Erreur lors de la recherche');
  }
}

function renderRooms(rooms) {
  const container = document.getElementById('rooms-container');
  if (!rooms.length) {
    container.innerHTML = `<div class="col-12">${getEmptyStateHTML('Aucune salle trouvée')}</div>`;
    return;
  }
  container.innerHTML = rooms.map(r => {
    const equips = Array.isArray(r.equipements) ? r.equipements : [];
    const typeLabel = r.type === 'fete' ? 'Fête' : 'Conférence';
    const typeColor = r.type === 'fete' ? 'warning' : 'primary';
    const statusLabel = r.disponible ? 'Disponible' : 'Indisponible';
    const statusColor = r.disponible ? 'success' : 'danger';
    
    return `
    <div class="col-md-6 col-xl-4">
      <div class="card h-100 bg-body-tertiary border-0 shadow-sm">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <h5 class="card-title fw-bold mb-0">${r.nom}</h5>
              <small class="text-muted">${r.localisation}</small>
            </div>
            <span class="badge bg-${typeColor}-subtle text-${typeColor} border border-${typeColor}-subtle rounded-pill">${typeLabel}</span>
          </div>
          
          <div class="mt-3">
            <div class="d-flex justify-content-between mb-1">
              <span class="text-muted small">Capacité</span>
              <span class="fw-medium">${r.capacite} pers.</span>
            </div>
            <div class="d-flex justify-content-between mb-1">
              <span class="text-muted small">Statut</span>
              <span class="fw-medium text-${statusColor}">${statusLabel}</span>
            </div>
            ${r.description ? `<p class="small text-muted mt-2 mb-0">${r.description}</p>` : ''}
          </div>
          
          ${equips.length ? `
          <div class="d-flex flex-wrap gap-1 mt-3">
            ${equips.map(e => `<span class="badge bg-secondary-subtle text-secondary fw-normal border">${e}</span>`).join('')}
          </div>` : ''}
        </div>
        <div class="card-footer bg-transparent border-top p-3">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="text-muted small">Prix journalier</span>
            <span class="fs-4 fw-bold text-primary">${r.prix}€</span>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-primary flex-grow-1" onclick="bookRoom('${r.id}')">Réserver</button>
            <button class="btn btn-outline-danger" onclick="deleteRoom('${r.id}')">Supprimer</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function createRoom(e) {
  e.preventDefault();
  const equipStr = document.getElementById('room-equipements').value;
  const body = {
    nom: document.getElementById('room-nom').value,
    type: document.getElementById('room-type').value,
    capacite: parseInt(document.getElementById('room-capacite').value),
    prix: parseFloat(document.getElementById('room-prix').value),
    localisation: document.getElementById('room-localisation').value,
    description: document.getElementById('room-description').value,
    equipements: equipStr ? equipStr.split(',').map(s => s.trim()) : []
  };
  try {
    const data = await apiPost('/rooms', body);
    if (data.success) { 
      showToast('Salle créée avec succès !', 'success'); 
      closeModal('modalCreateRoom'); 
      loadRooms(); 
      e.target.reset(); 
    }
    else showToast(data.error || 'Erreur', 'error');
  } catch (e) { showToast('Erreur de connexion', 'error'); }
}

async function deleteRoom(id) {
  if (!confirm('Voulez-vous vraiment supprimer cette salle ?')) return;
  try {
    const data = await apiDelete(`/rooms/${id}`);
    if (data.success) { showToast('Salle supprimée', 'success'); loadRooms(); }
    else showToast(data.error, 'error');
  } catch (e) { showToast('Erreur', 'error'); }
}

function bookRoom(roomId) {
  const select = document.getElementById('booking-room');
  openCreateBookingModal().then(() => { select.value = roomId; });
}

// ============================================
// Bookings
// ============================================

let allBookings = [];

async function loadBookings() {
  const container = document.getElementById('bookings-container');
  container.innerHTML = getSpinnerHTML('Chargement des réservations...');
  try {
    const data = await apiGet('/bookings');
    allBookings = data.data || [];
    renderBookings(allBookings);
  } catch (e) {
    container.innerHTML = getEmptyStateHTML('Impossible de charger les réservations.');
  }
}

function filterBookings(filter, btn) {
  // Update buttons
  document.getElementById('btn-filter-all').classList.remove('active');
  document.getElementById('btn-filter-attente').classList.remove('active');
  document.getElementById('btn-filter-confirmee').classList.remove('active');
  document.getElementById('btn-filter-annulee').classList.remove('active');
  btn.classList.add('active');
  
  if (filter === 'all') renderBookings(allBookings);
  else renderBookings(allBookings.filter(b => b.statut === filter));
}

function renderBookings(bookings) {
  const container = document.getElementById('bookings-container');
  if (!bookings.length) {
    container.innerHTML = `<div class="col-12">${getEmptyStateHTML('Aucune réservation')}</div>`;
    return;
  }
  
  container.innerHTML = bookings.map(b => {
    let statusLabel = 'En attente';
    let statusColor = 'warning';
    
    if (b.statut === 'confirmee') {
      statusLabel = 'Confirmée';
      statusColor = 'success';
    } else if (b.statut === 'annulee') {
      statusLabel = 'Annulée';
      statusColor = 'danger';
    }
    
    return `
    <div class="col-md-6 col-xl-4">
      <div class="card h-100 bg-body-tertiary border-0 shadow-sm">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h5 class="card-title fw-bold mb-0">${b.user_name}</h5>
              <small class="text-muted d-block text-truncate" style="max-width: 180px;">${b.id}</small>
            </div>
            <span class="badge bg-${statusColor}-subtle text-${statusColor} border border-${statusColor}-subtle rounded-pill">${statusLabel}</span>
          </div>
          
          <ul class="list-group list-group-flush bg-transparent">
            <li class="list-group-item bg-transparent px-0 py-2 d-flex justify-content-between">
              <span class="text-muted small">Salle</span>
              <span class="fw-medium">${b.room_id}</span>
            </li>
            <li class="list-group-item bg-transparent px-0 py-2">
              <div class="text-muted small mb-1">Période</div>
              <div class="fw-medium small">${b.date_debut} au ${b.date_fin}</div>
            </li>
            <li class="list-group-item bg-transparent px-0 py-2 d-flex justify-content-between">
              <span class="text-muted small">Email</span>
              <span class="fw-medium small">${b.user_email}</span>
            </li>
            ${b.motif ? `
            <li class="list-group-item bg-transparent px-0 py-2">
              <div class="text-muted small mb-1">Motif</div>
              <div class="small text-muted fst-italic">${b.motif}</div>
            </li>` : ''}
          </ul>
        </div>
        <div class="card-footer bg-transparent border-top p-3">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="text-muted fw-semibold">Montant Total</span>
            <span class="fs-5 fw-bold text-primary">${b.montant}€</span>
          </div>
          ${b.statut !== 'annulee' ? `
            <div class="d-flex gap-2">
              <button class="btn btn-outline-success flex-grow-1 btn-sm" onclick="confirmBooking('${b.id}')">Confirmer</button>
              <button class="btn btn-outline-danger flex-grow-1 btn-sm" onclick="cancelBooking('${b.id}')">Annuler</button>
            </div>
          ` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function createBooking(e) {
  e.preventDefault();
  const body = {
    room_id: document.getElementById('booking-room').value,
    user_id: 'user-' + Math.random().toString(36).substring(2, 7),
    user_name: document.getElementById('booking-name').value,
    user_email: document.getElementById('booking-email').value,
    date_debut: document.getElementById('booking-start').value,
    date_fin: document.getElementById('booking-end').value,
    motif: document.getElementById('booking-motif').value
  };
  try {
    const data = await apiPost('/bookings', body);
    if (data.success) { 
      showToast(data.message || 'Réservation créée !', 'success'); 
      closeModal('modalCreateBooking'); 
      loadBookings(); 
      e.target.reset(); 
    }
    else showToast(data.error || 'Erreur', 'error');
  } catch (e) { showToast('Erreur de connexion', 'error'); }
}

async function confirmBooking(id) {
  try {
    const data = await apiPut(`/bookings/${id}/status`, { statut: 'confirmee' });
    if (data.success) { showToast('Réservation confirmée', 'success'); loadBookings(); }
    else showToast(data.error, 'error');
  } catch (e) { showToast('Erreur', 'error'); }
}

async function cancelBooking(id) {
  const motif = prompt('Motif d\'annulation (optionnel):');
  if (motif === null) return; // User cancelled prompt
  
  try {
    const data = await apiDelete(`/bookings/${id}`, { motif_annulation: motif || '' });
    if (data.success) { showToast('Réservation annulée', 'success'); loadBookings(); }
    else showToast(data.error, 'error');
  } catch (e) { showToast('Erreur', 'error'); }
}

// ============================================
// Notifications
// ============================================

async function loadNotifications() {
  const container = document.getElementById('notifications-container');
  container.innerHTML = getSpinnerHTML('Chargement...');
  try {
    const data = await apiGet('/notifications');
    const notifs = data.data || [];
    if (!notifs.length) {
      container.innerHTML = `<div class="col-12">${getEmptyStateHTML('Aucune notification')}</div>`;
      return;
    }
    
    container.innerHTML = notifs.map(n => {
      let statusColor = n.statut === 'envoyee' ? 'primary' : 'secondary';
      return `
      <div class="col-md-6 col-xl-4">
        <div class="card h-100 bg-body-tertiary border-0 shadow-sm">
          <div class="card-header bg-transparent border-bottom-0 pt-3 pb-0 d-flex justify-content-between align-items-start">
            <div>
              <h6 class="fw-bold mb-1">${n.sujet}</h6>
              <small class="text-muted d-block text-truncate" style="max-width:200px;">${n.id}</small>
            </div>
            <span class="badge bg-${statusColor}-subtle text-${statusColor} border border-${statusColor}-subtle rounded-pill">${n.statut}</span>
          </div>
          <div class="card-body">
            <div class="d-flex justify-content-between mb-2">
              <span class="text-muted small">Date</span>
              <span class="small">${n.created_at || '-'}</span>
            </div>
            <div class="d-flex justify-content-between mb-2">
              <span class="text-muted small">Type</span>
              <span class="small fw-medium">${n.type}</span>
            </div>
            <div class="d-flex justify-content-between mb-3">
              <span class="text-muted small">Destinataire</span>
              <span class="small text-truncate" style="max-width: 150px;">${n.destinataire}</span>
            </div>
            ${n.contenu ? `<div class="bg-dark p-2 rounded small text-light font-monospace overflow-auto" style="max-height: 120px; white-space: pre-wrap;">${n.contenu}</div>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = `<div class="col-12">${getEmptyStateHTML('Erreur de chargement')}</div>`;
  }
}

// ============================================
// Payments
// ============================================

async function loadPayments() {
  const container = document.getElementById('payments-container');
  container.innerHTML = getSpinnerHTML('Chargement...');
  try {
    const data = await apiGet('/payments');
    const payments = data.data || [];
    if (!payments.length) {
      container.innerHTML = getEmptyStateHTML('Aucun paiement enregistré');
      return;
    }
    
    container.innerHTML = `
      <table class="table table-hover align-middle mb-0">
        <thead class="table-dark">
          <tr>
            <th>ID</th>
            <th>Réservation</th>
            <th>Montant</th>
            <th>Méthode</th>
            <th>Transaction</th>
            <th>Statut</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${payments.map(p => {
            const statusColor = p.statut === 'reussi' ? 'success' : (p.statut === 'echoue' ? 'danger' : 'warning');
            return `
            <tr>
              <td><small class="text-muted">${p.id}</small></td>
              <td><small>${p.booking_id}</small></td>
              <td class="fw-bold text-primary">${p.montant}€</td>
              <td>${p.methode || '-'}</td>
              <td class="font-monospace small text-muted">${p.transaction_id || '-'}</td>
              <td><span class="badge bg-${statusColor}-subtle text-${statusColor} border border-${statusColor}-subtle rounded-pill">${p.statut}</span></td>
              <td><small>${p.created_at || '-'}</small></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    container.innerHTML = getEmptyStateHTML('Erreur de chargement');
  }
}

// ============================================
// GraphQL Console
// ============================================

const graphqlQueries = {
  rooms: `query {
  rooms {
    id
    nom
    type
    capacite
    prix
    localisation
    equipements
    disponible
  }
}`,
  bookings: `query {
  allBookings {
    id
    room_id
    user_name
    user_email
    date_debut
    date_fin
    statut
    montant
    motif
  }
}`,
  notifications: `query {
  notifications {
    id
    type
    destinataire
    sujet
    statut
    booking_id
    created_at
  }
}`,
  mutation: `mutation {
  createBooking(input: {
    room_id: "room-001"
    user_id: "user-gql-001"
    user_name: "Client GraphQL"
    user_email: "graphql@test.com"
    date_debut: "2026-07-01"
    date_fin: "2026-07-02"
    motif: "Test via GraphQL"
  }) {
    id
    statut
    montant
    room {
      nom
      prix
    }
  }
}`
};

function setGraphQLQuery(type) {
  document.getElementById('graphql-query').value = graphqlQueries[type] || '';
}

async function executeGraphQL() {
  const query = document.getElementById('graphql-query').value;
  const resultEl = document.getElementById('graphql-result');
  resultEl.textContent = 'Exécution en cours...';
  resultEl.classList.remove('text-success', 'text-danger');
  resultEl.classList.add('text-muted');
  
  try {
    const res = await fetch(GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    resultEl.textContent = JSON.stringify(data, null, 2);
    
    resultEl.classList.remove('text-muted');
    if (data.errors) {
      resultEl.classList.add('text-danger');
      showToast('Erreur GraphQL', 'error');
    } else {
      resultEl.classList.add('text-success');
      showToast('Requête exécutée', 'success');
    }
  } catch (e) {
    resultEl.textContent = `Erreur: ${e.message}`;
    resultEl.classList.remove('text-muted', 'text-success');
    resultEl.classList.add('text-danger');
    showToast('Erreur de connexion', 'error');
  }
}

// ============================================
// Init
// ============================================

loadStats();
