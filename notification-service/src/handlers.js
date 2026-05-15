const { notificationsDB, paymentsDB } = require('./db');
const kafka = require('./kafka');
const { v4: uuidv4 } = require('uuid');

/**
 * Handlers pour le service de notifications et paiement
 * Chaque handler correspond à une méthode gRPC définie dans notification.proto
 */

// === Handlers gRPC ===

// Envoyer une notification
function sendNotification(call, callback) {
  try {
    const { type, destinataire, sujet, contenu, booking_id } = call.request;

    if (!type || !destinataire || !sujet) {
      return callback({ code: 3, message: 'Champs obligatoires manquants: type, destinataire, sujet' });
    }

    const notification = notificationsDB.insert({
      type,
      destinataire,
      sujet,
      contenu: contenu || '',
      booking_id: booking_id || '',
      statut: 'envoyee'
    });

    // Simuler l'envoi de la notification
    console.log(`[notification-service] 📧 Notification envoyée:`);
    console.log(`   Type: ${type}`);
    console.log(`   Destinataire: ${destinataire}`);
    console.log(`   Sujet: ${sujet}`);
    console.log(`   Contenu: ${contenu}`);

    // Publier l'événement Kafka
    kafka.publishNotificationSent(notification).catch(err => {
      console.warn('[notification-service] ⚠️ Impossible de publier notification.sent:', err.message);
    });

    callback(null, notification);
    console.log(`[notification-service] ✅ SendNotification: ${notification.id}`);
  } catch (error) {
    console.error('[notification-service] ❌ Erreur SendNotification:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Récupérer l'historique des notifications
function getNotifications(call, callback) {
  try {
    const { page, limit, type } = call.request;
    const result = notificationsDB.findAll({
      page: page || 1,
      limit: limit || 20,
      type: type || ''
    });

    callback(null, result);
    console.log(`[notification-service] 📋 GetNotifications: ${result.notifications.length} notifications`);
  } catch (error) {
    console.error('[notification-service] ❌ Erreur GetNotifications:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Récupérer une notification par ID
function getNotification(call, callback) {
  try {
    const { id } = call.request;
    const notification = notificationsDB.findById(id);

    if (!notification) {
      return callback({ code: 5, message: `Notification avec l'ID '${id}' introuvable` });
    }

    callback(null, notification);
    console.log(`[notification-service] 🔍 GetNotification: ${id}`);
  } catch (error) {
    console.error('[notification-service] ❌ Erreur GetNotification:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Traiter un paiement (simulation)
function processPayment(call, callback) {
  try {
    const { booking_id, montant, user_id, user_email, methode } = call.request;

    if (!booking_id || !montant) {
      return callback({ code: 3, message: 'Champs obligatoires manquants: booking_id, montant' });
    }

    // Simuler le traitement du paiement (succès dans 95% des cas)
    const isSuccess = Math.random() > 0.05;

    const payment = paymentsDB.insert({
      booking_id,
      montant,
      statut: isSuccess ? 'reussi' : 'echoue',
      methode: methode || 'carte',
      user_id: user_id || '',
      transaction_id: `txn-${uuidv4().substring(0, 12)}`
    });

    console.log(`[notification-service] 💳 Paiement traité:`);
    console.log(`   Booking: ${booking_id}`);
    console.log(`   Montant: ${montant}€`);
    console.log(`   Méthode: ${methode || 'carte'}`);
    console.log(`   Statut: ${payment.statut}`);
    console.log(`   Transaction: ${payment.transaction_id}`);

    // Publier l'événement Kafka
    kafka.publishPaymentProcessed(payment).catch(err => {
      console.warn('[notification-service] ⚠️ Impossible de publier payment.processed:', err.message);
    });

    callback(null, payment);
    console.log(`[notification-service] ✅ ProcessPayment: ${payment.id} (${payment.statut})`);
  } catch (error) {
    console.error('[notification-service] ❌ Erreur ProcessPayment:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Récupérer les statuts de paiement
function getPayments(call, callback) {
  try {
    const { page, limit } = call.request;
    const result = paymentsDB.findAll({ page: page || 1, limit: limit || 20 });

    callback(null, result);
    console.log(`[notification-service] 📋 GetPayments: ${result.payments.length} paiements`);
  } catch (error) {
    console.error('[notification-service] ❌ Erreur GetPayments:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Récupérer un paiement par ID
function getPayment(call, callback) {
  try {
    const { id } = call.request;
    const payment = paymentsDB.findById(id);

    if (!payment) {
      return callback({ code: 5, message: `Paiement avec l'ID '${id}' introuvable` });
    }

    callback(null, payment);
    console.log(`[notification-service] 🔍 GetPayment: ${id}`);
  } catch (error) {
    console.error('[notification-service] ❌ Erreur GetPayment:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// === Handlers Kafka (événements asynchrones) ===

/**
 * Traiter l'événement "booking.created"
 * 1. Simuler le paiement
 * 2. Envoyer une notification de confirmation
 */
async function onBookingCreated(data) {
  console.log(`[notification-service] 🎯 Traitement de booking.created pour ${data.booking_id}`);

  try {
    // 1. Simuler le traitement du paiement
    const isSuccess = Math.random() > 0.05;
    const payment = paymentsDB.insert({
      booking_id: data.booking_id,
      montant: data.montant || 0,
      statut: isSuccess ? 'reussi' : 'echoue',
      methode: 'carte',
      user_id: data.user_id || ''
    });

    console.log(`[notification-service] 💳 Paiement auto-traité: ${payment.id} → ${payment.statut}`);

    // Publier payment.processed
    await kafka.publishPaymentProcessed(payment);

    // 2. Envoyer une notification de confirmation
    const notification = notificationsDB.insert({
      type: 'confirmation',
      destinataire: data.user_email || 'client@email.com',
      sujet: `Confirmation de réservation ${data.booking_id}`,
      contenu: `Bonjour ${data.user_name || 'Client'},\n\nVotre réservation ${data.booking_id} a été ${isSuccess ? 'confirmée' : 'rejetée (échec paiement)'}.\n\nDétails:\n- Salle: ${data.room_id}\n- Dates: ${data.date_debut} au ${data.date_fin}\n- Montant: ${data.montant}€\n- Transaction: ${payment.transaction_id}\n\nCordialement,\nL'équipe DELTARESERVE`,
      booking_id: data.booking_id,
      statut: 'envoyee'
    });

    console.log(`[notification-service] 📧 Notification auto-envoyée: ${notification.id}`);

    // Publier notification.sent
    await kafka.publishNotificationSent(notification);

  } catch (error) {
    console.error('[notification-service] ❌ Erreur traitement booking.created:', error.message);
  }
}

/**
 * Traiter l'événement "booking.cancelled"
 * Envoyer une notification d'annulation
 */
async function onBookingCancelled(data) {
  console.log(`[notification-service] 🎯 Traitement de booking.cancelled pour ${data.booking_id}`);

  try {
    const notification = notificationsDB.insert({
      type: 'annulation',
      destinataire: data.user_email || 'client@email.com',
      sujet: `Annulation de réservation ${data.booking_id}`,
      contenu: `Bonjour ${data.user_name || 'Client'},\n\nVotre réservation ${data.booking_id} a été annulée.\n\nMotif: ${data.motif_annulation || 'Non spécifié'}\n\nCordialement,\nL'équipe DELTARESERVE`,
      booking_id: data.booking_id,
      statut: 'envoyee'
    });

    console.log(`[notification-service] 📧 Notification d'annulation envoyée: ${notification.id}`);

    await kafka.publishNotificationSent(notification);

  } catch (error) {
    console.error('[notification-service] ❌ Erreur traitement booking.cancelled:', error.message);
  }
}

module.exports = {
  // gRPC handlers
  sendNotification,
  getNotifications,
  getNotification,
  processPayment,
  getPayments,
  getPayment,
  // Kafka handlers
  onBookingCreated,
  onBookingCancelled
};
