# Greek Tennis API

Backend Node.js/Express/Prisma/MySQL para Greek Tennis Series.

## Stack

- Node.js
- Express
- TypeScript
- Prisma
- MySQL
- JWT

## Desarrollo local

```bash
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

## Build

```bash
npm run build
```

## Start

```bash
npm start
```

## Tests

```bash
npm test
```

## Hostinger

Framework preset: Express  
Node version: 22.x  
Root directory: ./  
Entry file: dist/index.js

Build command:

```bash
npm install && npx prisma generate && npx prisma migrate deploy && npm run admin:seed && npm run data:seed:liga2 && npm run build
```

Start command:

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

`ADMIN_PASSWORD` es un fallback temporal si todavía no existe ningún usuario en la tabla `AdminUser`.
Para crear o actualizar el admin real con contraseña hasheada:

```bash
ADMIN_SEED_USERNAME=admin ADMIN_SEED_EMAIL=agustinrepecka@gmail.com ADMIN_SEED_PASSWORD=tu_password_seguro npm run admin:seed
```

El recuperador de contraseña usa SMTP. En Hostinger, configurar `SMTP_USER=contacto@greektennis.com` y `SMTP_PASS` con la contraseña real del buzón.

## Test endpoints

GET /api/public/home  
GET /api/public/rankings  
POST /api/admin/auth/login

Body de login:

```json
{ "email": "agustinrepecka@gmail.com", "password": "tu_password_seguro" }
```

Recuperación:

POST /api/admin/auth/forgot-password  
POST /api/admin/auth/reset-password

## Seed Liga 2

```bash
npm run data:seed:liga2
```

Este seed es idempotente y actualiza únicamente Liga 2 (`t-novak-l2`): grupos, jugadores, partidos y resultados disponibles. No modifica Liga 1 ni `t-novak`.
