# Café Smart - Ficha Técnica y Guía de Arquitectura ☕📖

Esta guía resume la arquitectura del monorepo, la base de datos, el flujo de negocio y las reglas técnicas establecidas en **Café Smart**. Está diseñada para que cualquier inteligencia artificial (o desarrollador nuevo) comprenda el sistema al 100% en segundos y pueda trabajar de manera consistente.

---

## 1. Stack Tecnológico 🛠️
El proyecto está estructurado bajo un monorepo administrado con **pnpm Workspaces**:
* **Backend:** [NestJS](https://nestjs.com/) (TypeScript) + [Prisma ORM](https://www.prisma.io/).
* **Frontend:** [React](https://react.dev/) + [Vite](https://vite.dev/) + [TailwindCSS](https://tailwindcss.com/) (configurado para web y Capacitor).
* **Móvil:** [Capacitor](https://capacitorjs.com/) (envuelve el build del frontend en un contenedor web nativo para Android).
* **Base de Datos:** [PostgreSQL](https://www.postgresql.org/) en la nube (alojado en [Supabase](https://supabase.com/)).

---

## 2. Estructura de Directorios Principal 📂

```text
cafesmartv1/
│
├── backend/                  # Servidor API NestJS
│   ├── prisma/               # Esquema de base de datos y migraciones
│   └── src/                  # Código fuente (dividido por módulos funcionales)
│       ├── auth/             # Registro, login con JWT y Google OAuth
│       ├── bodega/           # Control de capacidad de bodega y alertas
│       ├── compras/          # Registro de compra de café y creación de sublotes
│       ├── secado/           # Flujo de secado de café (verde -> seco)
│       ├── ventas/           # Venta de café (total o parcial)
│       ├── gastos/           # Gastos operativos (generales o asociados a sublotes)
│       └── lotes/            # Consulta de inventarios, humedades y factores de rendimiento
│
└── frontend/                 # Aplicación cliente React + Vite
    ├── android/              # Proyecto nativo Android generado por Capacitor
    └── src/                  # Componentes y lógica del cliente
        ├── pages/            # Vistas (Inicio, Compras, Ventas, Secado, Ajustes, etc.)
        ├── components/       # Componentes reutilizables e indicadores guiados
        ├── context/          # Estados globales (Conexión offline, Datos del usuario)
        ├── services/         # Clientes de API para sincronización offline-first
        └── utils/            # Validadores de formularios y mensajes de usabilidad (uiMessages.ts)
```

---

## 3. Modelo de Datos y Relaciones Críticas (Prisma) 🗄️

Las entidades de negocio más importantes y sus relaciones principales son:

* **User & Organizacion:** Cada usuario administrador pertenece a una `Organizacion` (Compraventa o Cooperativa). Todos los datos de inventario, compras, gastos y ventas están aislados mediante la columna `organizacionId` para multi-inquilinato.
* **Lote & Sublote:**
  * Al registrar una compra, se crea un `Lote` (agrupador general) y uno o más `Sublotes` (lote específico con un peso, calidad, humedad y factor).
  * El café se rastrea de manera unitaria a nivel de `Sublote`.
  * Cada sublote tiene un `pesoActual` (que decrece con las ventas o procesos de secado) y un `pesoInicial` (peso comprado original).
* **SecadoSession:**
  * Controla los procesos de secado en curso.
  * Toma uno o varios sublotes en estado "VERDE" (entrada) y genera nuevas salidas en estado "SECO" con una calidad, peso y humedad específicos.
  * Calcula la **merma** (peso perdido por humedad) y el **rendimiento**.
* **GastoOperativo:**
  * Puede ser un gasto general de la organización, o estar directamente asociado a uno o varios sublotes (`subloteIds`).
  * Si se asocia a sublotes, permite calcular la utilidad neta real descontando gastos específicos de ese sublote (transporte, trilla, etc.).
* **MovimientoInventario:**
  * Tabla de auditoría que registra cada entrada (compra, fin de secado) y salida (venta, inicio de secado) para mantener la trazabilidad histórica de los kilos almacenados.

---

## 4. Reglas de Negocio Clave 💡

### 4.1. Trazabilidad por Sublotes (Flujo de Café)
1. **Compra:** Entra café verde. Se crea un `Lote` y un `Sublote` con `estado: VERDE`. El `pesoActual` es igual al comprado.
2. **Secado:**
   * Se inicia un secado tomando peso de un sublote `VERDE`. El peso seleccionado se descuenta temporalmente del `pesoActual` de ese sublote.
   * El secado entra en estado `IN_PROCESS`.
   * Al finalizar el secado, el sistema descuenta definitivamente ese peso e introduce nuevos sublotes resultantes en estado `SECO` (con calidades: Bueno, Regular o Malo).
   * La diferencia de peso resultante se registra como **merma**.
3. **Venta:** Las ventas se realizan seleccionando sublotes específicos (ya sean verdes o secos). El peso vendido se resta del `pesoActual` del sublote hasta llegar a cero (sublote agotado).

### 4.2. Control de Capacidad de Bodega
* Cada organización configura su capacidad máxima en kg de café en Ajustes.
* Antes de guardar cualquier compra, el backend valida si el inventario actual de la organización + la nueva compra supera el límite configurado. Si se supera, rechaza la transacción con un error.
* El frontend muestra barras de alerta dinámicas:
  * **Amarilla (Advertencia):** Ocupación $\ge 80\%$.
  * **Naranja/Roja (Crítica):** Ocupación $\ge 90\%$.
  * **Bloqueo Completo:** Ocupación al $100\%$ o si la nueva compra excede el espacio libre.

### 4.3. Sincronización Offline-First
* El frontend está preparado para funcionar sin conexión de red temporal.
* Cada objeto creado localmente posee un `localId` (UUID temporal) y `deviceId` para evitar colisiones.
* Cuando se restablece la conexión, el servicio de sincronización envía los datos en cola al backend.
* El backend usa validación idempotente a través de la llave única compuesta (`deviceId`, `localId`) para evitar registros duplicados si una petición se reenvía por error.

---

## 5. Directrices de Diseño de Interfaz (Aesthetics) 🎨

Si vas a proponer o modificar vistas de UI en este proyecto, asegúrate de respetar estas reglas visuales:
* **Tema y Colores:** Sleek dark mode / glassmorphism moderno. Evita colores primarios crudos (como `#ff0000` o `#0000ff`). Usa paletas de HSL controladas (slate, rose para errores, emerald para éxitos).
* **Fuentes:** Tipografía limpia y moderna (ej. Inter o Roboto), no la tipografía del sistema por defecto.
* **Componentes de Alerta:** Usa `InlineGuidedError` o `FloatingGuidedNotice` pasándole una estructura `GuidedErrorMessage` `{ what, why, how, action }`. Esto permite que el usuario sepa de forma interactiva qué salió mal, por qué, y cómo corregirlo en lugar de mostrar un diálogo de error básico.
* **Interacciones:** Los botones y chips de selección deben contar con micro-animaciones en hover (`transition-all duration-200`) y estados visuales marcados para pulsaciones.
