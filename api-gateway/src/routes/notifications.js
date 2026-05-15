const express = require('express');
const router = express.Router();
const { notifications } = require('../grpc-clients');

/**
 * Routes REST pour les notifications et paiements
 * Gateway → notification-service (gRPC)
 */

// GET /api/notifications — Historique des notifications (admin)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const type = req.query.type || '';

    const result = await notifications.getAll({ page, limit, type });

    res.json({
      success: true,
      data: result.notifications || [],
      total: result.total,
      page,
      limit
    });
  } catch (error) {
    console.error('[api-gateway] ❌ GET /api/notifications:', error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

// GET /api/notifications/:id — Détail d'une notification
router.get('/:id', async (req, res) => {
  try {
    const notification = await notifications.getOne({ id: req.params.id });

    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error(`[api-gateway] ❌ GET /api/notifications/${req.params.id}:`, error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

// POST /api/notifications — Envoyer une notification manuellement
router.post('/', async (req, res) => {
  try {
    const { type, destinataire, sujet, contenu, booking_id } = req.body;

    const notification = await notifications.send({
      type, destinataire, sujet, contenu, booking_id
    });

    res.status(201).json({
      success: true,
      data: notification,
      message: 'Notification envoyée avec succès'
    });
  } catch (error) {
    console.error('[api-gateway] ❌ POST /api/notifications:', error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

// GET /api/payments — Statuts de paiement (admin)
router.get('/payments/all', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await notifications.getPayments({ page, limit });

    res.json({
      success: true,
      data: result.payments || [],
      total: result.total,
      page,
      limit
    });
  } catch (error) {
    console.error('[api-gateway] ❌ GET /api/payments:', error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

// GET /api/payments/:id — Détail d'un paiement
router.get('/payments/:id', async (req, res) => {
  try {
    const payment = await notifications.getPayment({ id: req.params.id });

    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error(`[api-gateway] ❌ GET /api/payments/${req.params.id}:`, error.message);
    res.status(mapGrpcStatus(error.code)).json({ success: false, error: error.message });
  }
});

function mapGrpcStatus(code) {
  const mapping = { 3: 400, 5: 404, 6: 409, 9: 400, 13: 500, 14: 503 };
  return mapping[code] || 500;
}

module.exports = router;
