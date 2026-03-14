# ☕ Cafe Smart

Sistema de escritorio para la gestión de **compraventas y cooperativas de café**, diseñado para registrar operaciones del negocio cafetero como compras, inventario, secado, cálculo de rendimiento, ventas y reportes financieros.

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

Electron Desktop App
│
├── Frontend (React + Vite)
│
├── Backend API (NestJS)
│
├── ORM (Prisma)
│
└── Base de datos (PostgreSQL / SQLite)

 
# Flujo principal del sistema:

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
| Runtime Desktop | Electron |
| DevOps | Docker |
| Testing | Jest + Supertest + Postman |
| Dashboard | Recharts / Chart.js |
| Base de datos local | SQLite |
| Sincronización | Socket.io |

---

# 📦 Estructura del Proyecto
cafesmartv1
│
├── frontend
│ ├── src
│ ├── public
│ ├── vite.config.ts
│ └── package.json
│
├── backend
│ ├── src
│ ├── prisma
│ ├── Dockerfile
│ └── package.json
│
├── docker-compose.yml
├── README.md
└── .gitignore


---

# 🚀 Cómo ejecutar el proyecto (Modo Desarrollo)

## 1️⃣ Requisito

Instalar:

- Docker Desktop

https://www.docker.com/products/docker-desktop/

No es necesario instalar Node.js ni gestores de paquetes localmente.

---

## 2️⃣ Clonar el repositorio

```bash
git clone https://github.com/CAFE-SMART/cafesmartv1.git
cd cafesmartv1

3️⃣ Configurar variables de entorno

Crear el archivo:

backend/.env

Agregar:

DATABASE_URL="postgresql://postgres:[password]@db.ielltlinimqcnwlkvrbs.supabase.co:5432/postgres"

Solicita las credenciales al administrador del sistema.

4️⃣ Levantar la infraestructura

Desde la raíz del proyecto ejecutar:

docker-compose up --build -d
