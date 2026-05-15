const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'rooms.db');

// Créer le répertoire data s'il n'existe pas
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Activer le mode WAL pour de meilleures performances
db.pragma('journal_mode = WAL');

// Créer la table des salles
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('fete', 'conference')),
    capacite INTEGER NOT NULL,
    equipements TEXT DEFAULT '[]',
    prix REAL NOT NULL,
    localisation TEXT NOT NULL,
    description TEXT DEFAULT '',
    disponible INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

// Créer la table des disponibilités (plages réservées)
db.exec(`
  CREATE TABLE IF NOT EXISTS reservations_dates (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    date_debut TEXT NOT NULL,
    date_fin TEXT NOT NULL,
    booking_id TEXT NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
  )
`);

// Insérer des données de démonstration si la table est vide
const count = db.prepare('SELECT COUNT(*) as count FROM rooms').get();
if (count.count === 0) {
  const insertRoom = db.prepare(`
    INSERT INTO rooms (id, nom, type, capacite, equipements, prix, localisation, description, disponible)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const demoRooms = [
    {
      id: 'room-001',
      nom: 'Salle Diamant',
      type: 'fete',
      capacite: 200,
      equipements: JSON.stringify(['sono', 'éclairage LED', 'scène', 'piste de danse', 'bar']),
      prix: 1500.00,
      localisation: 'Paris',
      description: 'Magnifique salle de fête avec vue panoramique sur la Seine, idéale pour mariages et galas.'
    },
    {
      id: 'room-002',
      nom: 'Salle Horizon',
      type: 'conference',
      capacite: 100,
      equipements: JSON.stringify(['vidéoprojecteur', 'microphones', 'WiFi haut débit', 'tableau blanc', 'climatisation']),
      prix: 800.00,
      localisation: 'Lyon',
      description: 'Salle de conférence moderne équipée pour séminaires professionnels et formations.'
    },
    {
      id: 'room-003',
      nom: 'Salle Émeraude',
      type: 'fete',
      capacite: 150,
      equipements: JSON.stringify(['sono', 'éclairage', 'cuisine équipée', 'terrasse', 'parking']),
      prix: 1200.00,
      localisation: 'Marseille',
      description: 'Espace festif avec terrasse extérieure et vue sur la mer Méditerranée.'
    },
    {
      id: 'room-004',
      nom: 'Salle Innovation',
      type: 'conference',
      capacite: 50,
      equipements: JSON.stringify(['écran interactif', 'visioconférence', 'WiFi', 'machine à café', 'imprimante']),
      prix: 500.00,
      localisation: 'Paris',
      description: 'Salle de réunion high-tech pour brainstorming et workshops créatifs.'
    },
    {
      id: 'room-005',
      nom: 'Salle Royale',
      type: 'fete',
      capacite: 300,
      equipements: JSON.stringify(['sono professionnelle', 'éclairage spectacle', 'scène XL', 'vestiaire', 'traiteur intégré']),
      prix: 2500.00,
      localisation: 'Bordeaux',
      description: 'La plus grande salle de réception de la région, parfaite pour événements d\'envergure.'
    },
    {
      id: 'room-006',
      nom: 'Salle Summit',
      type: 'conference',
      capacite: 250,
      equipements: JSON.stringify(['amphithéâtre', 'système de vote', 'traduction simultanée', 'streaming live', 'WiFi']),
      prix: 1800.00,
      localisation: 'Toulouse',
      description: 'Amphithéâtre de conférence international avec équipements de pointe.'
    }
  ];

  const insertMany = db.transaction((rooms) => {
    for (const room of rooms) {
      insertRoom.run(room.id, room.nom, room.type, room.capacite, room.equipements, room.prix, room.localisation, room.description);
    }
  });

  insertMany(demoRooms);
  console.log('[room-service] ✅ Données de démonstration insérées (6 salles)');
}

module.exports = db;
