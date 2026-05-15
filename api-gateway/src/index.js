const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const path = require('path');

// Import routes REST
const roomsRouter = require('./routes/rooms');
const bookingsRouter = require('./routes/bookings');
const notificationsRouter = require('./routes/notifications');

// Import GraphQL
const typeDefs = require('./graphql/schema');
const resolvers = require('./graphql/resolvers');

const PORT = process.env.API_GATEWAY_PORT || 3000;

async function startServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // Servir les fichiers statiques du client web
  app.use(express.static(path.join(__dirname, '..', '..', 'client')));

  // === Route de santé ===
  app.get('/api/health', (req, res) => {
    res.json({
      service: 'DELTARESERVE API Gateway',
      status: 'running',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        rest: {
          rooms: '/api/rooms',
          bookings: '/api/bookings',
          notifications: '/api/notifications',
          payments: '/api/notifications/payments/all'
        },
        graphql: '/graphql'
      }
    });
  });

  // === Routes REST ===
  app.use('/api/rooms', roomsRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/notifications', notificationsRouter);

  // Route /api/payments (raccourci)
  app.get('/api/payments', async (req, res) => {
    try {
      const { notifications: notifClient } = require('./grpc-clients');
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const result = await notifClient.getPayments({ page, limit });
      res.json({ success: true, data: result.payments || [], total: result.total });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // === GraphQL (Apollo Server 4) ===
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
    formatError: (error) => {
      console.error('[api-gateway] ❌ GraphQL Error:', error.message);
      return {
        message: error.message,
        path: error.path,
        extensions: error.extensions
      };
    }
  });

  await apolloServer.start();

  app.use('/graphql', expressMiddleware(apolloServer, {
    context: async ({ req }) => ({
      headers: req.headers
    })
  }));

  // === Route fallback pour le client SPA ===
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/graphql')) {
      res.sendFile(path.join(__dirname, '..', '..', 'client', 'index.html'));
    } else {
      res.status(404).json({ success: false, error: 'Endpoint non trouvé' });
    }
  });

  // === Démarrer le serveur ===
  app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                                                          ║');
    console.log('║     🚀 DELTARESERVE — API Gateway                        ║');
    console.log('║                                                          ║');
    console.log(`║     🌐 REST API:    http://localhost:${PORT}/api            ║`);
    console.log(`║     📊 GraphQL:     http://localhost:${PORT}/graphql        ║`);
    console.log(`║     🖥️  Client Web:  http://localhost:${PORT}               ║`);
    console.log('║                                                          ║');
    console.log('║     📡 Microservices (gRPC):                             ║');
    console.log('║        → room-service:         localhost:50051            ║');
    console.log('║        → booking-service:      localhost:50052            ║');
    console.log('║        → notification-service: localhost:50053            ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
  });
}

startServer().catch(error => {
  console.error('[api-gateway] ❌ Erreur fatale:', error);
  process.exit(1);
});
