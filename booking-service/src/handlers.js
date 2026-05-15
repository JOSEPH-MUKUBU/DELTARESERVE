const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const kafka = require('./kafka-producer');

/**
 * Handlers pour le service de gestion des réservations
 * Chaque handler correspond à une méthode gRPC définie dans booking.proto
 */

// Créer une réservation
function createBooking(call, callback) {
  try {
    const { room_id, user_id, user_name, user_email, date_debut, date_fin, motif } = call.request;

    // Validation
    if (!room_id || !user_id || !user_name || !user_email || !date_debut || !date_fin) {
      return callback({
        code: 3,
        message: 'Champs obligatoires manquants: room_id, user_id, user_name, user_email, date_debut, date_fin'
      });
    }

    // Vérifier que la date de fin est après la date de début
    if (new Date(date_fin) <= new Date(date_debut)) {
      return callback({ code: 3, message: 'La date de fin doit être postérieure à la date de début' });
    }

    const id = `booking-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    // Calculer le montant (sera défini par l'API Gateway via le room-service)
    const montant = call.request.montant || 0;

    db.prepare(`
      INSERT INTO bookings (id, room_id, user_id, user_name, user_email, date_debut, date_fin, statut, montant, motif, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente', ?, ?, ?, ?)
    `).run(id, room_id, user_id, user_name, user_email, date_debut, date_fin, montant, motif || '', now, now);

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    const formatted = formatBooking(booking);

    // Publier l'événement Kafka
    kafka.publishBookingCreated(formatted).catch(err => {
      console.warn('[booking-service] ⚠️ Impossible de publier booking.created:', err.message);
    });

    callback(null, formatted);
    console.log(`[booking-service] ✅ CreateBooking: ${id} (salle: ${room_id}, client: ${user_name})`);
  } catch (error) {
    console.error('[booking-service] ❌ Erreur CreateBooking:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Récupérer une réservation par ID
function getBooking(call, callback) {
  try {
    const { id } = call.request;
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);

    if (!booking) {
      return callback({ code: 5, message: `Réservation avec l'ID '${id}' introuvable` });
    }

    callback(null, formatBooking(booking));
    console.log(`[booking-service] 🔍 GetBooking: ${id}`);
  } catch (error) {
    console.error('[booking-service] ❌ Erreur GetBooking:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Récupérer toutes les réservations (admin)
function getAllBookings(call, callback) {
  try {
    const page = call.request.page || 1;
    const limit = call.request.limit || 20;
    const offset = (page - 1) * limit;

    const bookings = db.prepare('SELECT * FROM bookings ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM bookings').get();

    callback(null, { bookings: bookings.map(formatBooking), total: total.count });
    console.log(`[booking-service] 📋 GetAllBookings: ${bookings.length} réservations`);
  } catch (error) {
    console.error('[booking-service] ❌ Erreur GetAllBookings:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Récupérer les réservations d'un utilisateur
function getUserBookings(call, callback) {
  try {
    const { user_id } = call.request;

    if (!user_id) {
      return callback({ code: 3, message: 'user_id est requis' });
    }

    const bookings = db.prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC').all(user_id);

    callback(null, { bookings: bookings.map(formatBooking), total: bookings.length });
    console.log(`[booking-service] 👤 GetUserBookings: ${bookings.length} réservations pour ${user_id}`);
  } catch (error) {
    console.error('[booking-service] ❌ Erreur GetUserBookings:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Modifier une réservation
function updateBooking(call, callback) {
  try {
    const { id, date_debut, date_fin, motif } = call.request;

    const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!existing) {
      return callback({ code: 5, message: `Réservation avec l'ID '${id}' introuvable` });
    }

    if (existing.statut === 'annulee') {
      return callback({ code: 9, message: 'Impossible de modifier une réservation annulée' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE bookings SET
        date_debut = COALESCE(NULLIF(?, ''), date_debut),
        date_fin = COALESCE(NULLIF(?, ''), date_fin),
        motif = COALESCE(NULLIF(?, ''), motif),
        updated_at = ?
      WHERE id = ?
    `).run(date_debut || '', date_fin || '', motif || '', now, id);

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    callback(null, formatBooking(booking));
    console.log(`[booking-service] ✏️ UpdateBooking: ${id}`);
  } catch (error) {
    console.error('[booking-service] ❌ Erreur UpdateBooking:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Annuler une réservation
function cancelBooking(call, callback) {
  try {
    const { id, motif_annulation } = call.request;

    const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!existing) {
      return callback({ code: 5, message: `Réservation avec l'ID '${id}' introuvable` });
    }

    if (existing.statut === 'annulee') {
      return callback({ code: 9, message: 'Cette réservation est déjà annulée' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE bookings SET statut = 'annulee', motif_annulation = ?, updated_at = ?
      WHERE id = ?
    `).run(motif_annulation || '', now, id);

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    const formatted = formatBooking(booking);

    // Publier l'événement Kafka
    kafka.publishBookingCancelled({ ...formatted, motif_annulation }).catch(err => {
      console.warn('[booking-service] ⚠️ Impossible de publier booking.cancelled:', err.message);
    });

    callback(null, formatted);
    console.log(`[booking-service] ❌ CancelBooking: ${id} (motif: ${motif_annulation || 'Non spécifié'})`);
  } catch (error) {
    console.error('[booking-service] ❌ Erreur CancelBooking:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Mettre à jour le statut d'une réservation (interne / admin)
function updateBookingStatus(call, callback) {
  try {
    const { id, statut } = call.request;

    if (!['en_attente', 'confirmee', 'annulee'].includes(statut)) {
      return callback({ code: 3, message: 'Statut invalide. Valeurs acceptées: en_attente, confirmee, annulee' });
    }

    const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!existing) {
      return callback({ code: 5, message: `Réservation avec l'ID '${id}' introuvable` });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE bookings SET statut = ?, updated_at = ? WHERE id = ?').run(statut, now, id);

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    callback(null, formatBooking(booking));
    console.log(`[booking-service] 🔄 UpdateBookingStatus: ${id} → ${statut}`);
  } catch (error) {
    console.error('[booking-service] ❌ Erreur UpdateBookingStatus:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Helper: Formatter une réservation pour la réponse gRPC
function formatBooking(booking) {
  return {
    id: booking.id,
    room_id: booking.room_id,
    user_id: booking.user_id,
    user_name: booking.user_name,
    user_email: booking.user_email,
    date_debut: booking.date_debut,
    date_fin: booking.date_fin,
    statut: booking.statut,
    montant: booking.montant,
    motif: booking.motif || '',
    created_at: booking.created_at || '',
    updated_at: booking.updated_at || ''
  };
}

// Callback pour la réception d'un paiement traité (via Kafka consumer)
function onPaymentProcessed(data) {
  try {
    const { booking_id, statut } = data;
    if (booking_id && statut === 'reussi') {
      const now = new Date().toISOString();
      db.prepare('UPDATE bookings SET statut = ?, updated_at = ? WHERE id = ?').run('confirmee', now, booking_id);
      console.log(`[booking-service] ✅ Réservation ${booking_id} confirmée suite au paiement`);
    }
  } catch (error) {
    console.error('[booking-service] ❌ Erreur onPaymentProcessed:', error.message);
  }
}

module.exports = {
  createBooking,
  getBooking,
  getAllBookings,
  getUserBookings,
  updateBooking,
  cancelBooking,
  updateBookingStatus,
  onPaymentProcessed
};
