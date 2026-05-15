const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'bookings.db');

// Créer le répertoire data s'il n'existe pas
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Activer le mode WAL pour de meilleures performances
db.pragma('journal_mode = WAL');

// Créer la table des réservations
db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    date_debut TEXT NOT NULL,
    date_fin TEXT NOT NULL,
    statut TEXT NOT NULL DEFAULT 'en_attente' CHECK(statut IN ('en_attente', 'confirmee', 'annulee')),
    montant REAL NOT NULL DEFAULT 0,
    motif TEXT DEFAULT '',
    motif_annulation TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

// Insérer des données de démonstration si la table est vide
const count = db.prepare('SELECT COUNT(*) as count FROM bookings').get();
if (count.count === 0) {
  const insertBooking = db.prepare(`
    INSERT INTO bookings (id, room_id, user_id, user_name, user_email, date_debut, date_fin, statut, montant, motif, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  const demoBookings = [
    {
      id: 'booking-001',
      room_id: 'room-001',
      user_id: 'user-001',
      user_name: 'Marie Dupont',
      user_email: 'marie.dupont@email.com',
      date_debut: '2026-06-15',
      date_fin: '2026-06-16',
      statut: 'confirmee',
      montant: 1500.00,
      motif: 'Mariage de Marie et Pierre'
    },
    {
      id: 'booking-002',
      room_id: 'room-002',
      user_id: 'user-002',
      user_name: 'Jean Martin',
      user_email: 'jean.martin@entreprise.com',
      date_debut: '2026-06-20',
      date_fin: '2026-06-21',
      statut: 'en_attente',
      montant: 800.00,
      motif: 'Séminaire annuel entreprise TechCorp'
    }
  ];

  const insertMany = db.transaction((bookings) => {
    for (const b of bookings) {
      insertBooking.run(b.id, b.room_id, b.user_id, b.user_name, b.user_email, b.date_debut, b.date_fin, b.statut, b.montant, b.motif, now, now);
    }
  });

  insertMany(demoBookings);
  console.log('[booking-service] ✅ Données de démonstration insérées (2 réservations)');
}

module.exports = db;
