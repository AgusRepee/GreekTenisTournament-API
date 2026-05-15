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
npm install && npx prisma generate && npx prisma migrate deploy && npm run admin:seed && npm run data:seed:liga2 && npm run data:seed:liga5nd && npm run data:seed:liga6nd && npm run build
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
ADMIN_SEED_USERNAME
ADMIN_SEED_EMAIL
ADMIN_SEED_PASSWORD
CORS_ORIGIN
APP_URL
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
```

`ADMIN_PASSWORD` queda solo como fallback temporal mientras no exista ningún usuario en `AdminUser`.
El usuario real se crea o actualiza con `npm run admin:seed`, usando `ADMIN_SEED_USERNAME`, `ADMIN_SEED_EMAIL` y `ADMIN_SEED_PASSWORD`.

Para la primera prueba:

```txt
ADMIN_SEED_USERNAME=admin
ADMIN_SEED_EMAIL=agustinrepecka@gmail.com
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=contacto@greektennis.com
SMTP_FROM="Greek Tennis <contacto@greektennis.com>"
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

Body:

```json
{ "email": "agustinrepecka@gmail.com", "password": "TU_PASSWORD_ADMIN" }
```

Recuperar contraseña:

```txt
POST https://api.greektennis.com/api/admin/auth/forgot-password
POST https://api.greektennis.com/api/admin/auth/reset-password
```

Abrir https://greektennis.com

Login admin

Programar partido

Recargar

Ver persistencia

## Seed Liga 2

El comando `npm run data:seed:liga2` crea o actualiza únicamente Liga 2 (`t-novak-l2`), sus grupos, jugadores, partidos y resultados.
No toca Liga 1 ni `t-novak`.

## Seed Novak Djokovic - Liga 5

El comando `npm run data:seed:liga5nd` crea o actualiza únicamente `Novak Djokovic - Liga 5` (`t-novak-l5`), sus grupos, jugadores, partidos, agenda y resultados disponibles.
Si existiera el ID provisorio `t-liga5-nd-2026`, lo elimina para no duplicar torneos.

## Seed Novak Djokovic - Liga 6

El comando `npm run data:seed:liga6nd` crea o actualiza únicamente `Novak Djokovic - Liga 6` (`t-novak-l6`), sus grupos A/B, jugadores, resultados de fase de grupos y Play Off con BYE para Cellilli F. y Ballesta F.
