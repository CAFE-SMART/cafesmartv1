# Informe auditoría de mensajes de error (Frontend)

## Alcance
- Auditoría **solo de lectura** sobre el frontend.
- Objetivo: identificar qué mensajes de error son **genéricos** (p. ej. “intenta nuevamente”, “revisa conexión”, “no pudimos cargar…”) y cuáles son **específicos** (especialmente mensajes de validación numérica tipo “cantidad/precio/peso/valor inválido”).
- Adicional: auditoría comparativa (documentación) del impacto de cambios entre `develop` y `feature/landing-and-settings` para evitar que al bajar desde Git genere errores.
- No se modificó ningún archivo (esta auditoría solo documenta hallazgos).

---

## Parte 1 — Hallazgos por archivo (mensajes)

### 1) Mensajes genéricos

#### `frontend/src/services/apiService.ts`
Traducción central de errores (por `status` y/o texto técnico), generando mensajes genéricos:
- **`Ocurrió un problema temporal. Intenta nuevamente.`** *(status >= 500)*
- **`Tu sesión expiró. Ingresa nuevamente.`** *(401 cuando aplica)*
- **`No tienes acceso a esta opción.`** *(403)*
- **`No encontramos la información solicitada. Verifica e intenta nuevamente.`** *(404 cuando el backend no aporta texto útil)*
- **`No pudimos procesarlo. Intenta de nuevo.`** *(fallback default)*
- **`Revisa la conexión a internet y vuelve a intentarlo.`** *(Failed to fetch / TypeError)*

También hay mapeos por texto técnico:
- `Bad Request` → **`Revisa los datos e intenta de nuevo.`**
- `Internal server error` → **`Ocurrió un problema temporal. Intenta nuevamente.`**

#### `frontend/src/pages/ResumenFinanciero.tsx`
Mensajes genéricos (fallback UI) cuando fallan cargas/validaciones:
- **`No pudimos cargar el resumen financiero. Intenta nuevamente.`**
- **`No pudimos cargar el historial. Intenta nuevamente.`**
- **`No pudimos actualizar todos los datos. Intenta nuevamente.`**
- **`No pudimos validar la contraseña. Intenta nuevamente.`**
- Títulos genéricos:
  - **`No pudimos cargar el acceso financiero`**
  - **`No pudimos cargar la información`**
- Mensaje genérico para acceso autorizado con error:
  - **`Verifica tu conexión o vuelve a intentarlo.`**

#### `frontend/src/utils/uiMessages.ts`
Catálogo de mensajes UI con múltiples mensajes de cobertura.
Ejemplos de genéricos presentes en el archivo:
- **`Ocurrió un problema temporal. Intenta nuevamente.`**
- **`No pudimos guardar la información.`**
- **`No pudimos completar el registro.`**
- **`No encontramos la información.`**
- Mensajes auth/system/offline.

---

### 2) Mensajes específicos (validación numérica / “número inválido”)

#### `frontend/src/pages/Ventas/utils.ts`
Mapeo de errores (por `error.code` y/o texto) a mensajes concretos relacionados con cantidades/precio/stock/sublote.

Mensajes explícitos encontrados:
- **`La cantidad a vender debe ser mayor a 0.`** *(code `VENTA_CANTIDAD_INVALIDA`)*
- **`El precio por kg debe ser mínimo $1,000.`** *(code `VENTA_PRECIO_INVALIDO`)*
- **`El sublote seleccionado no esta disponible para la venta.`** *(code `VENTA_SUBLOTE_INVALIDO`)*
- **`No hay suficiente inventario para realizar la venta`** *(códigos `INSUFFICIENT_STOCK` / `VENTA_INVENTARIO_INSUFICIENTE`)*

Además, el archivo contiene guías con validaciones numéricas de campos como documento/teléfono (con reglas de dígitos), por ejemplo:
- `Teléfono inválido.` + guía de celular con dígitos.
- `Documento inválido.` + guías de “solo números”, “muy pocos números”, etc.

---

## Conclusión (Parte 1)
- Los **mensajes genéricos** (p. ej. “intenta nuevamente”, “revisa conexión”, “no pudimos cargar…”) se originan principalmente en:
  - `frontend/src/services/apiService.ts`
  - fallbacks de páginas como `frontend/src/pages/ResumenFinanciero.tsx`
  - catálogo `frontend/src/utils/uiMessages.ts`
- Los mensajes **numéricos específicos** aparecen claramente en el flujo de ventas, especialmente:
  - `frontend/src/pages/Ventas/utils.ts`

---

## Parte 2 — Auditoría comparativa (develop vs landing/settings) y cómo evitar errores al bajar cambios

### 1) Archivos clave que cambian en `feature/landing-and-settings` vs `develop`
De la comparación (documentación), los cambios relevantes incluyen:

**a) Capa de errores y networking**
- `frontend/src/services/apiService.ts` (modificado)
  - Refuerza traducción de error, dedupe/cache de `GET` y fallback offline.

**b) Sesión / contexto**
- `frontend/src/context/UserContext.tsx` (modificado)
  - Agrega soporte para organización `OTRO`.
  - Limpia storage de login draft (`cafesmart:login-draft:v1`) en logout.

**c) Offline / sincronización (muy crítico)**
- `frontend/src/services/syncQueueService.ts` (nuevo)
  - Implementa cola offline con estados: `PENDIENTE / SINCRONIZANDO / SINCRONIZADO / ERROR`.
  - `syncAllPending()` usa `apiFetch` y luego `invalidateApiCache()`.

**d) Routing (muy crítico)**
- `frontend/src/routes/AppRoutes.tsx` (modificado)
  - Pasa a `React.lazy` + `Suspense` con `AppLoadingScreen`.
  - Agrega/ajusta rutas hacia páginas nuevas.

### 2) Por qué “lo de landing/settings no funciona en develop” (causas probables)
1. **Falta integrar el flujo de sincronización**
   - En landing/settings la cola offline existe y se sincroniza.
   - Si en `develop` no se integra el runner/consumo (`SyncQueueRunner`) o no se dispara `syncAllPending()`, los cambios offline no se reflejan.

2. **Inconsistencia de routing lazy/Suspense**
   - En landing/settings el routing es lazy.
   - Si en `develop` no están presentes todas las páginas/componentes lazy importadas, puede haber runtime errors o quedarse en loading.

3. **Diferencias en traducción/manejo de errores**
   - `apiService.ts` puede cambiar cómo se limpia o traduce `message`/`code`.
   - Si la UI depende de `error.code` o `error.field` para guidance, en develop puede quedar en genérico.

4. **Sesión/estado inconsistente**
   - `UserContext.tsx` y claves de storage pueden diferir.
   - Puede quedar `authorized` en falso, o se puede limpiar storage antes de tiempo, afectando login.

---

## 3) Guía paso a paso para “bajar cambios desde Git” sin generar errores en `develop`

### Paso 1 — Merge completo por “bloques” (no parcial)
Al traer cambios de `feature/landing-and-settings` a `develop`, traer siempre estos bloques relacionados:
- Bloque A: `frontend/src/services/apiService.ts`
- Bloque B: `frontend/src/context/UserContext.tsx` + `frontend/src/storage/authStorage.ts`
- Bloque C: `frontend/src/services/syncQueueService.ts` + su runner/consumo (p. ej. `SyncQueueRunner.tsx`)
- Bloque D: `frontend/src/routes/AppRoutes.tsx` + todas las páginas que aparecen como nuevas en el diff (lazy imports)

> Si bajas solo A/B sin C, el offline/sync “parece” que no funciona.
> Si bajas solo A/C sin D, el routing lazy puede romper o quedarse cargando.

### Paso 2 — Verificación de build/runtime en develop
1. Compila `frontend` en `develop`.
2. Abre consola y reproduce:
   - login
   - una acción con validación de error
   - un flujo que dependa de offline/sync
3. Confirma que:
   - no hay runtime errors de `lazy`/`Suspense`
   - los errores muestran guidance cuando corresponde (`error.code`)

### Paso 3 — Validar integración de la cola offline
1. Busca dónde se monta `SyncQueueRunner` o dónde se llama a `syncAllPending()`.
2. Confirmar que el runner:
   - escucha eventos de red (network status)
   - lee la cola desde `cafe-smart:sync-queue:v1`
   - sincroniza y llama `invalidateApiCache()`

### Paso 4 — Validar rutas lazy
1. Asegurar que todas las páginas lazy importadas existen en `develop`.
2. Asegurar que `Suspense fallback` funciona (usa `AppLoadingScreen`).

### Paso 5 — Validar sesión y authorized
1. Confirmar que el `logout` no borra información crítica inesperadamente.
2. Confirmar que el tipo de organización `OTRO` no rompe selects/validaciones.

---

## Resultado final (Parte 2)
Para que los cambios de `landing/settings` funcionen en `develop` al hacer checkout/merge desde Git:
- **No mezclar parciales**: sincronización (syncQueueService + runner) y routing lazy (AppRoutes + páginas) deben llegar completos.
- Si el fallo aparece como “no funciona” o “queda en error/genérico”, priorizar:
  1) sync queue integration
  2) AppRoutes lazy import consistency
  3) apiService error translation
  4) UserContext session keys

---

## Archivos usados como evidencia (Parte 1)
- `frontend/src/services/apiService.ts`
- `frontend/src/utils/uiMessages.ts`
- `frontend/src/pages/ResumenFinanciero.tsx`
- `frontend/src/pages/Ventas/utils.ts`

