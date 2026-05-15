const db = require('./db');
const { v4: uuidv4 } = require('uuid');

/**
 * Handlers pour le service de gestion des salles
 * Chaque handler correspond à une méthode gRPC définie dans room.proto
 */

// Récupérer toutes les salles (avec pagination)
function getAllRooms(call, callback) {
  try {
    const page = call.request.page || 1;
    const limit = call.request.limit || 20;
    const offset = (page - 1) * limit;

    const rooms = db.prepare('SELECT * FROM rooms ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM rooms').get();

    const formattedRooms = rooms.map(formatRoom);

    callback(null, { rooms: formattedRooms, total: total.count });
    console.log(`[room-service] 📋 GetAllRooms: ${formattedRooms.length} salles retournées`);
  } catch (error) {
    console.error('[room-service] ❌ Erreur GetAllRooms:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Récupérer une salle par ID
function getRoom(call, callback) {
  try {
    const { id } = call.request;
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);

    if (!room) {
      return callback({ code: 5, message: `Salle avec l'ID '${id}' introuvable` });
    }

    callback(null, formatRoom(room));
    console.log(`[room-service] 🔍 GetRoom: ${room.nom} (${id})`);
  } catch (error) {
    console.error('[room-service] ❌ Erreur GetRoom:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Rechercher des salles par critères
function searchRooms(call, callback) {
  try {
    const { type, capacite_min, localisation, prix_max } = call.request;

    let query = 'SELECT * FROM rooms WHERE 1=1';
    const params = [];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    if (capacite_min > 0) {
      query += ' AND capacite >= ?';
      params.push(capacite_min);
    }
    if (localisation) {
      query += ' AND LOWER(localisation) LIKE LOWER(?)';
      params.push(`%${localisation}%`);
    }
    if (prix_max > 0) {
      query += ' AND prix <= ?';
      params.push(prix_max);
    }

    query += ' ORDER BY prix ASC';

    const rooms = db.prepare(query).all(...params);
    const formattedRooms = rooms.map(formatRoom);

    callback(null, { rooms: formattedRooms, total: formattedRooms.length });
    console.log(`[room-service] 🔎 SearchRooms: ${formattedRooms.length} résultats (type=${type}, capacité>=${capacite_min}, ville=${localisation})`);
  } catch (error) {
    console.error('[room-service] ❌ Erreur SearchRooms:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Créer une nouvelle salle
function createRoom(call, callback) {
  try {
    const { nom, type, capacite, equipements, prix, localisation, description } = call.request;

    // Validation
    if (!nom || !type || !capacite || !prix || !localisation) {
      return callback({ code: 3, message: 'Champs obligatoires manquants: nom, type, capacite, prix, localisation' });
    }
    if (!['fete', 'conference'].includes(type)) {
      return callback({ code: 3, message: 'Type invalide. Valeurs acceptées: "fete", "conference"' });
    }

    const id = `room-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO rooms (id, nom, type, capacite, equipements, prix, localisation, description, disponible, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, nom, type, capacite, equipements || '[]', prix, localisation, description || '', now, now);

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    callback(null, formatRoom(room));
    console.log(`[room-service] ✅ CreateRoom: ${nom} (${id})`);
  } catch (error) {
    console.error('[room-service] ❌ Erreur CreateRoom:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Mettre à jour une salle
function updateRoom(call, callback) {
  try {
    const { id, nom, type, capacite, equipements, prix, localisation, description, disponible } = call.request;

    const existing = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!existing) {
      return callback({ code: 5, message: `Salle avec l'ID '${id}' introuvable` });
    }

    if (type && !['fete', 'conference'].includes(type)) {
      return callback({ code: 3, message: 'Type invalide. Valeurs acceptées: "fete", "conference"' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE rooms SET
        nom = COALESCE(NULLIF(?, ''), nom),
        type = COALESCE(NULLIF(?, ''), type),
        capacite = CASE WHEN ? > 0 THEN ? ELSE capacite END,
        equipements = COALESCE(NULLIF(?, ''), equipements),
        prix = CASE WHEN ? > 0 THEN ? ELSE prix END,
        localisation = COALESCE(NULLIF(?, ''), localisation),
        description = COALESCE(NULLIF(?, ''), description),
        disponible = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      nom || '', type || '',
      capacite, capacite,
      equipements || '',
      prix, prix,
      localisation || '', description || '',
      disponible !== undefined ? (disponible ? 1 : 0) : existing.disponible,
      now, id
    );

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    callback(null, formatRoom(room));
    console.log(`[room-service] ✏️ UpdateRoom: ${room.nom} (${id})`);
  } catch (error) {
    console.error('[room-service] ❌ Erreur UpdateRoom:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Supprimer une salle
function deleteRoom(call, callback) {
  try {
    const { id } = call.request;

    const existing = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!existing) {
      return callback({ code: 5, message: `Salle avec l'ID '${id}' introuvable` });
    }

    db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
    db.prepare('DELETE FROM reservations_dates WHERE room_id = ?').run(id);

    callback(null, { success: true, message: `Salle '${existing.nom}' supprimée avec succès` });
    console.log(`[room-service] 🗑️ DeleteRoom: ${existing.nom} (${id})`);
  } catch (error) {
    console.error('[room-service] ❌ Erreur DeleteRoom:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Vérifier la disponibilité d'une salle pour une période donnée
function checkAvailability(call, callback) {
  try {
    const { room_id, date_debut, date_fin } = call.request;

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room_id);
    if (!room) {
      return callback({ code: 5, message: `Salle avec l'ID '${room_id}' introuvable` });
    }

    if (!room.disponible) {
      return callback(null, {
        disponible: false,
        room_id,
        message: `La salle '${room.nom}' est actuellement indisponible`
      });
    }

    // Vérifier les conflits de dates
    const conflict = db.prepare(`
      SELECT COUNT(*) as count FROM reservations_dates
      WHERE room_id = ? AND date_debut < ? AND date_fin > ?
    `).get(room_id, date_fin, date_debut);

    const isAvailable = conflict.count === 0;

    callback(null, {
      disponible: isAvailable,
      room_id,
      message: isAvailable
        ? `La salle '${room.nom}' est disponible du ${date_debut} au ${date_fin}`
        : `La salle '${room.nom}' est déjà réservée pour cette période`
    });

    console.log(`[room-service] 📅 CheckAvailability: ${room.nom} (${date_debut} → ${date_fin}) = ${isAvailable ? '✅ Disponible' : '❌ Indisponible'}`);
  } catch (error) {
    console.error('[room-service] ❌ Erreur CheckAvailability:', error.message);
    callback({ code: 13, message: error.message });
  }
}

// Helper: Formatter une salle pour la réponse gRPC
function formatRoom(room) {
  return {
    id: room.id,
    nom: room.nom,
    type: room.type,
    capacite: room.capacite,
    equipements: room.equipements,
    prix: room.prix,
    localisation: room.localisation,
    description: room.description || '',
    disponible: !!room.disponible,
    created_at: room.created_at || '',
    updated_at: room.updated_at || ''
  };
}

module.exports = {
  getAllRooms,
  getRoom,
  searchRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  checkAvailability
};
