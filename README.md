# ☕ Cafe Smart

Sistema móvil y de escritorio para la gestión de **compraventas y cooperativas de café**, diseñado para registrar operaciones del negocio cafetero como compras, inventario, secado, cálculo de rendimiento, ventas y reportes financieros. Preparado para funcionar **Offline-First**.

El sistema está construido bajo una **arquitectura de Monolito Modular**, permitiendo organizar las funcionalidades del negocio en módulos independientes pero dentro de una misma aplicación.

---

# 🎯 Objetivo del Proyecto

Digitalizar la gestión operativa del comercio de café, permitiendo a los usuarios:

- Registrar compras de café por lote
- Evaluar calidad del café
- Gestionar inventario
- Registrar procesos de secado
- Registrar factor
- Registrar ventas
- Controlar gastos operativos
- Visualizar reportes y métricas del negocio

---

# 🧱 Arquitectura del Sistema

Cafe Smart utiliza una arquitectura **Monolito Modular**, donde cada módulo del sistema representa una parte del proceso de negocio.

```
Capacitor Mobile / Web App
│
├── Frontend (React + Vite)
│
├── Backend API (NestJS)
│
├── ORM (Prisma)
│
└── Base de datos (PostgreSQL / SQLite Local)
```

## Flujo principal del sistema:

Compra → Evaluación → Inventario → Secado → Medición de humedad → Factor de rendimiento → Venta → Reportes


---

# 🧰 Stack Tecnológico

| Capa | Tecnología |
|-----|-------------|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + NestJS |
| ORM | Prisma |
| Base de datos | PostgreSQL |
| Autenticación | JWT + bcrypt |
| Runtime | Capacitor (Android / Web) |
| DevOps | Docker |
| Testing | Jest + Supertest + Postman |
| Dashboard | Recharts / Chart.js |
| Base de datos local | SQLite |
| Sincronización | Offline-First Async |

---

# 📦 Estructura del Proyecto

```
cafesmartv1
│
├── frontend
│   ├── android          <-- Proyecto móvil nativo (Capacitor)
│   ├── src
│   ├── capacitor.config.ts
│   └── package.json
│
├── backend
│   ├── src
│   ├── prisma
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
├── README.md
└── .gitignore
```


---

# 🚀 Cómo ejecutar el proyecto (Modo Desarrollo)

## 1️⃣ Requisitos

Instalar:

- **Docker Desktop** (Para levantar la base de datos y backend fácilmente)
- **Node.js** (Necesario localmente para trabajar el Frontend y Capacitor)
- **Android Studio** (Opcional, pero necesario si quieres ver y emular el celular virtual)

---

## 2️⃣ Clonar el repositorio

```bash
git clone https://github.com/CAFE-SMART/cafesmartv1.git
cd cafesmartv1
```

## 3️⃣ Configurar variables de entorno

Crear el archivo:

`backend/.env`

Agregar:

```env
DATABASE_URL="postgresql://postgres:[password]@db.ielltlinimqcnwlkvrbs.supabase.co:5432/postgres"
```

Solicita las credenciales al administrador del sistema.

---

## 4️⃣ Levantar la infraestructura Web / Backend

Desde la raíz del proyecto ejecutar:

```bash
docker-compose up --build -d
```
Esto levantará tu API (Nube) y tu base de datos principal de forma transparente.

---

## 5️⃣ Emular la App en Celular (Frontend con Capacitor)

Para correr la app en modo programador y luego verla en el celular:

1. Ingresa a la carpeta frontend e instala dependencias usando **pnpm**:
   ```bash
   cd frontend
   pnpm install
   ```
2. Para verla rápido en el navegador como cualquier web:
   ```bash
   pnpm dev
   ```
3. **Para verla en el celular (Emulador de Android):**
   Siempre que hagas un cambio importante que quieras ver en el teléfono, corres:
   ```bash
   pnpm build        # 1. Empaqueta el código React
   npx cap sync      # 2. Le pasa el código a la app de Android
   npx cap open android  # 3. Abre Android Studio para darle Play
   ```
Desde la raíz del proyecto ejecutar:

```bash
docker-compose up --build -d
```
