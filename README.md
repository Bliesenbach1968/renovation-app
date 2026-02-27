# Sanierungsprojekt-Management-Software

Webbasierte Mehrbenutzer-Software zur Verwaltung und Kalkulation von Gebäudesanierungen.

## Funktionen

- **Projekte** anlegen mit Adresse, Auftraggeber, Zeitplan und Team
- **Gebäudestruktur**: Unbegrenzt viele Etagen (Tiefgarage bis Dachgeschoss) und Räume
- **3 Projektphasen**: Entkernung / Renovierung / Dachausbau
- **Positionen** pro Raum und Phase mit automatischer Kostenkalkulation:
  - Materialkosten, Entsorgungskosten, Arbeitskosten (Menge × Stunden × Stundensatz)
- **Container-Management** mit automatischem Bedarfsvorschlag
- **Positionsvorlagen**: 35 vordefinierte Systemvorlagen (erweiterbar)
- **Kostenzusammenfassung**: Phasensummen + Gesamtprojektkosten
- **Zeitplanung**: Soll/Ist-Vergleich mit Verzögerungsberechnung in Tagen, Wochen und Prozent
- **Rollen**: Admin, Projektleiter, Kalkulator, Ausführend, Extern (Lesend)
- **Audit-Trail**: Wer hat was wann geändert?

---

## Schnellstart (Docker)

### 1. Voraussetzungen
- Docker + Docker Compose installiert
- Node.js v20 (für lokale Entwicklung)

### 2. Konfiguration
```bash
cp .env.example .env
# .env anpassen: MONGO_PASS und JWT_SECRET unbedingt ändern!
```

### 3. Starten
```bash
docker-compose up -d
```

### 4. Admin-Nutzer & Vorlagen anlegen
```bash
# Backend-Container betreten und Seed-Script ausführen:
docker exec -it renovation_backend node src/scripts/seed.js

# Oder lokal (wenn MongoDB läuft):
cd backend && npm run seed
```

### 5. Anwendung aufrufen
- **Frontend**: http://localhost
- **API**: http://localhost:3000/api/v1
- **Login**: admin@sanierung.de / Admin1234!

> **Wichtig**: Passwort nach dem ersten Login unbedingt ändern!

---

## Lokale Entwicklung

### Backend
```bash
cd backend
cp ../.env.example .env   # .env anpassen
npm install
npm run dev               # Startet auf Port 3000
```

### Frontend
```bash
cd frontend
npm install
npm run dev               # Startet auf Port 5173
```

### Nur MongoDB via Docker
```bash
docker run -d --name mongo \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=changeme \
  -p 27017:27017 mongo:7
```

Backend `.env`:
```
MONGO_URI=mongodb://admin:changeme@localhost:27017/renovationdb?authSource=admin
```

---

## Projektstruktur

```
renovation-app/
├── backend/
│   ├── src/
│   │   ├── config/          Datenbankverbindung
│   │   ├── models/          Mongoose-Modelle (User, Project, Floor, Room, Position, ...)
│   │   ├── routes/          Express-Router
│   │   ├── controllers/     Business-Logik
│   │   ├── middleware/       Auth, Rollen, Audit, Fehlerbehandlung
│   │   ├── utils/           Berechnungen, Projektsnummern, Logger
│   │   └── scripts/         Seed-Script
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/             API-Client-Funktionen
│   │   ├── components/      Wiederverwendbare Komponenten
│   │   ├── context/         Auth-Context
│   │   ├── pages/           Seiten-Komponenten
│   │   └── types/           TypeScript-Typen
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## API-Endpunkte (Übersicht)

| Methode | Pfad | Beschreibung |
|---|---|---|
| POST | /api/v1/auth/login | Anmelden |
| GET | /api/v1/projects | Alle Projekte |
| POST | /api/v1/projects | Neues Projekt |
| GET | /api/v1/projects/:id/summary | Gesamtkalkulation |
| GET | /api/v1/projects/:id/timeline | Zeitplanauswertung |
| GET | /api/v1/projects/:id/floors | Etagen |
| GET | /api/v1/projects/:id/rooms | Räume |
| GET | /api/v1/projects/:id/positions | Positionen (filterbar) |
| GET | /api/v1/projects/:id/containers/suggestion | Container-Vorschlag |
| GET | /api/v1/templates | Positionsvorlagen |

---

## Rollen & Berechtigungen

| Rolle | Projekte anlegen | Räume/Positionen | Lesen |
|---|---|---|---|
| Admin | ✓ | ✓ | ✓ |
| Projektleiter | ✓ | ✓ | ✓ |
| Kalkulator | – | ✓ | ✓ |
| Ausführend | – | (eingeschränkt) | ✓ |
| Extern | – | – | ✓ |

---

## Nächste Schritte (Erweiterungen)

- [ ] PDF-Export (Angebot/Kalkulation) via `pdfkit`
- [ ] Foto-Upload pro Raum via Multer + S3/Minio
- [ ] E-Mail-Benachrichtigungen bei Zeitplanabweichung
- [ ] Excel-Export (xlsx)
- [ ] Mobile PWA für die Baustelle
