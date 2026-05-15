const { Kafka } = require('kafkajs');

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: [KAFKA_BROKER],
  retry: {
    initialRetryTime: 1000,
    retries: 1
  }
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'notification-service-group' });

let isProducerConnected = false;
let isConsumerConnected = false;

/**
 * Connecter le producteur Kafka
 */
async function connectProducer() {
  try {
    await producer.connect();
    isProducerConnected = true;
    console.log('[notification-service] 📤 Kafka Producer connecté');
  } catch (error) {
    console.warn('[notification-service] ⚠️ Kafka Producer non connecté:', error.message);
    isProducerConnected = false;
  }
}

/**
 * Connecter le consommateur Kafka et s'abonner aux topics
 */
async function connectConsumer(handlers) {
  try {
    await consumer.connect();
    await consumer.subscribe({ topics: ['booking.created', 'booking.cancelled'], fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          console.log(`[notification-service] 📥 Événement reçu sur '${topic}':`, JSON.stringify(data));

          switch (topic) {
            case 'booking.created':
              if (handlers.onBookingCreated) {
                await handlers.onBookingCreated(data);
              }
              break;
            case 'booking.cancelled':
              if (handlers.onBookingCancelled) {
                await handlers.onBookingCancelled(data);
              }
              break;
            default:
              console.warn(`[notification-service] ⚠️ Topic inconnu: ${topic}`);
          }
        } catch (parseError) {
          console.error('[notification-service] ❌ Erreur parsing message Kafka:', parseError.message);
        }
      }
    });

    isConsumerConnected = true;
    console.log('[notification-service] 📥 Kafka Consumer connecté (topics: booking.created, booking.cancelled)');
  } catch (error) {
    console.warn('[notification-service] ⚠️ Kafka Consumer non connecté:', error.message);
    isConsumerConnected = false;
  }
}

/**
 * Publier un événement sur un topic Kafka
 */
async function publishEvent(topic, message) {
  if (!isProducerConnected) {
    console.warn(`[notification-service] ⚠️ Kafka non connecté — événement '${topic}' non publié`);
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
            source: 'notification-service'
          })
        }
      ]
    });
    console.log(`[notification-service] 📤 Événement publié sur '${topic}':`, JSON.stringify(message));
  } catch (error) {
    console.error(`[notification-service] ❌ Erreur publication Kafka '${topic}':`, error.message);
  }
}

/**
 * Publier un événement "payment.processed"
 */
async function publishPaymentProcessed(payment) {
  await publishEvent('payment.processed', {
    event: 'payment.processed',
    payment_id: payment.id,
    booking_id: payment.booking_id,
    montant: payment.montant,
    statut: payment.statut,
    transaction_id: payment.transaction_id
  });
}

/**
 * Publier un événement "notification.sent"
 */
async function publishNotificationSent(notification) {
  await publishEvent('notification.sent', {
    event: 'notification.sent',
    notification_id: notification.id,
    type: notification.type,
    destinataire: notification.destinataire,
    statut: notification.statut
  });
}

/**
 * Déconnecter proprement
 */
async function disconnect() {
  try {
    if (isProducerConnected) await producer.disconnect();
    if (isConsumerConnected) await consumer.disconnect();
  } catch (e) {
    // Silently ignore
  }
}

module.exports = {
  connectProducer,
  connectConsumer,
  publishPaymentProcessed,
  publishNotificationSent,
  disconnect
};
