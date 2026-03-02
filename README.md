# ☕ Cafe Smart

Sistema web para la gestión de compraventas y cooperativas de cafe bajo una arquitectura de Monolito Modular.

---

## 🚀 Tecnologías

- **Frontend:** React + Vite + Tailwind CSS + Nginx  
- **Backend:** NestJS + Prisma ORM + Node.js  
- **Base de Datos:** PostgreSQL (Supabase)  
- **Infraestructura:** Docker & Docker Compose  

---

## 🛠️ Cómo ejecutar el proyecto (Para Desarrolladores)

### 📌 Requisito único

Tener instalado **Docker Desktop**:  
https://www.docker.com/products/docker-desktop  

No es necesario instalar Node.js ni gestores de paquetes localmente.

---

### 1️⃣ Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/cafesmartv1.git
cd cafesmartv1
```

---

### 2️⃣ Configurar variables de entorno

Crear un archivo:

```
backend/.env
```

Agregar la conexión a la base de datos:

```env
DATABASE_URL="postgresql://postgres:[password]@db.ielltlinimqcnwlkvrbs.supabase.co:5432/postgres"
```
Debes de solicitar la contraseña al admin. 

---

### 3️⃣ Levantar la infraestructura

### Desde la raíz del proyecto ejecutar:

```bash
docker-compose up --build -d
```

---

## 🌐 Acceso a la aplicación

- **Frontend:** http://localhost  
- **Backend:** http://localhost:3000  

---

## 🛑 Detener los contenedores

```bash
docker-compose down
```
