const express = require('express');
const router = express.Router();
const { bookings, rooms } = require('../grpc-clients');

/**
 * Routes REST pour la gestion des réservations
 * Gateway → booking-service (gRPC)
 * Gateway → room-service (gRPC) pour vérification disponibilité
 */

// POST /api/bookings — Créer une réservation
router.post('/', async (req, res) => {
  try {
    const { room_id, user_id, user_name, user_email, date_debut, date_fin, motif } = req.body;

    // Validation
    if (!room_id || !user_id || !user_name || !user_email || !date_debut || !date_fin) {
      return res.status(400).json({
        success: false,
        error: 'Champs obligatoires: room_id, user_id, user_name, user_email, date_debut, date_fin'
      });
    }

    // 1. Vérifier que la salle existe et récupérer le prix
    let room;
    try {
      room = await rooms.getOne({ id: room_id });
    } catch (err) {
      return res.status(404).json({ success: false, error: `Salle '${room_id}' introuvable` });
    }

    // 2. Vérifier la disponibilité
    try {
      const availability = await rooms.checkAvailability({ room_id, date_debut, date_fin });
      if (!availability.disponible) {
        return res.status(409).json({
          success: false,
          error: availability.message || 'La salle n\'est pas disponible pour ces dates'
        });
      }
    } catch (err) {
      // Si la vérification échoue, on continue quand même
      console.warn('[api-gateway] ⚠️ Impossible de vérifier la disponibilité:', err.message);
    }

    // 3. Calculer le montant (nombre de jours × prix)
    const days = Math.max(1, Math.ceil((new Date(date_fin) - new Date(date_debut)) / (1000 * 60 * 60 * 24)));
    const montant = room.prix * days;

    // 4. Créer la réservation via gRPC
    const booking = await bookings.create({
      room_id,
      user_id,
      user_name,
      user_email,
      date_debut,
      date_fin,
      motif: motif || '',
      montant
    });

    res.status(201).json({
      success: true,
      data: booking,
      message: `Réservation créée avec succès. Montant: ${montant}€ (${days} jour(s) × ${room.prix}€)`
    });
  } catch (error) {
    console.error('[api-gateway] ❌ POST /api/bookings:', error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

// GET /api/bookings — Toutes les réservations (admin)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const user_id = req.query.user_id;

    let result;
    if (user_id) {
      result = await bookings.getByUser({ user_id });
    } else {
      result = await bookings.getAll({ page, limit });
    }

    res.json({
      success: true,
      data: result.bookings || [],
      total: result.total,
      page,
      limit
    });
  } catch (error) {
    console.error('[api-gateway] ❌ GET /api/bookings:', error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

// GET /api/bookings/:id — Détail d'une réservation
router.get('/:id', async (req, res) => {
  try {
    const booking = await bookings.getOne({ id: req.params.id });

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error(`[api-gateway] ❌ GET /api/bookings/${req.params.id}:`, error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

// PUT /api/bookings/:id — Modifier une réservation
router.put('/:id', async (req, res) => {
  try {
    const { date_debut, date_fin, motif } = req.body;

    const booking = await bookings.update({
      id: req.params.id,
      date_debut: date_debut || '',
      date_fin: date_fin || '',
      motif: motif || ''
    });

    res.json({
      success: true,
      data: booking,
      message: 'Réservation mise à jour avec succès'
    });
  } catch (error) {
    console.error(`[api-gateway] ❌ PUT /api/bookings/${req.params.id}:`, error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

// DELETE /api/bookings/:id — Annuler une réservation
router.delete('/:id', async (req, res) => {
  try {
    const { motif_annulation } = req.body || {};

    const booking = await bookings.cancel({
      id: req.params.id,
      motif_annulation: motif_annulation || ''
    });

    res.json({
      success: true,
      data: booking,
      message: 'Réservation annulée avec succès'
    });
  } catch (error) {
    console.error(`[api-gateway] ❌ DELETE /api/bookings/${req.params.id}:`, error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

// PUT /api/bookings/:id/status — Mettre à jour le statut (admin)
router.put('/:id/status', async (req, res) => {
  try {
    const { statut } = req.body;

    if (!statut) {
      return res.status(400).json({ success: false, error: 'Le champ "statut" est requis' });
    }

    const booking = await bookings.updateStatus({
      id: req.params.id,
      statut
    });

    res.json({
      success: true,
      data: booking,
      message: `Statut mis à jour: ${statut}`
    });
  } catch (error) {
    console.error(`[api-gateway] ❌ PUT /api/bookings/${req.params.id}/status:`, error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

function mapGrpcStatus(code) {
  const mapping = { 3: 400, 5: 404, 6: 409, 9: 400, 13: 500, 14: 503 };
  return mapping[code] || 500;
}

module.exports = router;
