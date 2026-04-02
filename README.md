# Lonely Shopee Monitor

Monitor คำสั่งซื้อจาก Shopee Seller Centre แบบ real-time ดึงข้อมูลผ่าน Shopee internal API พร้อมแสดงผลบนหน้าเว็บ

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Svelte 5 (runes) + SvelteKit + Tailwind CSS 4 + lonely-web-lib |
| Backend | Node.js + Express + TypeScript (Clean Architecture) |
| Auth | Playwright (Chromium) — login Shopee Seller Centre |
| Data | Shopee internal API (cookies-based auth) |
| Cache | JSON file-based cache |

## Architecture

```
backend/src/
├── domain/              ← Entity + Ports (interfaces)
├── usecases/            ← Business logic (check-auth, fetch-orders, polling)
├── infrastructure/      ← Shopee gateway (Playwright + API), cache, scheduler
├── routes/              ← Express HTTP routes
└── index.ts             ← Bootstrap + Dependency Injection
```

## Prerequisites

- Node.js 20+
- npm
- Playwright Chromium (`npx playwright install chromium`)

## Setup

### 1. Clone

```bash
git clone git@github.com:Ruangrits/lonely-shopee-monitor.git
cd lonely-shopee-monitor
```

### 2. Backend

```bash
cd backend
npm install
npx playwright install chromium
cp .env.example .env
```

แก้ `.env`:
```
PORT=3001
SHOPEE_USERNAME=your_shopee_username
SHOPEE_PASSWORD=your_shopee_password
POLLING_INTERVAL=300
HEADLESS=false
```

### 3. Frontend

```bash
cd frontend
npm install
```

> **Note:** Frontend ใช้ `th-lonely-universe-web-lib` จาก local path (`file:../../lonely-web-lib`) ต้องมี repo `lonely-web-lib` อยู่ที่ `../lonely-web-lib/`

## Run (Development)

เปิด 2 terminals:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

เปิด browser: **http://localhost:5173**

## Login ครั้งแรก

1. Backend จะเปิด Chromium browser อัตโนมัติ
2. Auto-login ด้วย credentials จาก `.env`
3. ถ้า Shopee ต้อง **verify ตัวตน** (ผ่านลิงก์ SMS) — ดูหน้าต่าง Chromium ที่เปิดขึ้นมา แล้วกดลิงก์ verify
4. หลัง verify สำเร็จ — session จะถูกเก็บใน `data/browser-profile/` ครั้งต่อไปไม่ต้อง login ใหม่

## Run (Docker — สำหรับ NAS)

```bash
cp .env.example .env
# แก้ SHOPEE_USERNAME + SHOPEE_PASSWORD

docker compose up -d --build
```

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | `http://NAS_IP:5173` | หน้าเว็บ dashboard |
| Backend API | `http://NAS_IP:3001` | REST API |
| noVNC | `http://NAS_IP:6080/vnc.html` | ดู browser เมื่อต้อง verify |

### Session หมดอายุบน Docker

1. หน้าเว็บแสดง "ยังไม่ได้เชื่อมต่อ"
2. เปิด `http://NAS_IP:6080/vnc.html` → เห็น Chromium
3. Backend auto-login → ถ้าต้อง verify → กดลิงก์ใน noVNC
4. กลับมาใช้งานปกติ

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/status` | เช็คสถานะ login (auto-login ถ้ายังไม่ได้) |
| GET | `/api/orders/summary` | ดึง cached data |
| POST | `/api/orders/refresh` | Trigger ดึงข้อมูลใหม่จาก Shopee |
| GET | `/api/settings/polling` | สถานะ auto-polling |
| POST | `/api/settings/polling/start` | เริ่ม auto-polling |
| POST | `/api/settings/polling/stop` | หยุด auto-polling |
| PATCH | `/api/settings/interval` | ตั้ง polling interval (วินาที) |

## Project Structure

```
lonely-shopee-monitor/
├── backend/                 Node.js + Express + Playwright
│   ├── src/
│   │   ├── domain/          Types + Interfaces (Clean Architecture)
│   │   ├── usecases/        Business logic
│   │   ├── infrastructure/  Shopee gateway, cache, scheduler
│   │   └── routes/          HTTP endpoints
│   ├── Dockerfile
│   └── .env
├── frontend/                Svelte 5 + SvelteKit
│   ├── src/
│   │   └── lib/
│   │       ├── app/         Root component
│   │       ├── core/        API service
│   │       └── modules/     Dashboard + components
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```
