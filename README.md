#  DELTARESERVE

**Plateforme de Réservation Intelligente de Salles de Fête et de Conférence**

> Projet académique — SoA et Microservices — Dr. Salah Gontara  
> Auteur : **Joseph Mukubu Kapoya** | Année : 2025-2026

---

##  Description

DELTARESERVE est une plateforme de réservation intelligente permettant aux utilisateurs de rechercher, consulter et réserver des salles de fête ou de conférence. L'application utilise une architecture **microservices** avec communication **gRPC**, messagerie **Apache Kafka**, et une **API Gateway** exposant des endpoints **REST** et **GraphQL**.

##  Architecture

```
┌─────────────┐      REST / GraphQL      ┌──────────────┐
│   Client    │◄────────────────────────►│  API Gateway  │
│  (Browser)  │     HTTP/1.1 + JSON      │   (Express)   │
└─────────────┘                          └──────┬───────┘
                                                │ gRPC / HTTP/2 + Protobuf
                    ┌───────────────────────────┼───────────────────────────┐
                    ▼                           ▼                           ▼
             ┌─────────────┐          ┌─────────────┐          ┌─────────────────┐
             │ room-service│          │booking-serv. │          │notification-serv│
             │  :50051     │          │  :50052      │          │  :50053         │
             └──────┬──────┘          └──────┬──────┘          └──────┬──────────┘
                    │                        │                        │
             ┌──────▼──────┐          ┌──────▼──────┐          ┌──────▼──────┐
             │   SQLite3   │          │   SQLite3   │          │ RxDB/NoSQL  │
             └─────────────┘          └─────────────┘          └─────────────┘
                                      ▲         │
                                      │  Kafka  │
                                      └─────────┘
```

##  Structure du Projet

```
DELTARESERVE/
├── proto/                      # Fichiers Protobuf (.proto)
│   ├── room.proto
│   ├── booking.proto
│   └── notification.proto
├── room-service/               # Microservice 1 — Gestion des salles
│   └── src/
│       ├── index.js            # Serveur gRPC (:50051)
│       ├── db.js               # SQLite3
│       └── handlers.js         # Logique métier
├── booking-service/            # Microservice 2 — Gestion des réservations
│   └── src/
│       ├── index.js            # Serveur gRPC (:50052)
│       ├── db.js               # SQLite3
│       ├── handlers.js         # Logique métier
│       └── kafka-producer.js   # Producteur Kafka
├── notification-service/       # Microservice 3 — Notifications & Paiement
│   └── src/
│       ├── index.js            # Serveur gRPC (:50053)
│       ├── db.js               # RxDB/NoSQL (JSON)
│       ├── handlers.js         # Logique métier
│       └── kafka.js            # Consommateur/Producteur Kafka
├── api-gateway/                # API Gateway — REST + GraphQL
│   └── src/
│       ├── index.js            # Serveur Express (:3000)
│       ├── grpc-clients.js     # Clients gRPC
│       ├── routes/             # Routes REST
│       └── graphql/            # Schéma & Resolvers GraphQL
├── client/                     # Interface web
│   ├── index.html
│   ├── style.css
│   └── app.js
├── docker-compose.yml          # Kafka + Zookeeper
└── README.md
```

##  Prérequis

- **Node.js** v18+ 
- **Docker** et **Docker Compose** (pour Kafka)
- **npm** (inclus avec Node.js)

##  Installation et Exécution

### 1. Installer les dépendances

```bash
# Depuis la racine du projet
cd room-service && npm install
cd ../booking-service && npm install
cd ../notification-service && npm install
cd ../api-gateway && npm install
```

### 2. Démarrer Kafka (Docker)

```bash
docker-compose up -d
```

### 3. Démarrer les microservices (dans des terminaux séparés)

```bash
# Terminal 1 — Room Service
cd room-service && node src/index.js

# Terminal 2 — Booking Service
cd booking-service && node src/index.js

# Terminal 3 — Notification Service
cd notification-service && node src/index.js

# Terminal 4 — API Gateway
cd api-gateway && node src/index.js
```

### 4. Accéder à l'application

- **Client Web** : http://localhost:3000
- **API REST** : http://localhost:3000/api
- **GraphQL** : http://localhost:3000/graphql

> **Note** : Les services fonctionnent même sans Kafka (les événements ne seront simplement pas publiés).

##  Endpoints REST

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/rooms` | Liste des salles |
| GET | `/api/rooms/:id` | Détail d'une salle |
| GET | `/api/rooms/search?type=&capacity=&ville=` | Recherche filtrée |
| POST | `/api/rooms` | Créer une salle (admin) |
| PUT | `/api/rooms/:id` | Modifier une salle |
| DELETE | `/api/rooms/:id` | Supprimer une salle |
| POST | `/api/bookings` | Créer une réservation |
| GET | `/api/bookings/:id` | Consulter une réservation |
| PUT | `/api/bookings/:id` | Modifier une réservation |
| DELETE | `/api/bookings/:id` | Annuler une réservation |
| PUT | `/api/bookings/:id/status` | Changer le statut (admin) |
| GET | `/api/notifications` | Historique des notifications |
| GET | `/api/payments` | Liste des paiements |

##  Requêtes GraphQL

```graphql
# Lister les salles avec champs personnalisés
query {
  rooms {
    id, nom, capacite, prix, disponible, equipements
  }
}

# Réservations d'un utilisateur
query {
  bookings(userId: "user-001") {
    id, statut, montant, date_debut, date_fin
    room { nom, localisation }
  }
}

# Créer une réservation
mutation {
  createBooking(input: {
    room_id: "room-001"
    user_id: "user-010"
    user_name: "Jean Dupont"
    user_email: "jean@email.com"
    date_debut: "2026-07-01"
    date_fin: "2026-07-02"
    motif: "Séminaire"
  }) {
    id, statut, montant
  }
}
```

##  Topics Kafka

| Topic | Producteur | Consommateur | Déclencheur |
|-------|------------|--------------|-------------|
| `booking.created` | booking-service | notification-service | Création réservation |
| `booking.cancelled` | booking-service | notification-service | Annulation réservation |
| `payment.processed` | notification-service | booking-service | Paiement traité |
| `notification.sent` | notification-service | — (log) | Confirmation envoyée |

##  Bases de Données

| Microservice | Type | Technologie | Justification |
|---|---|---|---|
| room-service | SQL | SQLite3 | Structure relationnelle fixe |
| booking-service | SQL | SQLite3 | Intégrité transactionnelle |
| notification-service | NoSQL | JSON/RxDB | Flexibilité des logs |

##  Ports

| Service | Port |
|---------|------|
| API Gateway (REST + GraphQL) | 3000 |
| room-service (gRPC) | 50051 |
| booking-service (gRPC) | 50052 |
| notification-service (gRPC) | 50053 |
| Kafka Broker | 9092 |
| Zookeeper | 2181 |

---

**Auteur** : Joseph Mukubu Kapoya  
**Date** : Mai 2026
