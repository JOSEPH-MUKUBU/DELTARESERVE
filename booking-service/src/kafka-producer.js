const { Kafka } = require('kafkajs');

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';

const kafka = new Kafka({
  clientId: 'booking-service',
  brokers: [KAFKA_BROKER],
  retry: {
    initialRetryTime: 1000,
    retries: 1
  }
});

const producer = kafka.producer();

let isConnected = false;

/**
 * Connecter le producteur Kafka
 */
async function connectProducer() {
  try {
    await producer.connect();
    isConnected = true;
    console.log('[booking-service] 📨 Kafka Producer connecté');
  } catch (error) {
    console.warn('[booking-service] ⚠️ Kafka Producer non connecté (Kafka indisponible):', error.message);
    console.warn('[booking-service] ℹ️ Le service fonctionne sans Kafka — les événements ne seront pas publiés');
    isConnected = false;
  }
}

/**
 * Publier un événement sur un topic Kafka
 * @param {string} topic - Nom du topic
 * @param {object} message - Message à publier
 */
async function publishEvent(topic, message) {
  if (!isConnected) {
    console.warn(`[booking-service] ⚠️ Kafka non connecté — événement '${topic}' non publié`);
    return;
  }

  try {
    await producer.send({
      topic,
      messages: [
        {
          key: message.id || message.booking_id || 'default',
          value: JSON.stringify({
            ...message,
            timestamp: new Date().toISOString(),
            source: 'booking-service'
          })
        }
      ]
    });
    console.log(`[booking-service] 📤 Événement publié sur '${topic}':`, JSON.stringify(message));
  } catch (error) {
    console.error(`[booking-service] ❌ Erreur publication Kafka '${topic}':`, error.message);
  }
}

/**
 * Publier un événement "booking.created"
 */
async function publishBookingCreated(booking) {
  await publishEvent('booking.created', {
    event: 'booking.created',
    booking_id: booking.id,
    room_id: booking.room_id,
    user_id: booking.user_id,
    user_name: booking.user_name,
    user_email: booking.user_email,
    date_debut: booking.date_debut,
    date_fin: booking.date_fin,
    montant: booking.montant,
    motif: booking.motif
  });
}

/**
 * Publier un événement "booking.cancelled"
 */
async function publishBookingCancelled(booking) {
  await publishEvent('booking.cancelled', {
    event: 'booking.cancelled',
    booking_id: booking.id,
    room_id: booking.room_id,
    user_id: booking.user_id,
    user_name: booking.user_name,
    user_email: booking.user_email,
    motif_annulation: booking.motif_annulation || 'Non spécifié'
  });
}

// Connecter un consumer pour écouter les payment.processed (optionnel)
const consumer = kafka.consumer({ groupId: 'booking-service-group' });

async function connectConsumer(onPaymentProcessed) {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'payment.processed', fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const data = JSON.parse(message.value.toString());
        console.log(`[booking-service] 📥 Événement reçu sur '${topic}':`, JSON.stringify(data));

        if (onPaymentProcessed) {
          onPaymentProcessed(data);
        }
      }
    });

    console.log('[booking-service] 📥 Kafka Consumer connecté (topic: payment.processed)');
  } catch (error) {
    console.warn('[booking-service] ⚠️ Kafka Consumer non connecté:', error.message);
  }
}

/**
 * Déconnecter proprement
 */
async function disconnect() {
  try {
    if (isConnected) await producer.disconnect();
    await consumer.disconnect();
  } catch (e) {
    // Silently ignore
  }
}

module.exports = {
  connectProducer,
  publishBookingCreated,
  publishBookingCancelled,
  connectConsumer,
  disconnect
};
