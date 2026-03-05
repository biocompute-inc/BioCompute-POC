# BioCompute POC — Frontend

Next.js 16 + React 19 + Tailwind CSS frontend for the BioCompute OT-2 + B2A proof-of-concept.

> For full project setup, Docker instructions (Linux / Windows / Raspberry Pi), and environment variable docs see the [root README](../../README.md).

---

## Running Locally (without Docker)

Requires Node.js 18+.

```bash
npm install
npm run dev
```

The dev server starts at [http://localhost:3000](http://localhost:3000). Pages hot-reload on save.

### Environment variable

Create `frontend/poc-frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Running with Docker

The frontend is part of the Docker Compose stack. From the **repo root**:

```bash
docker compose up --build
```

The frontend container (`poc_frontend`) is built from the `DockerFile` in this directory using `node:20-alpine`. It runs `npm run dev` and mounts the source directory so changes are reflected without a rebuild.

See the [root README](../../README.md) for platform-specific Docker instructions (Linux, Windows, macOS, Raspberry Pi).

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot-reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server (after build) |
| `npm run lint` | Run ESLint |

---

## Tech

- [Next.js 16](https://nextjs.org/docs)
- [React 19](https://react.dev)
- [Tailwind CSS v4](https://tailwindcss.com)
- [MUI Joy](https://mui.com/joy-ui/getting-started/)
- [Framer Motion](https://www.framer.com/motion/)
- [Lucide React](https://lucide.dev)
