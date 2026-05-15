const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

/**
 * Base de données NoSQL pour notification-service
 * Utilise une implémentation JSON simplifiée compatible RxDB
 * (RxDB nécessite un navigateur ou un adaptateur spécifique pour Node.js,
 *  nous utilisons une approche JSON-file qui simule le comportement NoSQL)
 */

const DATA_DIR = path.join(__dirname, '..', 'data');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');

// Créer le répertoire data s'il n'existe pas
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Charger les données depuis un fichier JSON
function loadCollection(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn(`[notification-service] ⚠️ Erreur lecture ${filePath}:`, error.message);
  }
  return [];
}

// Sauvegarder les données dans un fichier JSON
function saveCollection(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`[notification-service] ❌ Erreur écriture ${filePath}:`, error.message);
  }
}

// Collections en mémoire (chargées au démarrage)
let notifications = loadCollection(NOTIFICATIONS_FILE);
let payments = loadCollection(PAYMENTS_FILE);

// === API Notifications ===

const notificationsDB = {
  /**
   * Insérer une notification
   */
  insert(notification) {
    const doc = {
      id: notification.id || `notif-${uuidv4().substring(0, 8)}`,
      type: notification.type || 'info',
      destinataire: notification.destinataire || '',
      sujet: notification.sujet || '',
      contenu: notification.contenu || '',
      statut: notification.statut || 'en_attente',
      booking_id: notification.booking_id || '',
      created_at: notification.created_at || new Date().toISOString()
    };
    notifications.push(doc);
    saveCollection(NOTIFICATIONS_FILE, notifications);
    return doc;
  },

  /**
   * Trouver une notification par ID
   */
  findById(id) {
    return notifications.find(n => n.id === id) || null;
  },

  /**
   * Trouver toutes les notifications (avec filtre optionnel et pagination)
   */
  findAll({ page = 1, limit = 20, type = '' } = {}) {
    let filtered = [...notifications];
    if (type) {
      filtered = filtered.filter(n => n.type === type);
    }
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return { notifications: paginated, total };
  },

  /**
   * Mettre à jour le statut d'une notification
   */
  updateStatus(id, statut) {
    const index = notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      notifications[index].statut = statut;
      saveCollection(NOTIFICATIONS_FILE, notifications);
      return notifications[index];
    }
    return null;
  }
};

// === API Paiements ===

const paymentsDB = {
  /**
   * Insérer un paiement
   */
  insert(payment) {
    const doc = {
      id: payment.id || `pay-${uuidv4().substring(0, 8)}`,
      booking_id: payment.booking_id || '',
      montant: payment.montant || 0,
      statut: payment.statut || 'en_attente',
      methode: payment.methode || 'carte',
      transaction_id: payment.transaction_id || `txn-${uuidv4().substring(0, 12)}`,
      user_id: payment.user_id || '',
      created_at: payment.created_at || new Date().toISOString()
    };
    payments.push(doc);
    saveCollection(PAYMENTS_FILE, payments);
    return doc;
  },

  /**
   * Trouver un paiement par ID
   */
  findById(id) {
    return payments.find(p => p.id === id) || null;
  },

  /**
   * Trouver un paiement par booking_id
   */
  findByBookingId(bookingId) {
    return payments.find(p => p.booking_id === bookingId) || null;
  },

  /**
   * Trouver tous les paiements (avec pagination)
   */
  findAll({ page = 1, limit = 20 } = {}) {
    const sorted = [...payments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total = sorted.length;
    const offset = (page - 1) * limit;
    const paginated = sorted.slice(offset, offset + limit);

    return { payments: paginated, total };
  },

  /**
   * Mettre à jour le statut d'un paiement
   */
  updateStatus(id, statut) {
    const index = payments.findIndex(p => p.id === id);
    if (index !== -1) {
      payments[index].statut = statut;
      saveCollection(PAYMENTS_FILE, payments);
      return payments[index];
    }
    return null;
  }
};

console.log(`[notification-service] 💾 Base de données NoSQL (JSON/RxDB) initialisée`);
console.log(`[notification-service] 📊 ${notifications.length} notifications, ${payments.length} paiements chargés`);

module.exports = { notificationsDB, paymentsDB };
