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
npm install && npx prisma generate && npx prisma migrate deploy && npm run build
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
CORS_ORIGIN
```

## Test endpoints

GET /api/public/home  
GET /api/public/rankings  
POST /api/admin/auth/login
