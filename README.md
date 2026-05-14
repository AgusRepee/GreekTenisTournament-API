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
npm install && npx prisma generate && npx prisma migrate deploy && npm run admin:seed && npm run build
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
ADMIN_SEED_PASSWORD
CORS_ORIGIN
```

`ADMIN_PASSWORD` es un fallback temporal si todavía no existe ningún usuario en la tabla `AdminUser`.
Para crear o actualizar el admin real con contraseña hasheada:

```bash
ADMIN_SEED_USERNAME=admin ADMIN_SEED_PASSWORD=tu_password_seguro npm run admin:seed
```

## Test endpoints

GET /api/public/home  
GET /api/public/rankings  
POST /api/admin/auth/login

Body de login:

```json
{ "username": "admin", "password": "tu_password_seguro" }
```
