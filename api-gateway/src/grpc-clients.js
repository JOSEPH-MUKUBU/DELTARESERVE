const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_DIR = path.join(__dirname, '..', '..', 'proto');

const loaderOptions = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
};

// === Charger les fichiers .proto ===

const roomDef = protoLoader.loadSync(path.join(PROTO_DIR, 'room.proto'), loaderOptions);
const bookingDef = protoLoader.loadSync(path.join(PROTO_DIR, 'booking.proto'), loaderOptions);
const notificationDef = protoLoader.loadSync(path.join(PROTO_DIR, 'notification.proto'), loaderOptions);

const roomProto = grpc.loadPackageDefinition(roomDef).room;
const bookingProto = grpc.loadPackageDefinition(bookingDef).booking;
const notificationProto = grpc.loadPackageDefinition(notificationDef).notification;

// === Créer les clients gRPC ===

const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL || 'localhost:50051';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'localhost:50052';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'localhost:50053';

const roomClient = new roomProto.RoomService(
  ROOM_SERVICE_URL,
  grpc.credentials.createInsecure()
);

const bookingClient = new bookingProto.BookingService(
  BOOKING_SERVICE_URL,
  grpc.credentials.createInsecure()
);

const notificationClient = new notificationProto.NotificationService(
  NOTIFICATION_SERVICE_URL,
  grpc.credentials.createInsecure()
);

console.log('[api-gateway] 🔗 Clients gRPC configurés:');
console.log(`  → room-service:         ${ROOM_SERVICE_URL}`);
console.log(`  → booking-service:      ${BOOKING_SERVICE_URL}`);
console.log(`  → notification-service: ${NOTIFICATION_SERVICE_URL}`);

// === Helpers pour promisifier les appels gRPC ===

/**
 * Convertir un appel gRPC callback en Promise
 */
function grpcCall(client, method, data = {}) {
  return new Promise((resolve, reject) => {
    client[method](data, { deadline: new Date(Date.now() + 10000) }, (error, response) => {
      if (error) {
        reject({
          code: error.code || 13,
          message: error.details || error.message || 'Erreur gRPC inconnue',
          grpcCode: error.code
        });
      } else {
        resolve(response);
      }
    });
  });
}

// === Exports ===

module.exports = {
  roomClient,
  bookingClient,
  notificationClient,
  grpcCall,
  // Raccourcis
  rooms: {
    getAll: (data) => grpcCall(roomClient, 'GetAllRooms', data),
    getOne: (data) => grpcCall(roomClient, 'GetRoom', data),
    search: (data) => grpcCall(roomClient, 'SearchRooms', data),
    create: (data) => grpcCall(roomClient, 'CreateRoom', data),
    update: (data) => grpcCall(roomClient, 'UpdateRoom', data),
    delete: (data) => grpcCall(roomClient, 'DeleteRoom', data),
    checkAvailability: (data) => grpcCall(roomClient, 'CheckAvailability', data)
  },
  bookings: {
    create: (data) => grpcCall(bookingClient, 'CreateBooking', data),
    getOne: (data) => grpcCall(bookingClient, 'GetBooking', data),
    getAll: (data) => grpcCall(bookingClient, 'GetAllBookings', data),
    getByUser: (data) => grpcCall(bookingClient, 'GetUserBookings', data),
    update: (data) => grpcCall(bookingClient, 'UpdateBooking', data),
    cancel: (data) => grpcCall(bookingClient, 'CancelBooking', data),
    updateStatus: (data) => grpcCall(bookingClient, 'UpdateBookingStatus', data)
  },
  notifications: {
    send: (data) => grpcCall(notificationClient, 'SendNotification', data),
    getAll: (data) => grpcCall(notificationClient, 'GetNotifications', data),
    getOne: (data) => grpcCall(notificationClient, 'GetNotification', data),
    processPayment: (data) => grpcCall(notificationClient, 'ProcessPayment', data),
    getPayments: (data) => grpcCall(notificationClient, 'GetPayments', data),
    getPayment: (data) => grpcCall(notificationClient, 'GetPayment', data)
  }
};
