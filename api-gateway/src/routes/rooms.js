const express = require('express');
const router = express.Router();
const { rooms } = require('../grpc-clients');

/**
 * Routes REST pour la gestion des salles
 * Gateway → room-service (gRPC)
 */

// GET /api/rooms — Liste paginée des salles
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await rooms.getAll({ page, limit });

    res.json({
      success: true,
      data: result.rooms.map(parseRoom),
      total: result.total,
      page,
      limit
    });
  } catch (error) {
    console.error('[api-gateway] ❌ GET /api/rooms:', error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

// GET /api/rooms/search — Recherche par critères
router.get('/search', async (req, res) => {
  try {
    const { type, capacity, capacite, ville, localisation, prix_max } = req.query;

    const result = await rooms.search({
      type: type || '',
      capacite_min: parseInt(capacity || capacite) || 0,
      localisation: ville || localisation || '',
      prix_max: parseFloat(prix_max) || 0
    });

    res.json({
      success: true,
      data: result.rooms.map(parseRoom),
      total: result.total
    });
  } catch (error) {
    console.error('[api-gateway] ❌ GET /api/rooms/search:', error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

// GET /api/rooms/:id — Détail d'une salle
router.get('/:id', async (req, res) => {
  try {
    const room = await rooms.getOne({ id: req.params.id });

    // Vérifier la disponibilité actuelle
    res.json({
      success: true,
      data: parseRoom(room)
    });
  } catch (error) {
    console.error(`[api-gateway] ❌ GET /api/rooms/${req.params.id}:`, error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

// POST /api/rooms — Créer une salle (admin)
router.post('/', async (req, res) => {
  try {
    const { nom, type, capacite, equipements, prix, localisation, description } = req.body;

    const room = await rooms.create({
      nom,
      type,
      capacite: parseInt(capacite) || 0,
      equipements: typeof equipements === 'string' ? equipements : JSON.stringify(equipements || []),
      prix: parseFloat(prix) || 0,
      localisation,
      description
    });

    res.status(201).json({
      success: true,
      data: parseRoom(room),
      message: 'Salle créée avec succès'
    });
  } catch (error) {
    console.error('[api-gateway] ❌ POST /api/rooms:', error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

// PUT /api/rooms/:id — Mettre à jour une salle (admin)
router.put('/:id', async (req, res) => {
  try {
    const { nom, type, capacite, equipements, prix, localisation, description, disponible } = req.body;

    const room = await rooms.update({
      id: req.params.id,
      nom: nom || '',
      type: type || '',
      capacite: parseInt(capacite) || 0,
      equipements: equipements ? (typeof equipements === 'string' ? equipements : JSON.stringify(equipements)) : '',
      prix: parseFloat(prix) || 0,
      localisation: localisation || '',
      description: description || '',
      disponible: disponible !== undefined ? disponible : true
    });

    res.json({
      success: true,
      data: parseRoom(room),
      message: 'Salle mise à jour avec succès'
    });
  } catch (error) {
    console.error(`[api-gateway] ❌ PUT /api/rooms/${req.params.id}:`, error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

// DELETE /api/rooms/:id — Supprimer une salle (admin)
router.delete('/:id', async (req, res) => {
  try {
    const result = await rooms.delete({ id: req.params.id });

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error(`[api-gateway] ❌ DELETE /api/rooms/${req.params.id}:`, error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

// GET /api/rooms/:id/availability — Vérifier la disponibilité
router.get('/:id/availability', async (req, res) => {
  try {
    const { date_debut, date_fin } = req.query;

    if (!date_debut || !date_fin) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres requis: date_debut, date_fin (format: YYYY-MM-DD)'
      });
    }

    const result = await rooms.checkAvailability({
      room_id: req.params.id,
      date_debut,
      date_fin
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error(`[api-gateway] ❌ GET /api/rooms/${req.params.id}/availability:`, error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

// Helper: Parser les équipements JSON
function parseRoom(room) {
  if (!room) return null;
  let equipements = room.equipements;
  try {
    if (typeof equipements === 'string') {
      equipements = JSON.parse(equipements);
    }
  } catch (e) {
    equipements = [];
  }
  return { ...room, equipements };
}

// Helper: Mapper les codes gRPC vers HTTP
function mapGrpcStatus(code) {
  const mapping = {
    3: 400,  // INVALID_ARGUMENT
    5: 404,  // NOT_FOUND
    6: 409,  // ALREADY_EXISTS
    9: 400,  // FAILED_PRECONDITION
    13: 500, // INTERNAL
    14: 503  // UNAVAILABLE
  };
  return mapping[code] || 500;
}

module.exports = router;
