# Sanierungsprojekt-Management-App

## Projektüberblick
Webbasierte Multi-User-Software zur Verwaltung von Gebäudesanierungen.
GitHub: https://github.com/Bliesenbach1968/renovation-app.git

## Stack
- **Backend**: Node.js + Express.js + MongoDB (Mongoose), Port 3000
- **Frontend**: React 18 + TypeScript 5.5 + Vite + Tailwind CSS, Port 5173 (nginx in Docker)
- **Datenbank**: MongoDB, intern via Docker-Netzwerk (kein externer Port)
- **React Query**: v3 (react-query@3.39.3) — nicht v4/v5!
- **PDF**: jsPDF + jspdf-autotable

## Docker starten
```bash
cd /c/Projekte/renovation-app
docker compose up -d          # starten
docker compose build --no-cache backend frontend  # neu bauen
docker compose down           # stoppen
```
App läuft auf http://localhost:5173

## Seed (Admin-User + Vorlagen anlegen)
```bash
docker exec -it renovation_backend node src/scripts/seed.js
```

## Projektstruktur
```
renovation-app/
├── backend/
│   ├── src/
│   │   ├── app.js               # Express-App, alle Routen registriert
│   │   ├── server.js
│   │   ├── config/db.js
│   │   ├── controllers/         # projectController, positionController, ...
│   │   ├── models/              # Project, Floor, Room, Position, Container, Geruest, Kran, ...
│   │   ├── routes/              # projects, floors, rooms, positions, containers, geruest, kran, ...
│   │   ├── middleware/          # authenticate, authorize, auditLog, errorHandler
│   │   ├── utils/               # calculations, projectNumber, logger
│   │   └── scripts/seed.js
│   └── .env                     # MONGO_URI, JWT_SECRET, PORT, FRONTEND_URL
└── frontend/
    └── src/
        ├── App.tsx              # Alle Routen
        ├── api/projects.ts      # Alle API-Funktionen
        ├── types/index.ts       # Alle TypeScript-Interfaces
        ├── components/Layout.tsx
        └── pages/
            ├── DashboardPage.tsx
            ├── ProjectDetailPage.tsx   # bg-sky-50 Hintergrund
            ├── BuildingPage.tsx        # Etagen-/Raum-Verwaltung (Level -3 bis 20)
            ├── RoomDetailPage.tsx
            ├── SummaryPage.tsx         # Kostenkalkulation + PDF-Download
            ├── TimelinePage.tsx
            ├── ContainerPage.tsx
            ├── GeruestPage.tsx
            ├── KranPage.tsx
            ├── NewProjectPage.tsx
            ├── EditProjectPage.tsx
            ├── AdminUsersPage.tsx
            └── AdminTemplatesPage.tsx
```

## Datenmodell – wichtige Zusammenhänge
- **Project** → hat `phases` (demolition, renovation, specialConstruction) als embedded Array
- **Floor** → `projectId`, `level` (-3 bis 20), `phaseType` (null = alle Phasen)
  - Level -2 = Tiefgarage, -1 = Keller, 0 = EG, 1-19 = OG, 20 = Dachgeschoss
  - Werden automatisch bei Projektanlage erstellt (aus etagenOhneKeller, kellerAnzahl, tiefgarage)
- **Room** → `projectId`, `floorId`, `unitId` (optional)
- **Position** → `projectId`, `roomId`, `phaseType`; Kosten werden per pre-save Hook berechnet
- **Container / Geruest / Kran** → `projectId`, `phaseType`; totalCost per pre-save Hook

## API-Routen (alle unter /api/v1)
```
GET/POST   /projects
GET/PUT/DELETE /projects/:id
GET        /projects/:id/summary    ← Kostenkalkulation (inkl. Container/Geruest/Kran)
GET        /projects/:id/timeline
GET        /projects/:id/audit
POST/DELETE /projects/:id/team/:userId

GET/POST   /projects/:projectId/floors
GET/POST   /projects/:projectId/rooms
GET/POST   /projects/:projectId/positions
GET/POST   /projects/:projectId/containers
GET        /projects/:projectId/containers/suggestion
GET/POST   /projects/:projectId/geruest
GET/POST   /projects/:projectId/kran

GET/POST   /templates
```

## Frontend-Routen
```
/                          DashboardPage
/projects/new              NewProjectPage
/projects/:id/edit         EditProjectPage
/projects/:id              ProjectDetailPage
/projects/:id/building     BuildingPage (Phase via ?phase=demolition|renovation|specialConstruction)
/projects/:id/rooms/:roomId RoomDetailPage
/projects/:id/summary      SummaryPage
/projects/:id/timeline     TimelinePage
/projects/:id/containers   ContainerPage
/projects/:id/geruest      GeruestPage
/projects/:id/kran         KranPage
/admin/users               AdminUsersPage
/admin/templates           AdminTemplatesPage
```

## Wichtige TypeScript-Eigenheiten
- `mutation.error` in React Query v3 ist `unknown` → immer `!= null` statt truthy check
- `phaseType` Cast nötig: `data.phaseType as PhaseType | 'all'`
- `jsPDF` textColor: akzeptiert `number` (255 = weiß) oder `[r,g,b]`

## Bekannte Konfiguration
- Docker mongo: kein externer Port (internes Netzwerk reicht)
- Rate Limit: 200 Requests / 15 min
- CORS: http://localhost:5173
