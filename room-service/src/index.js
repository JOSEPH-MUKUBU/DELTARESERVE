const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const handlers = require('./handlers');

const PROTO_PATH = path.join(__dirname, '..', '..', 'proto', 'room.proto');
const PORT = process.env.ROOM_SERVICE_PORT || 50051;

// Charger le fichier .proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const roomProto = grpc.loadPackageDefinition(packageDefinition).room;

// Créer le serveur gRPC
function startServer() {
  const server = new grpc.Server();

  // Enregistrer les méthodes du service
  server.addService(roomProto.RoomService.service, {
    GetAllRooms: handlers.getAllRooms,
    GetRoom: handlers.getRoom,
    SearchRooms: handlers.searchRooms,
    CreateRoom: handlers.createRoom,
    UpdateRoom: handlers.updateRoom,
    DeleteRoom: handlers.deleteRoom,
    CheckAvailability: handlers.checkAvailability
  });

  // Démarrer le serveur
  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('[room-service] ❌ Erreur de démarrage:', error);
        process.exit(1);
      }
      console.log('═══════════════════════════════════════════');
      console.log('  🏢 DELTARESERVE — Room Service');
      console.log(`  📡 gRPC Server en écoute sur le port ${port}`);
      console.log('  💾 Base de données: SQLite3');
      console.log('═══════════════════════════════════════════');
    }
  );
}

startServer();
