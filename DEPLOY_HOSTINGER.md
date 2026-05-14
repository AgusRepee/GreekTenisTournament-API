# Deploy Hostinger — Greek Tennis Series

## Dominios

Frontend: https://greektennis.com

Backend/API: https://api.greektennis.com

## Backend Hostinger Node.js

Repo: GreekTenisTournament-API

Branch: main

Framework: Express

Node: 22.x

Root directory: ./

Entry file: dist/index.js

Build:

```bash
npm install && npx prisma generate && npx prisma migrate deploy && npm run build
```

Start:

```bash
npm start
```

Variables:

```txt
DATABASE_URL
PORT
JWT_SECRET
ADMIN_PASSWORD
CORS_ORIGIN
```

## Frontend Hostinger HTML

Repo: GreekTenisTournament-Frontend

Build:

```bash
npm run build:production
```

Upload:

```txt
dist/ -> public_html
```

Variables:

```env
VITE_DATA_SOURCE=api
VITE_API_URL=https://api.greektennis.com
```

## Prueba mínima

GET https://api.greektennis.com/api/public/home

POST https://api.greektennis.com/api/admin/auth/login

Abrir https://greektennis.com

Login admin

Programar partido

Recargar

Ver persistencia
