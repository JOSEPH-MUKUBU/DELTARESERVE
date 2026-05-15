const typeDefs = `#graphql
  # DELTARESERVE — Schéma GraphQL

  # Types principaux
  type Room {
    id: ID!
    nom: String!
    type: String!
    capacite: Int!
    equipements: [String]
    prix: Float!
    localisation: String!
    description: String
    disponible: Boolean!
    created_at: String
    updated_at: String
  }

  type Booking {
    id: ID!
    room_id: String!
    user_id: String!
    user_name: String!
    user_email: String!
    date_debut: String!
    date_fin: String!
    statut: String!
    montant: Float!
    motif: String
    created_at: String
    updated_at: String
    room: Room
  }

  type Notification {
    id: ID!
    type: String!
    destinataire: String!
    sujet: String!
    contenu: String
    statut: String!
    booking_id: String
    created_at: String
  }

  type Payment {
    id: ID!
    booking_id: String!
    montant: Float!
    statut: String!
    methode: String
    transaction_id: String
    user_id: String
    created_at: String
  }

  type Availability {
    disponible: Boolean!
    room_id: String!
    message: String
  }

  # Inputs
  input CreateBookingInput {
    room_id: String!
    user_id: String!
    user_name: String!
    user_email: String!
    date_debut: String!
    date_fin: String!
    motif: String
  }

  input UpdateBookingInput {
    date_debut: String
    date_fin: String
    motif: String
  }

  input CreateRoomInput {
    nom: String!
    type: String!
    capacite: Int!
    equipements: [String]
    prix: Float!
    localisation: String!
    description: String
  }

  type Query {
    rooms(page: Int, limit: Int): [Room]
    room(id: ID!): Room
    searchRooms(type: String, capacite_min: Int, localisation: String, prix_max: Float): [Room]
    checkAvailability(room_id: String!, date_debut: String!, date_fin: String!): Availability
    bookings(userId: String, page: Int, limit: Int): [Booking]
    booking(id: ID!): Booking
    allBookings(page: Int, limit: Int): [Booking]
    notifications(type: String, page: Int, limit: Int): [Notification]
    notification(id: ID!): Notification
    payments(page: Int, limit: Int): [Payment]
    payment(id: ID!): Payment
  }

  type Mutation {
    createBooking(input: CreateBookingInput!): Booking
    updateBooking(id: ID!, input: UpdateBookingInput!): Booking
    cancelBooking(id: ID!, motif: String): Booking
    updateBookingStatus(id: ID!, statut: String!): Booking
    createRoom(input: CreateRoomInput!): Room
    deleteRoom(id: ID!): Boolean
  }
`;

module.exports = typeDefs;
