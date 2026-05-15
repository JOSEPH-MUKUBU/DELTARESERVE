const { rooms, bookings, notifications } = require('../grpc-clients');

/**
 * Resolvers GraphQL pour DELTARESERVE
 * Chaque resolver appelle le microservice approprié via gRPC
 */
const resolvers = {
  Query: {
    // === Salles ===
    rooms: async (_, { page, limit }) => {
      try {
        const result = await rooms.getAll({ page: page || 1, limit: limit || 20 });
        return result.rooms.map(parseRoom);
      } catch (error) {
        throw new Error(`Erreur récupération des salles: ${error.message}`);
      }
    },

    room: async (_, { id }) => {
      try {
        const room = await rooms.getOne({ id });
        return parseRoom(room);
      } catch (error) {
        throw new Error(`Salle '${id}' introuvable: ${error.message}`);
      }
    },

    searchRooms: async (_, { type, capacite_min, localisation, prix_max }) => {
      try {
        const result = await rooms.search({
          type: type || '',
          capacite_min: capacite_min || 0,
          localisation: localisation || '',
          prix_max: prix_max || 0
        });
        return result.rooms.map(parseRoom);
      } catch (error) {
        throw new Error(`Erreur recherche de salles: ${error.message}`);
      }
    },

    checkAvailability: async (_, { room_id, date_debut, date_fin }) => {
      try {
        return await rooms.checkAvailability({ room_id, date_debut, date_fin });
      } catch (error) {
        throw new Error(`Erreur vérification disponibilité: ${error.message}`);
      }
    },

    // === Réservations ===
    bookings: async (_, { userId, page, limit }) => {
      try {
        let result;
        if (userId) {
          result = await bookings.getByUser({ user_id: userId });
        } else {
          result = await bookings.getAll({ page: page || 1, limit: limit || 20 });
        }
        return result.bookings || [];
      } catch (error) {
        throw new Error(`Erreur récupération des réservations: ${error.message}`);
      }
    },

    booking: async (_, { id }) => {
      try {
        return await bookings.getOne({ id });
      } catch (error) {
        throw new Error(`Réservation '${id}' introuvable: ${error.message}`);
      }
    },

    allBookings: async (_, { page, limit }) => {
      try {
        const result = await bookings.getAll({ page: page || 1, limit: limit || 20 });
        return result.bookings || [];
      } catch (error) {
        throw new Error(`Erreur récupération des réservations: ${error.message}`);
      }
    },

    // === Notifications ===
    notifications: async (_, { type, page, limit }) => {
      try {
        const result = await notifications.getAll({
          page: page || 1,
          limit: limit || 20,
          type: type || ''
        });
        return result.notifications || [];
      } catch (error) {
        throw new Error(`Erreur récupération des notifications: ${error.message}`);
      }
    },

    notification: async (_, { id }) => {
      try {
        return await notifications.getOne({ id });
      } catch (error) {
        throw new Error(`Notification '${id}' introuvable: ${error.message}`);
      }
    },

    // === Paiements ===
    payments: async (_, { page, limit }) => {
      try {
        const result = await notifications.getPayments({
          page: page || 1,
          limit: limit || 20
        });
        return result.payments || [];
      } catch (error) {
        throw new Error(`Erreur récupération des paiements: ${error.message}`);
      }
    },

    payment: async (_, { id }) => {
      try {
        return await notifications.getPayment({ id });
      } catch (error) {
        throw new Error(`Paiement '${id}' introuvable: ${error.message}`);
      }
    }
  },

  Mutation: {
    // Créer une réservation
    createBooking: async (_, { input }) => {
      try {
        // Vérifier la salle et récupérer le prix
        let room;
        try {
          room = await rooms.getOne({ id: input.room_id });
        } catch (err) {
          throw new Error(`Salle '${input.room_id}' introuvable`);
        }

        // Vérifier la disponibilité
        try {
          const availability = await rooms.checkAvailability({
            room_id: input.room_id,
            date_debut: input.date_debut,
            date_fin: input.date_fin
          });
          if (!availability.disponible) {
            throw new Error(availability.message || 'Salle non disponible');
          }
        } catch (err) {
          if (err.message.includes('non disponible') || err.message.includes('réservée')) {
            throw err;
          }
          // Si erreur de connexion, continuer
        }

        // Calculer le montant
        const days = Math.max(1, Math.ceil(
          (new Date(input.date_fin) - new Date(input.date_debut)) / (1000 * 60 * 60 * 24)
        ));
        const montant = room.prix * days;

        const booking = await bookings.create({
          room_id: input.room_id,
          user_id: input.user_id,
          user_name: input.user_name,
          user_email: input.user_email,
          date_debut: input.date_debut,
          date_fin: input.date_fin,
          motif: input.motif || '',
          montant
        });

        return booking;
      } catch (error) {
        throw new Error(`Erreur création réservation: ${error.message}`);
      }
    },

    // Modifier une réservation
    updateBooking: async (_, { id, input }) => {
      try {
        return await bookings.update({
          id,
          date_debut: input.date_debut || '',
          date_fin: input.date_fin || '',
          motif: input.motif || ''
        });
      } catch (error) {
        throw new Error(`Erreur modification réservation: ${error.message}`);
      }
    },

    // Annuler une réservation
    cancelBooking: async (_, { id, motif }) => {
      try {
        return await bookings.cancel({
          id,
          motif_annulation: motif || ''
        });
      } catch (error) {
        throw new Error(`Erreur annulation réservation: ${error.message}`);
      }
    },

    // Mettre à jour le statut (admin)
    updateBookingStatus: async (_, { id, statut }) => {
      try {
        return await bookings.updateStatus({ id, statut });
      } catch (error) {
        throw new Error(`Erreur mise à jour statut: ${error.message}`);
      }
    },

    // Créer une salle (admin)
    createRoom: async (_, { input }) => {
      try {
        const room = await rooms.create({
          nom: input.nom,
          type: input.type,
          capacite: input.capacite,
          equipements: JSON.stringify(input.equipements || []),
          prix: input.prix,
          localisation: input.localisation,
          description: input.description || ''
        });
        return parseRoom(room);
      } catch (error) {
        throw new Error(`Erreur création salle: ${error.message}`);
      }
    },

    // Supprimer une salle (admin)
    deleteRoom: async (_, { id }) => {
      try {
        const result = await rooms.delete({ id });
        return result.success;
      } catch (error) {
        throw new Error(`Erreur suppression salle: ${error.message}`);
      }
    }
  },

  // Resolver de champ pour enrichir les données
  Booking: {
    room: async (booking) => {
      try {
        if (booking.room_id) {
          const room = await rooms.getOne({ id: booking.room_id });
          return parseRoom(room);
        }
        return null;
      } catch (error) {
        return null;
      }
    }
  }
};

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

module.exports = resolvers;
