const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const handlers = require('./handlers');
const kafka = require('./kafka-producer');

const PROTO_PATH = path.join(__dirname, '..', '..', 'proto', 'booking.proto');
const PORT = process.env.BOOKING_SERVICE_PORT || 50052;

// Charger le fichier .proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const bookingProto = grpc.loadPackageDefinition(packageDefinition).booking;

// Créer et démarrer le serveur gRPC
async function startServer() {
  // Connecter Kafka
  await kafka.connectProducer();
  await kafka.connectConsumer(handlers.onPaymentProcessed);

  const server = new grpc.Server();

  // Enregistrer les méthodes du service
  server.addService(bookingProto.BookingService.service, {
    CreateBooking: handlers.createBooking,
    GetBooking: handlers.getBooking,
    GetAllBookings: handlers.getAllBookings,
    GetUserBookings: handlers.getUserBookings,
    UpdateBooking: handlers.updateBooking,
    CancelBooking: handlers.cancelBooking,
    UpdateBookingStatus: handlers.updateBookingStatus
  });

  // Démarrer le serveur
  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('[booking-service] ❌ Erreur de démarrage:', error);
        process.exit(1);
      }
      console.log('═══════════════════════════════════════════');
      console.log('  📅 DELTARESERVE — Booking Service');
      console.log(`  📡 gRPC Server en écoute sur le port ${port}`);
      console.log('  💾 Base de données: SQLite3');
      console.log('  📨 Kafka: Producteur (booking.created, booking.cancelled)');
      console.log('  📥 Kafka: Consommateur (payment.processed)');
      console.log('═══════════════════════════════════════════');
    }
  );
}

// Gestion de l'arrêt propre
process.on('SIGTERM', async () => {
  console.log('[booking-service] Arrêt en cours...');
  await kafka.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[booking-service] Arrêt en cours...');
  await kafka.disconnect();
  process.exit(0);
});

startServer();
