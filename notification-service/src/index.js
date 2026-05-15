const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const handlers = require('./handlers');
const kafka = require('./kafka');

const PROTO_PATH = path.join(__dirname, '..', '..', 'proto', 'notification.proto');
const PORT = process.env.NOTIFICATION_SERVICE_PORT || 50053;

// Charger le fichier .proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const notificationProto = grpc.loadPackageDefinition(packageDefinition).notification;

// Créer et démarrer le serveur gRPC
async function startServer() {
  // Connecter Kafka
  await kafka.connectProducer();
  await kafka.connectConsumer({
    onBookingCreated: handlers.onBookingCreated,
    onBookingCancelled: handlers.onBookingCancelled
  });

  const server = new grpc.Server();

  // Enregistrer les méthodes du service
  server.addService(notificationProto.NotificationService.service, {
    SendNotification: handlers.sendNotification,
    GetNotifications: handlers.getNotifications,
    GetNotification: handlers.getNotification,
    ProcessPayment: handlers.processPayment,
    GetPayments: handlers.getPayments,
    GetPayment: handlers.getPayment
  });

  // Démarrer le serveur
  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('[notification-service] ❌ Erreur de démarrage:', error);
        process.exit(1);
      }
      console.log('═══════════════════════════════════════════');
      console.log('  🔔 DELTARESERVE — Notification Service');
      console.log(`  📡 gRPC Server en écoute sur le port ${port}`);
      console.log('  💾 Base de données: RxDB/NoSQL (JSON)');
      console.log('  📥 Kafka: Consommateur (booking.created, booking.cancelled)');
      console.log('  📤 Kafka: Producteur (payment.processed, notification.sent)');
      console.log('═══════════════════════════════════════════');
    }
  );
}

// Gestion de l'arrêt propre
process.on('SIGTERM', async () => {
  console.log('[notification-service] Arrêt en cours...');
  await kafka.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[notification-service] Arrêt en cours...');
  await kafka.disconnect();
  process.exit(0);
});

startServer();
