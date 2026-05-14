# Claude Admin Auth Checklist

Usar este brief sin pegar secretos reales.

## Contexto

- Frontend: `GreekTenisTournament-Frontend`
- API: `GreekTenisTournament-API`
- Frontend producción:
  - `VITE_DATA_SOURCE=api`
  - `VITE_API_URL=https://api.greektennis.com`
- Backend Hostinger variables esperadas:
  - `DATABASE_URL`
  - `PORT`
  - `JWT_SECRET`
  - `ADMIN_PASSWORD` solo como fallback temporal
  - `ADMIN_SEED_USERNAME`
  - `ADMIN_SEED_EMAIL` (`agustinrepecka@gmail.com` para prueba)
  - `ADMIN_SEED_PASSWORD`
  - `CORS_ORIGIN`
  - `APP_URL`
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SMTP_FROM`

## Verificaciones

1. El frontend de producción no debe aceptar credenciales demo locales.
2. El login admin debe usar `POST https://api.greektennis.com/api/admin/auth/login` con `{ email, password }`.
3. Las rutas `/api/admin/*` deben requerir `Authorization: Bearer <JWT>`.
4. Las contraseñas admin deben guardarse hasheadas en MySQL (`AdminUser.passwordHash`).
5. No commitear `.env` reales ni imprimir secretos en logs.
6. Después de crear al menos un `AdminUser`, el login debe validar contra MySQL.
7. El recuperador debe enviar el link desde `contacto@greektennis.com` usando SMTP de Hostinger.

## Comandos Esperados En Backend

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run admin:seed
npm run build
npm start
```

## Pruebas

```bash
curl -X POST https://api.greektennis.com/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"agustinrepecka@gmail.com\",\"password\":\"NO_PEGAR_PASSWORD_REAL_EN_CHATS\"}"
```

Luego usar el token para probar una ruta protegida:

```bash
curl https://api.greektennis.com/api/admin/schedules \
  -H "Authorization: Bearer TOKEN_AQUI"
```
