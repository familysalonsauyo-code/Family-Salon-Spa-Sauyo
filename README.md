# Family Salon & Spa Sauyo (MongoDB Edition)

This project now includes a backend API with MongoDB for:
- Online appointments
- Testimonials/reviews
- Contact form messages
- User login/signup
- Admin dashboard with organized MongoDB data

## 1. Install dependencies

```bash
npm.cmd install
```

## 2. Configure environment

Copy `.env.example` to `.env` and update values:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/family_salon_spa_sauyo
PORT=3000
ADMIN_NAME=Salon Admin
ADMIN_EMAIL=admin@familysalonspasauyo.com
ADMIN_PASSWORD=ChangeMe123!
```

## 3. Start the app

```bash
npm.cmd start
```

Open: `http://localhost:3000`

## Admin login

When the server starts, it ensures one default admin account exists using the values from `.env`.

- Login page: `http://localhost:3000/login.html`
- Admin dashboard: `http://localhost:3000/admin.html`

Change the default admin password in `.env` before deploying.

## API endpoints

- `GET /api/health` (includes DB connection state)
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/appointments`
- `POST /api/appointments`
- `GET /api/reviews`
- `POST /api/reviews`
- `POST /api/contact`
- `GET /api/admin/dashboard` (admin only)
- `PATCH /api/admin/appointments/:id/status` (admin only)
