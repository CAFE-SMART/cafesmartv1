# Evaluacion de usabilidad - Cafe Smart

Fecha: 2026-05-01
Alcance: revision de legibilidad, mensajes y navegacion sobre el frontend React/Capacitor.

## Objetivo

Garantizar que el usuario pueda leer la informacion en movil, entienda los mensajes del sistema y navegue sin perderse durante los flujos principales: login, registro, inicio, compras, ventas, inventario, secado, gastos y ajustes.

## Metodo ejecutado

- Se revisaron rutas en `frontend/src/routes/AppRoutes.tsx`.
- Se auditaron textos de error, exito y estado en `frontend/src`.
- Se revisaron tamanos de fuente y estilos moviles en paginas y componentes compartidos.
- Se revisaron salidas de navegacion: botones de volver, acciones primarias, reintentos, estado vacio y barra inferior.
- Se aplicaron mejoras transversales en componentes compartidos.

Pendiente: validacion en dispositivo movil fisico. Desde este entorno no habia un dispositivo Android conectado por ADB al momento de la revision.

## Hallazgos principales

## Registro de inconsistencias del sprint

| Pantalla afectada | Descripcion del hallazgo | Evidencia | Severidad | Responsable | Estado de correccion |
| --- | --- | --- | --- | --- | --- |
| Navegacion inferior | Las etiquetas de la barra inferior usaban texto de 10.5px, dificil de leer y tocar en movil. | `frontend/src/components/AppBottomNav.tsx` tenia `text-[10.5px]`. | Mejora UX | Frontend | Corregido: subido a `text-sm`, iconos y alto del boton ajustados. |
| Estado de conexion | El badge de nube mostraba detalle en 9px en modo compacto, ocultando informacion de estado. | `CloudStatusBadge` usaba `text-[9px]` y `text-[11px]`. | Bug medio | Frontend | Corregido: textos a `text-sm` y ancho mayor. |
| Estados vacios | Los estados vacios usaban descripcion y accion de 12px, poco legibles en movil. | `EmptyState` tenia `text-xs` en descripcion y boton. | Mejora UX | Frontend | Corregido: descripcion a `text-sm`, titulo a `text-base` y accion mas alta. |
| Formularios | Ayudas y errores de telefono eran pequenos para lectura movil. | `FormattedPhoneInput` usaba `text-xs`. | Mejora UX | Frontend | Corregido: ayuda/error a `text-sm`. |
| Registro | Progreso del registro era pequeno y algunos mensajes no tenian tildes o sonaban rigidos. | `RegisterProgress` y `useRegisterForm` contenian `text-xs`, `contrasena`, `minimo`, `corrigelos`. | Bug medio | Frontend | Corregido: progreso mas legible y mensajes normalizados. |
| Login | Textos de estado de Google y separador usaban 12px, ademas habia copy sin tildes. | `Login.tsx` tenia `text-xs`, `sesion`, `Registrate`. | Mejora UX | Frontend | Corregido: textos a `text-sm` y copy con tildes. |
| Autenticacion | Mensajes como "Error de autenticacion" o "Contrasena incorrecta" eran secos y poco orientadores. | `authService.ts` y `authMessages.ts`. | Bug medio | Frontend | Corregido: mensajes con "No pudimos..." y accion esperada. |
| Estado del sistema | Error de registro decia "Error de conexion" y no usaba tildes. | `SystemStatus.tsx`. | Bug medio | Frontend | Corregido: "Problema de conexion" + instruccion clara. |
| Compra | El boton volver/cancelar podia depender de `navigate(-1)`, dejando al usuario en una ruta inesperada si entro directo. | `Compras.tsx` usaba `navigate(-1)`. | Bug medio | Frontend | Corregido: salida estable hacia `/inicio`. |
| Compra | Mensajes de validacion de peso usaban "valido" sin tilde. | `Compras.tsx`, validacion de sublotes. | Mejora UX | Frontend | Corregido: "peso valido" a "peso válido" en copy visible. |
| Venta | El boton volver dependia de historial y podia perder contexto en ruta directa. | `Ventas.tsx` usaba `navigate(-1)`. | Bug medio | Frontend | Corregido: salida estable hacia `/inicio`. |
| Venta | Pantalla de exito y seleccion de cliente tenian textos de 11-12px y copy sin tildes. | `Ventas.tsx`: `text-[11px]`, `Venta rapida`, `Seleccion pendiente`. | Bug medio | Frontend | Corregido: textos funcionales a `text-sm` y copy normalizado. |
| Venta | Mensajes de precio invalido no usaban tildes y podian verse como texto secundario pequeno. | `Ventas.tsx`: `precio valido`, errores `text-xs`. | Mejora UX | Frontend | Corregido: "precio válido" y errores a `text-sm`. |
| Gastos operativos | Botones Volver/Cancelar dependian de historial. | `GastosOperativos.tsx` usaba `navigate(-1)`. | Bug medio | Frontend | Corregido: salida estable hacia `/ajustes`. |
| Gastos operativos | Chips de tipo de gasto y asociacion usaban 10-11px. | `GastosOperativos.tsx`: `text-[10px]`, `text-[11px]`. | Mejora UX | Frontend | Corregido: etiquetas funcionales a `text-sm`. |
| Sublotes | Mensajes de humedad/factor tenian copy sin tildes y tono mejorable. | `Sublotes.tsx`: `no es valida`, `numero`, `conexion`. | Bug medio | Frontend | Corregido: mensajes con tildes y accion directa. |
| Android / red | Llamadas HTTP podian quedarse esperando y generar percepcion de bloqueo. | `authService.ts` y `apiService.ts` no tenian timeout antes de esta revision. | Bug critico | Frontend | Corregido: timeout de 12s y mensaje de conexion lenta. |
| Android / Google | El iframe de Google se cargaba al abrir login en WebView y podia afectar estabilidad. | `main.tsx` y `Login.tsx`. | Bug medio | Frontend | Corregido: en Android se usa boton fallback y flujo bajo accion del usuario. |

Prioridad de cierre:
- Bug critico: corregido antes del cierre.
- Bug medio: corregidos los hallazgos que afectaban tareas principales o navegacion.
- Mejora UX: corregidas las mejoras transversales; queda deuda menor en pantallas densas no bloqueantes.

### Alta prioridad

1. Textos de navegacion y estado demasiado pequenos

Antes se encontraron textos criticos entre 9px y 12px en la barra inferior, estado de nube, estados vacios y ayudas de formulario. En movil esto puede causar lectura lenta, toques inseguros y baja confianza.

Accion aplicada:
- `AppBottomNav`: etiquetas subidas a `text-sm` y botones mas altos.
- `CloudStatusBadge`: titulo y detalle subidos a `text-sm`.
- `EmptyState`: titulo, descripcion y accion subidos a 14-16px.
- `FormattedPhoneInput`: ayuda/error subido a `text-sm`.
- `RegisterProgress`: etiqueta de paso subida a `text-sm`.

2. Mensajes de autenticacion podian sonar secos o tecnicos

Mensajes como "Correo incorrecto" o "Contrasena incorrecta" son entendibles, pero menos empaticos y menos consistentes con el resto de la app.

Accion aplicada:
- Mensajes de auth reescritos en tono humano: "No pudimos iniciar sesion..." + accion concreta.

### Media prioridad

3. Persisten textos pequenos en pantallas operativas

Quedan varios `text-xs`, `text-[11px]` y algunos `text-[10px]` en paginas como `Ajustes`, `Ventas`, `Secado`, `Gastos`, `Inventario` y `AnalisisFinanciero`. Muchos son etiquetas secundarias, pero algunos describen informacion operativa relevante.

Recomendacion:
- Subir a `text-sm` todo texto que explique una accion, importe, estado, error, ayuda o detalle de lote/cliente.
- Reservar 11-12px solo para metadatos no esenciales, y evitarlo si el usuario debe tomar decisiones con ese dato.

4. Algunos textos no tienen tildes por consistencia historica del codigo

Hay mezcla de "conexion/conexión", "informacion/información", "contrasena/contraseña". No bloquea el uso, pero reduce pulido y coherencia.

Recomendacion:
- Normalizar copy visible a espanol con tildes.
- Mantener identificadores de codigo sin tildes.

### Baja prioridad

5. Hay muchas tarjetas y textos truncados

La app usa `truncate` en datos de usuario, movimientos y descripciones. Ayuda a conservar layout, pero puede ocultar informacion importante en pantallas pequenas.

Recomendacion:
- Permitir 2 lineas en nombres/descripciones clave usando `line-clamp-2`.
- Mantener `truncate` solo para codigos o valores repetibles.

## Evaluacion por categoria

### Legibilidad

Estado actual: aceptable con mejoras aplicadas en componentes compartidos.

Fortalezas:
- La mayoria de inputs principales usan 16px.
- Titulos de flujo tienen buen peso visual.
- Hay tarjetas con contraste suficiente en fondos claros.

Riesgos:
- Persisten etiquetas de 10-12px en pantallas con informacion densa.
- Algunas ayudas y metadatos usan gris claro sobre fondos claros.

### Mensajes

Estado actual: bueno en flujos principales, con deuda de consistencia.

Fortalezas:
- `GuidedError` separa causa y accion.
- `SystemSaveError` protege al usuario: explica que los datos siguen en pantalla.
- Mensajes de carga como "Guardando..." y "Procesando..." estan presentes en compras, ventas, gastos y secado.

Riesgos:
- Algunas cadenas todavia dicen "Error de conexion" o "No se pudo..." sin siempre explicar el siguiente paso.
- Algunos mensajes usan "Debes/Debe", que puede sonar mas rigido que "Selecciona" o "Ingresa".

### Navegacion

Estado actual: coherente.

Fortalezas:
- Las pantallas principales usan barra inferior consistente.
- Los flujos largos ocultan la barra inferior y ofrecen volver/cancelar.
- Los estados de exito ofrecen siguiente accion: nueva compra/venta o ir a inventario/inicio.

Riesgos:
- `navigate(-1)` depende del historial; si el usuario entra directo a una ruta profunda, volver puede no llevar al lugar esperado.
- Algunas rutas profundas de secado/sublotes deberian tener fallback fijo a inventario o secado cuando no hay historial confiable.

## Pruebas recomendadas en dispositivo fisico

1. Login
- Abrir app.
- Intentar entrar con campos vacios.
- Intentar correo invalido.
- Intentar credenciales incorrectas.
- Verificar que el mensaje se lee sin zoom y explica que hacer.

2. Registro
- Completar paso 1.
- Dejar telefono/correo/contrasena invalida en paso 2.
- Verificar progreso, errores y regreso entre pasos.

3. Compra
- Registrar compra completa.
- Cancelar a mitad del flujo.
- Provocar error de validacion en peso/precio.
- Verificar exito y accion siguiente.

4. Venta
- Seleccionar cliente general.
- Vender parcial y total.
- Provocar precio invalido.
- Verificar confirmacion, resumen y acceso a inventario.

5. Estado de conexion
- Apagar internet durante carga o guardado.
- Verificar badge de nube, mensaje offline y reintento.

## Indicadores para medir

- Tiempo para login exitoso: objetivo menor a 30 segundos.
- Tiempo para registro: objetivo menor a 3 minutos.
- Tiempo para compra simple: objetivo menor a 2 minutos.
- Errores recuperables: el usuario debe saber que corregir sin ayuda externa.
- Abandono de flujo: no deberia ocurrir por falta de volver/cancelar/reintentar.

## Cambios aplicados en esta revision

- Mejora de legibilidad en `AppBottomNav`.
- Mejora de legibilidad en `CloudStatusBadge`.
- Mejora de legibilidad en `EmptyState`.
- Mejora de legibilidad en `GuidedError`.
- Mejora de legibilidad en `SystemSaveError`.
- Mejora de ayudas en `FormattedPhoneInput`.
- Mejora del progreso de registro en `RegisterProgress`.
- Mejora de mensajes de autenticacion en `authMessages`.
