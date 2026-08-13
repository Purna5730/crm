# CRM Management System

A full-stack Customer Relationship Management (CRM) system built with React, Node.js, TypeScript, Express, and MySQL.

---

## Live Demo

- **Frontend (Vercel):** https://crm-geb6m7g16-crm-d6b3.vercel.app
- **Backend (Render):** https://crm-w3vc.onrender.com
- **GitHub Repository:** https://github.com/Purna5730/crm

---

## Test Login Credentials

| Role      | Email                  | Password     |
|-----------|------------------------|--------------|
| Admin     | admin@crm.com          | password     |
| Sales     | sales@crm.com          | sales123     |
| Warehouse | warehouse@crm.com      | warehouse123 |
| Accounts  | accounts@crm.com       | accounts123  |

> You can also register new accounts from the Sign Up tab.

---

## Architecture

```
crm/
├── backend/          # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/       # MySQL connection pool
│   │   ├── controllers/  # Business logic
│   │   ├── middleware/   # JWT auth, role guard
│   │   ├── routes/       # API route definitions
│   │   └── index.ts      # Express app entry point
│   ├── schema.sql        # Database schema + seed
│   └── tsconfig.json
│
└── frontend/         # React + TypeScript (CRA)
    ├── src/
    │   ├── components/   # All UI components
    │   ├── api.ts        # Axios instance with JWT interceptor
    │   └── App.tsx       # Root layout with sidebar + routing
    └── tsconfig.json
```

### Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | React 19, TypeScript, Axios       |
| Backend   | Node.js, Express, TypeScript      |
| Database  | MySQL 8                           |
| Auth      | JWT (jsonwebtoken + bcryptjs)     |
| Hosting   | Vercel (frontend), Render (backend) |

---

## Role Permissions

| Feature              | Admin | Sales | Warehouse | Accounts |
|----------------------|-------|-------|-----------|----------|
| View Customers       | ✅    | ✅    | ✅        | ✅       |
| Add/Edit Customers   | ✅    | ✅    | ❌        | ❌       |
| Delete Customers     | ✅    | ❌    | ❌        | ❌       |
| View Products        | ✅    | ✅    | ✅        | ✅       |
| Add/Edit Products    | ✅    | ❌    | ✅        | ❌       |
| Stock Movement       | ✅    | ❌    | ✅        | ❌       |
| View Challans        | ✅    | ✅    | ❌        | ✅       |
| Create Challans      | ✅    | ✅    | ❌        | ❌       |
| Confirm/Cancel       | ✅    | ✅    | ❌        | ❌       |

---

## API Documentation

### Base URL
```
https://crm-w3vc.onrender.com/api
```

### Authentication
All endpoints except `/auth/login` and `/auth/register` require:
```
Authorization: Bearer <token>
```

---

### Auth Endpoints

#### POST /auth/register
```json
Request:
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "sales"
}

Response 201:
{
  "success": true,
  "message": "Registration successful",
  "data": { "id": 1, "name": "John Doe", "email": "john@example.com", "role": "sales" }
}
```

#### POST /auth/login
```json
Request:
{
  "email": "john@example.com",
  "password": "password123",
  "role": "sales"
}

Response 200:
{
  "success": true,
  "data": {
    "token": "<jwt_token>",
    "user": { "id": 1, "name": "John Doe", "email": "john@example.com", "role": "sales" }
  }
}
```

---

### Customer Endpoints

| Method | Endpoint                        | Role Required       | Description           |
|--------|---------------------------------|---------------------|-----------------------|
| GET    | /customers                      | All                 | List all customers    |
| GET    | /customers/:id                  | All                 | Get customer detail   |
| POST   | /customers                      | Admin, Sales        | Create customer       |
| PUT    | /customers/:id                  | Admin, Sales        | Update customer       |
| DELETE | /customers/:id                  | Admin               | Delete customer       |
| POST   | /customers/:id/notes            | Admin, Sales        | Add follow-up note    |
| DELETE | /customers/:id/notes/:noteId    | Admin               | Delete follow-up note |

**Query params for GET /customers:**
- `search` — search by name, mobile, email, business
- `status` — filter by lead / active / inactive
- `type` — filter by retail / wholesale / distributor
- `page`, `limit` — pagination

---

### Product Endpoints

| Method | Endpoint               | Role Required        | Description          |
|--------|------------------------|----------------------|----------------------|
| GET    | /products              | All                  | List all products    |
| GET    | /products/:id          | All                  | Get product detail   |
| GET    | /products/movements    | All                  | Stock movement log   |
| POST   | /products              | Admin, Warehouse     | Create product       |
| PUT    | /products/:id          | Admin, Warehouse     | Update product       |
| DELETE | /products/:id          | Admin                | Delete product       |
| POST   | /products/:id/stock    | Admin, Warehouse     | Add stock movement   |

**Stock movement request body:**
```json
{
  "quantity": 10,
  "movement_type": "IN",
  "reason": "Purchase order"
}
```

---

### Challan Endpoints

| Method | Endpoint                  | Role Required  | Description           |
|--------|---------------------------|----------------|-----------------------|
| GET    | /challans                 | All            | List all challans     |
| GET    | /challans/:id             | All            | Get challan detail    |
| POST   | /challans                 | Admin, Sales   | Create challan        |
| PATCH  | /challans/:id/status      | Admin, Sales   | Update status         |

**Create challan request body:**
```json
{
  "customer_id": 1,
  "status": "draft",
  "notes": "Deliver by Friday",
  "items": [
    { "product_id": 1, "quantity": 5 },
    { "product_id": 2, "quantity": 3 }
  ]
}
```

**Update status request body:**
```json
{ "status": "confirmed" }
```

---

## Local Setup

### Prerequisites
- Node.js v16+
- MySQL 8
- npm

### 1. Clone the repository
```bash
git clone https://github.com/Purna5730/crm.git
cd crm
```

### 2. Setup Database
```bash
mysql -u root -p < backend/schema.sql
```

### 3. Configure Backend
```bash
cd backend
```
Edit `.env`:
```
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=crm_db
JWT_SECRET=your_jwt_secret_key
```

### 4. Start Backend
```bash
cd backend
npm install
npx tsc
node dist/index.js
```

### 5. Start Frontend
```bash
cd frontend
npm install
npm start
```

### 6. Open in browser
```
http://localhost:3000
```

---

## Deployment

### Backend → Render
- Root Directory: `backend`
- Build Command: `npm install && npx tsc`
- Start Command: `node dist/index.js`
- Environment Variables: same as `.env` above with production DB credentials

### Frontend → Vercel
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `build`
- Environment Variables:
  - `REACT_APP_API_URL` = `https://crm-w3vc.onrender.com`
  - `CI` = `false`

---

## Known Limitations

- **Render free tier cold starts** — backend sleeps after 15 minutes of inactivity, first request may take 30-60 seconds to wake up
- **No password reset** — forgot password flow is not implemented
- **No email notifications** — follow-up reminders are manual only
- **No pagination UI** — API supports pagination but frontend loads all records
- **No image uploads** — product images are not supported
- **MySQL only** — not compatible with PostgreSQL
- **No refresh token** — JWT expires in 1 day, user must log in again
- **Challan editing** — confirmed/cancelled challans cannot be edited, only cancelled
