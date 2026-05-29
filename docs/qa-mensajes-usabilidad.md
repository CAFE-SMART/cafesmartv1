# QA - Inventario de mensajes de usabilidad

Este documento reúne los mensajes visibles para el usuario en Café Smart: estados normales, vacíos, éxitos, errores de validación, errores de sistema y mensajes que vienen desde backend.

Objetivo de QA:

- Ver si el mensaje explica qué pasó.
- Ver si el mensaje dice qué debe hacer el usuario.
- Detectar mensajes técnicos, ambiguos o demasiado largos.
- Confirmar que compras, ventas, gastos, secado, inventario y ajustes hablen con el mismo tono.

## Criterio de revisión

| Estado  | Significado                                                                       |
| ------- | --------------------------------------------------------------------------------- |
| Bien    | Claro, corto y accionable.                                                        |
| Revisar | Se entiende, pero puede mejorar tono, precisión o contexto.                       |
| Técnico | Puede aparecer al usuario con palabras internas del sistema. Conviene traducirlo. |

## Mensajes globales

Fuente principal: `frontend/src/utils/uiMessages.ts`

| Contexto                   | Estado | Mensaje actual                                                                                     | QA                                                                              |
| -------------------------- | ------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Login fallido              | Error  | No pudimos iniciar sesión. Correo o contraseña incorrectos. Revisa los datos e intenta nuevamente. | Bien                                                                            |
| Acceso no permitido        | Error  | Acceso no disponible. No tienes acceso a esta opción. Contacta al administrador.                   | Bien                                                                            |
| Sin conexión               | Error  | Sin conexión. No pudimos conectarnos en este momento. Intenta nuevamente en unos segundos.         | Bien                                                                            |
| Registro fallido           | Error  | No pudimos completar el registro. Intenta nuevamente.                                              | Revisar: puede ser muy general si el formulario tiene un campo específico malo. |
| Sesión expirada            | Error  | Tu sesión expiró. Inicia sesión nuevamente.                                                        | Bien                                                                            |
| Inventario no encontrado   | Error  | No encontramos la información. Verifica los datos.                                                 | Revisar: falta decir qué información.                                           |
| Stock insuficiente         | Error  | No hay suficiente stock disponible. Ajusta la cantidad.                                            | Bien                                                                            |
| Fecha inválida             | Error  | La fecha ingresada no es válida. Verifica e intenta otra vez.                                      | Bien                                                                            |
| Valor inválido             | Error  | Revisa el valor ingresado. Corrige el dato.                                                        | Revisar: útil como fallback, pero ambiguo si aparece solo.                      |
| Datos incompletos          | Error  | Faltan datos por completar. Revisa los campos marcados.                                            | Bien                                                                            |
| Guardado fallido           | Error  | No pudimos guardar la información. Intenta nuevamente.                                             | Revisar: fallback correcto, pero no debe reemplazar errores de campo.           |
| Timeout                    | Error  | La conexión tardó demasiado. Intenta nuevamente.                                                   | Bien                                                                            |
| Error interno              | Error  | Tuvimos un problema. Intenta más tarde.                                                            | Bien como fallback.                                                             |
| Cargando inventario        | Carga  | Cargando inventario...                                                                             | Bien                                                                            |
| Cargando movimientos       | Carga  | Cargando movimientos...                                                                            | Bien                                                                            |
| Cargando lotes para venta  | Carga  | Cargando lotes para venta...                                                                       | Bien                                                                            |
| Cargando lotes para secado | Carga  | Cargando lotes para secado...                                                                      | Bien                                                                            |
| Sin movimientos recientes  | Vacío  | Cuando registres compras o gastos, aparecerán aquí para revisar la actividad del negocio.          | Bien                                                                            |
| Dashboard sin movimientos  | Vacío  | Registra una compra o una venta para que el resumen del día empiece a mostrar actividad.           | Bien                                                                            |
| Inventario sin filtro      | Vacío  | Cambia el tipo de café o registra una compra para crear los primeros lotes.                        | Bien                                                                            |
| Clientes vacíos            | Vacío  | Prueba otra búsqueda o registra un cliente nuevo para completar la venta.                          | Bien                                                                            |
| Sin lotes verdes           | Vacío  | Registra una compra primero para iniciar un proceso de secado.                                     | Bien                                                                            |
| Información guardada       | Éxito  | Información guardada correctamente.                                                                | Bien                                                                            |
| Venta registrada           | Éxito  | La venta se registró correctamente.                                                                | Bien                                                                            |
| Gasto registrado           | Éxito  | El gasto se guardó correctamente.                                                                  | Bien                                                                            |
| Compra registrada          | Éxito  | Compra registrada correctamente.                                                                   | Bien                                                                            |
| Registro exitoso           | Éxito  | Registro completado con éxito.                                                                     | Bien                                                                            |
| Cuenta creada              | Éxito  | Tu cuenta quedó lista correctamente.                                                               | Bien                                                                            |

## Autenticación y registro

Fuentes: `frontend/src/utils/registerValidators.ts`, `backend/src/auth/*`

| Campo / caso                  | Mensaje actual                                                           | QA                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Nombre de negocio inválido    | Ingresa un nombre de negocio válido.                                     | Bien                                                                                               |
| Tipo de organización vacío    | El tipo de organización es obligatorio.                                  | Bien                                                                                               |
| Tipo de organización inválido | El tipo de organización debe ser COOPERATIVA, COMPRAVENTA u OTRO.        | Técnico: si aparece en frontend, cambiar por "Selecciona un tipo de negocio válido."               |
| Otro tipo sin detalle         | El detalle del tipo de negocio es obligatorio cuando seleccionas "Otro". | Bien                                                                                               |
| Nombre usuario vacío          | El nombre del usuario es obligatorio.                                    | Bien                                                                                               |
| Teléfono vacío                | El teléfono es obligatorio.                                              | Bien                                                                                               |
| Teléfono inválido             | El teléfono debe ser colombiano. Ejemplo: +57 300 123 4567               | Bien                                                                                               |
| Correo vacío                  | El correo electrónico es obligatorio.                                    | Bien                                                                                               |
| Correo inválido               | El correo electrónico no tiene un formato válido.                        | Bien                                                                                               |
| Contraseña vacía              | La contraseña es obligatoria.                                            | Bien                                                                                               |
| Contraseña corta              | La contraseña debe tener al menos 6 caracteres.                          | Bien                                                                                               |
| Contraseña sin minúscula      | La contraseña debe incluir al menos una letra minúscula.                 | Bien                                                                                               |
| Contraseña sin mayúscula      | La contraseña debe incluir al menos una letra mayúscula.                 | Bien                                                                                               |
| Correo ya registrado          | El correo ya está registrado.                                            | Bien                                                                                               |
| Login correo incorrecto       | Correo incorrecto.                                                       | Revisar: en login es mejor no separar correo/contraseña por seguridad; el global ya lo hace mejor. |
| Login contraseña incorrecta   | Contraseña incorrecta.                                                   | Revisar: igual que arriba.                                                                         |
| Google token inválido         | Token de Google inválido.                                                | Técnico: traducir a "No pudimos validar tu cuenta de Google."                                      |
| Google no configurado         | Configuración de Google incompleta en el servidor.                       | Técnico: no debería verlo el usuario final.                                                        |
| Demasiados intentos           | Demasiados intentos. Intenta nuevamente en X segundos.                   | Bien                                                                                               |

## Campos de persona, productor y cliente

Fuente: `frontend/src/utils/personValidation.ts`

| Campo / caso                | Mensaje actual                                        | QA   |
| --------------------------- | ----------------------------------------------------- | ---- |
| Nombre vacío genérico       | Ingresa el nombre para continuar.                     | Bien |
| Nombre con números          | Ingresa un nombre válido para continuar.              | Bien |
| Empresa vacía               | Ingresa el nombre de la empresa para continuar.       | Bien |
| Persona sin nombre completo | Escribe el nombre y apellido para continuar.          | Bien |
| Persona incompleta          | Completa el nombre y apellido para continuar.         | Bien |
| Nombre inválido             | Revisa el nombre e inténtalo nuevamente.              | Bien |
| Empresa inválida            | Ingresa un nombre de empresa válido.                  | Bien |
| Documento vacío             | Escribe el número de documento para continuar.        | Bien |
| Documento incompleto        | Verifica que el documento esté completo.              | Bien |
| Documento inválido          | Revisa el número de documento e inténtalo nuevamente. | Bien |
| Teléfono inválido           | Ingresa un teléfono válido o deja el campo vacío.     | Bien |

## Inicio

Fuentes: `frontend/src/pages/Inicio.tsx`, `frontend/src/utils/uiMessages.ts`

| Contexto                | Mensaje actual                                                                            | QA                                   |
| ----------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------ |
| Estado conexión         | Conectado                                                                                 | Bien                                 |
| Acción manual           | Recargar                                                                                  | Bien                                 |
| Resumen inventario alto | Capacidad usada: X%                                                                       | Bien, pero debe mantenerse compacto. |
| Bodega en advertencia   | La bodega está cerca de su capacidad máxima.                                              | Bien                                 |
| Ajuste de bodega        | Ajustar bodega                                                                            | Bien                                 |
| Gastos pendientes       | Gastos pendientes                                                                         | Bien                                 |
| Gasto pendiente acción  | Marcar pagado                                                                             | Bien                                 |
| Sin movimientos         | Cuando registres compras o gastos, aparecerán aquí para revisar la actividad del negocio. | Bien                                 |

## Compras

Fuente: `frontend/src/pages/Compras.tsx`

| Paso / caso                  | Mensaje visible                                                                                                                         | QA                                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Paso 1                       | Seleccionar productor                                                                                                                   | Bien                                                                                                         |
| Paso 2                       | Seleccionar café                                                                                                                        | Bien                                                                                                         |
| Paso 3                       | Finalizar Registro                                                                                                                      | Bien                                                                                                         |
| Nombre productor inválido    | Revisa el nombre. El nombre debe escribirse con letras, sin números. Corrige el nombre para continuar.                                  | Bien                                                                                                         |
| Teléfono productor inválido  | Revisa el teléfono. Debe ser un celular colombiano de 10 dígitos que empieza por 3. Corrige el número o deja el campo vacío.            | Bien                                                                                                         |
| Documento productor inválido | Revisa el documento. Para cédula usa solo números. Para NIT puedes usar números y guion. Corrige el número de documento para continuar. | Bien                                                                                                         |
| Fecha inválida               | Revisa la fecha. Solo puedes registrar compras desde 2026 hasta hoy. Elige una fecha válida para continuar.                             | Bien                                                                                                         |
| Productor sin nombre         | Falta identificar al productor. Necesitamos el nombre para registrar la compra. Toca la casilla y escribe al menos su nombre.           | Bien                                                                                                         |
| Compra sin productos         | No hay productos. La compra debe tener café. Agrega un producto para continuar.                                                         | Bien                                                                                                         |
| Café incompleto              | Producto incompleto. Antes de agregar otro café, termina los datos actuales. Completa tipo, calidad, peso y precio.                     | Bien                                                                                                         |
| Catálogos no cargados        | Faltan datos base en tu celular. No logramos cargar los tipos de café. Recarga la aplicación e intenta de nuevo.                        | Bien                                                                                                         |
| Tipo de café vacío           | Falta seleccionar el tipo de café. Debes elegir una opción para poder pagar. Toca "Tipo de Café" y elige uno.                           | Bien                                                                                                         |
| Calidad vacía                | Falta la calidad. Saber la calidad ayuda a validar el precio. Toca las caritas para seleccionar la calidad.                             | Bien                                                                                                         |
| Peso vacío o cero            | El peso está vacío o en cero. Necesitamos saber cuántos kilos entraron. Ingresa el peso exacto del café.                                | Bien                                                                                                         |
| Precio inválido              | Falta el precio por kilo. El precio mínimo permitido es $1,000 por kg. Toca la casilla e ingresa un valor desde $1,000.                 | Bien                                                                                                         |
| Productor no seleccionado    | Falta seleccionar el productor. Debemos saber a quién corresponde la compra. Selecciona Productor Genérico o uno de la lista.           | Bien                                                                                                         |
| Fallback compra              | Ups, no se pudo guardar. Revisa los campos señalados. Vuelve a intentar.                                                                | Revisar: "Ups" puede sonar informal para QA; si se quiere más profesional: "No se pudo registrar la compra." |

## Bodega en compra

Fuentes: `frontend/src/pages/Compras.tsx`, `backend/src/bodega/*`

| Estado                        | Mensaje esperado / actual                                             | QA   |
| ----------------------------- | --------------------------------------------------------------------- | ---- |
| Ocupación menor a 80%         | No se muestra alerta fuerte.                                          | Bien |
| Ocupación mayor o igual a 80% | Bodega cerca del límite. Mostrar kg libres y barra amarilla.          | Bien |
| Ocupación mayor o igual a 90% | Estado crítico preventivo. Mostrar kg libres y barra roja/naranja.    | Bien |
| Bodega llena 100%             | Bodega llena. Puedes vender para seguir comprando.                    | Bien |
| Compra supera espacio         | La compra supera el espacio disponible. Disponible actualmente: X kg. | Bien |
| Capacidad inválida            | La capacidad de bodega debe estar entre 1 kg y el máximo permitido.   | Bien |
| Capacidad menor al inventario | La capacidad no puede ser menor al inventario actual.                 | Bien |

## Ventas

Fuente: `frontend/src/pages/Ventas.tsx`

| Caso                       | Mensaje visible                                                                                                                         | QA                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Nombre cliente inválido    | Revisa el nombre. El nombre debe escribirse con letras, sin números. Corrige el nombre para continuar.                                  | Bien                                                                                          |
| Teléfono cliente inválido  | Revisa el teléfono. Debe ser un celular colombiano de 10 dígitos que empieza por 3. Corrige el número o deja el campo vacío.            | Bien                                                                                          |
| Documento cliente inválido | Revisa el documento. Para cédula usa solo números. Para NIT puedes usar números y guion. Corrige el número de documento para continuar. | Bien                                                                                          |
| Fecha de venta inválida    | Revisa la fecha de venta. Solo puedes registrar ventas desde 2026 hasta hoy. Elige una fecha válida para continuar.                     | Bien                                                                                          |
| Inventario insuficiente    | Inventario insuficiente. La venta queda bloqueada porque no hay café suficiente. Actualiza el inventario o reduce la cantidad.          | Bien                                                                                          |
| Sin lotes disponibles      | Sin inventario disponible. No puedes registrar una venta porque no tienes producto en bodega. Registra una compra para continuar.       | Bien                                                                                          |
| Cliente sin nombre         | Falta identificar al cliente. Necesitamos su nombre para registrar la venta. Toca la casilla y escribe su nombre.                       | Bien                                                                                          |
| Cliente no seleccionado    | Selecciona un cliente. No elegiste a quién registrar la venta. Usa Cliente General o busca uno.                                         | Bien                                                                                          |
| Modo de venta vacío        | Selecciona cómo vender. No elegiste el tipo de venta. Una parte o todo el inventario.                                                   | Revisar: la acción "Una parte o todo el inventario" podría ser "Elige venta total o parcial." |
| Precio fuera de rango      | Precio fuera de rango. El precio debe estar entre $1,000 y el límite configurado. Ajusta el valor para continuar.                       | Bien                                                                                          |
| Cantidad excedida          | Cantidad excedida. Estás intentando vender más de lo disponible. Reduce la cantidad o revisa el inventario.                             | Bien                                                                                          |
| Cantidad inválida          | Cantidad inválida. Ingresa una cantidad mínima de 5 kg. Revisa el campo de cantidad.                                                    | Bien                                                                                          |
| Error conexión venta       | Revisa la conexión a internet y vuelve a intentarlo.                                                                                    | Bien                                                                                          |
| Error servidor venta       | No pudimos completar la venta. Vuelve a intentarlo.                                                                                     | Bien                                                                                          |
| Sublote no disponible      | El sublote seleccionado no está disponible para la venta.                                                                               | Bien                                                                                          |
| Venta registrada           | Venta registrada. La venta se guardó correctamente.                                                                                     | Bien                                                                                          |
| Fallback venta             | No se pudo guardar la venta. Revisa los campos señalados. Revisa el dato marcado y vuelve a intentarlo.                                 | Revisar: repite "Revisa".                                                                     |

## Gastos operativos

Fuente: `frontend/src/pages/GastosOperativos.tsx`, `backend/src/gastos/*`

| Campo / caso                    | Mensaje visible                                                                                  | QA                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Concepto vacío                  | Escribe el concepto del gasto.                                                                   | Bien                                                                                          |
| Concepto solo números           | El concepto debe incluir al menos una palabra.                                                   | Bien                                                                                          |
| Concepto con símbolos inválidos | El concepto contiene caracteres no válidos.                                                      | Bien                                                                                          |
| Concepto demasiado largo        | Máximo 60 caracteres.                                                                            | Bien                                                                                          |
| Descripción demasiado larga     | Máximo 200 caracteres.                                                                           | Bien                                                                                          |
| Monto vacío                     | Ingresa el monto del gasto.                                                                      | Bien                                                                                          |
| Monto cero o menor              | El monto debe ser mayor a $0.                                                                    | Bien                                                                                          |
| Monto exagerado                 | El monto supera el máximo permitido.                                                             | Bien                                                                                          |
| Letras o símbolos en monto      | Ingresa solo números.                                                                            | Bien                                                                                          |
| Ayuda preventiva monto          | Max. $99.999.999                                                                                 | Bien                                                                                          |
| Fecha vacía/inválida            | Falta la fecha del gasto. Es obligatoria para registrar el gasto. Elige la fecha del gasto.      | Bien                                                                                          |
| Sin sublotes disponibles        | No hay sublotes disponibles para asociar este gasto. Selecciona "Gasto general" o crea sublotes. | Bien                                                                                          |
| Sin sublotes seleccionados      | No hay sublotes seleccionados. Selecciona al menos un sublote.                                   | Bien                                                                                          |
| Guardado fallido                | No pude guardar el gasto. Revisa tus datos y vuelve a intentarlo.                                | Bien                                                                                          |
| Gasto registrado                | El gasto se guardó correctamente.                                                                | Bien                                                                                          |
| Estado de pago inválido         | estadoPago debe ser PAGADO o PENDIENTE                                                           | Técnico: si aparece al usuario, cambiar por "Selecciona si el gasto está pagado o pendiente." |
| Gasto no encontrado             | Gasto con id "..." no encontrado                                                                 | Técnico: no debería mostrarse crudo.                                                          |

## Inventario

Fuentes: `frontend/src/pages/Inventario.tsx`, `frontend/src/pages/Sublotes.tsx`

| Estado / caso                     | Mensaje visible                                                                                                              | QA                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Resumen                           | Resumen de Inventario                                                                                                        | Bien                                                                  |
| Capacidad usada                   | Capacidad usada: X%                                                                                                          | Bien                                                                  |
| Ajuste                            | Ajustar bodega                                                                                                               | Bien                                                                  |
| Filtro                            | Más reciente / Más antiguo                                                                                                   | Bien                                                                  |
| Filtros tipo                      | Todos / Verde / Seco                                                                                                         | Bien                                                                  |
| Acción secado                     | Iniciar secado                                                                                                               | Bien                                                                  |
| Sin lotes por filtro              | No encontramos lotes en este filtro. Cambia el tipo de café o registra una compra para crear los primeros lotes.             | Bien                                                                  |
| Detalle no encontrado             | No se encontró el lote solicitado.                                                                                           | Bien                                                                  |
| Error carga sublote               | No se pudo cargar el detalle del sublote.                                                                                    | Bien                                                                  |
| Peso inválido sublote             | El nuevo peso no es válido.                                                                                                  | Bien                                                                  |
| Peso mayor al inicial             | El peso no puede superar el peso inicial del sublote.                                                                        | Bien                                                                  |
| Humedad inválida                  | La humedad no es válida. Debe estar entre 0 y 100.                                                                           | Bien                                                                  |
| Factor inválido                   | El factor no es válido. No puede ser negativo.                                                                               | Bien                                                                  |
| Factor fuera de rango recomendado | Rango recomendado: 84-100. Si confirmas que el dato es correcto según la Federación Nacional de Cafeteros, puedes continuar. | Revisar: es largo, pero justificable porque explica criterio técnico. |
| Cambios guardados offline         | Tus cambios están guardados y se sincronizarán automáticamente.                                                              | Bien                                                                  |
| Fallback sublotes                 | No se pudo guardar el cambio. Vuelve a intentarlo cuando tengas conexión. Si el problema sigue, refresca la pantalla.        | Bien                                                                  |

## Secado

Fuentes: `frontend/src/pages/SecadoInicio.tsx`, `SecadoSeleccion.tsx`, `SecadoProceso.tsx`, `SecadoResumen.tsx`, `frontend/src/utils/secadoFlow.ts`

| Paso / caso                  | Mensaje visible                                                                                                                              | QA   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| No hay lotes verdes          | No hay lotes verdes disponibles. Registra una compra primero para iniciar un proceso de secado.                                              | Bien |
| Error carga secado           | No se pudo cargar el secado. La información no está disponible en este momento. Reintenta la carga o vuelve a inventario.                    | Bien |
| Sin sublote seleccionado     | Selecciona al menos un sublote para iniciar secado.                                                                                          | Bien |
| Cantidad mayor al disponible | La cantidad supera lo disponible. El secado solo puede iniciar con el peso disponible del sublote. Ajusta los kilos a secar.                 | Bien |
| Entrada inválida             | La cantidad no es válida. Necesitamos un peso mayor a 0 para iniciar el secado. Ingresa una cantidad mayor a 0.                              | Bien |
| Fecha inválida secado        | Revisa la fecha del secado. Solo puedes registrar fechas desde 2026 hasta hoy. Elige una fecha válida para continuar.                        | Bien |
| Salida mayor que entrada     | La salida supera la entrada. El peso seco no puede ser mayor que el café que entró al secado. Ajusta los kilos de salida.                    | Bien |
| Salida seca vacía            | Falta registrar la salida. Necesitamos saber cuántos kilos secos quedaron. Ingresa al menos un peso de salida.                               | Bien |
| Resultado no guardable       | Revisa el resultado del secado. Hay un dato que no podemos guardar así. Ajusta el peso y vuelve a finalizar.                                 | Bien |
| Persistencia fallida         | No se pudo actualizar el inventario. El secado quedó guardado localmente, pero falta sincronizar el cambio real. Reintenta la actualización. | Bien |

## Ajustes

Fuente: `frontend/src/pages/Ajustes.tsx`

| Campo / caso                  | Mensaje visible                                                                                                        | QA                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Usuario sin nombre            | Falta tu nombre. No sabemos cómo llamarte. Escribe tu nombre de usuario.                                               | Bien                          |
| Correo inválido               | Correo inválido. El formato no es correcto. Ej. usuario@correo.com                                                     | Bien                          |
| Teléfono inválido             | Teléfono inválido. Debe tener 10 números y empezar por 3. Verifica el número ingresado.                                | Bien                          |
| Nombre negocio inválido       | Revisa el nombre. Puede incluir letras, números, espacios y signos comerciales comunes. Escribe el nombre del negocio. | Bien                          |
| Nombre empresa largo          | Nombre muy largo. Máximo 30 caracteres permitidos. Acorta el nombre de la empresa.                                     | Bien                          |
| Descripción empresa larga     | Descripción muy larga. Máximo 50 caracteres permitidos. Acorta la descripción de la empresa.                           | Bien                          |
| Tipo empresa vacío            | Falta el tipo. ¿A qué se dedica tu negocio? Selecciona el tipo de empresa.                                             | Bien                          |
| Bodega sin nombre             | Bodega sin nombre. Ponle un nombre para identificarla. Escribe el Nombre.                                              | Bien                          |
| Capacidad inválida            | Capacidad inválida. Debe estar entre 1 y el máximo permitido. Corrige la capacidad para continuar.                     | Bien                          |
| Capacidad menor al inventario | Capacidad muy pequeña. Ya tienes más café guardado que ese límite. Aumenta la Capacidad de bodega.                     | Bien                          |
| Fallback ajustes              | Ups, no se pudo guardar. Revisa los campos señalados. Vuelve a intentar.                                               | Revisar: mismo caso de "Ups". |

## Errores backend que pueden llegar al frontend

Estos mensajes no siempre se muestran tal cual. Si aparecen crudos en pantalla, conviene mapearlos a mensajes humanos.

### Compras

| Mensaje backend                                    | QA      |
| -------------------------------------------------- | ------- |
| tipoCafeId debe ser un UUID válido                 | Técnico |
| tipoCafeId es obligatorio                          | Técnico |
| calidadId debe ser un UUID válido                  | Técnico |
| calidadId es obligatorio                           | Técnico |
| pesoInicial debe ser un número                     | Técnico |
| El peso inicial debe ser mínimo 5 kg               | Bien    |
| El peso inicial no puede exceder los 99.999 kg     | Bien    |
| precioKg debe ser un número                        | Técnico |
| El precio por kg debe ser mínimo $1.000            | Bien    |
| El precio por kg no puede exceder los 100.000      | Bien    |
| El productor seleccionado no es válido             | Bien    |
| Debe incluir al menos un sublote                   | Bien    |
| Usuario no encontrado                              | Técnico |
| El fallback de sublotes devolvió un valor inválido | Técnico |

### Ventas

| Mensaje backend                                                                                                  | QA                                                       |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| El sublote seleccionado no es válido                                                                             | Bien                                                     |
| Debe seleccionar un sublote                                                                                      | Bien                                                     |
| El peso vendido debe ser un número                                                                               | Técnico                                                  |
| El peso vendido debe ser mínimo 5 kg                                                                             | Bien                                                     |
| El peso vendido no puede superar los 99.999 kg                                                                   | Bien                                                     |
| El precio por kg debe ser un número                                                                              | Técnico                                                  |
| El precio por kg debe ser mínimo $1.000                                                                          | Bien                                                     |
| El precio por kg no puede superar los 100.000                                                                    | Bien                                                     |
| Debe registrar al menos un detalle de venta                                                                      | Bien                                                     |
| No hay suficiente inventario para realizar la venta                                                              | Bien                                                     |
| El cliente seleccionado no está disponible para esta organización. Revise el dato e intente de nuevo.            | Bien, aunque "Revise" podría ser "Revisa".               |
| Esta venta ya había sido registrada y luego anulada. Para evitar duplicados, envíela con un nuevo identificador. | Técnico/operativo: no debería aparecer al usuario final. |

### Gastos

| Mensaje backend                                | QA      |
| ---------------------------------------------- | ------- |
| Escribe el concepto del gasto.                 | Bien    |
| El concepto debe incluir al menos una palabra. | Bien    |
| El concepto contiene caracteres no válidos.    | Bien    |
| Máximo 60 caracteres.                          | Bien    |
| Máximo 200 caracteres.                         | Bien    |
| montoGasto debe ser un número                  | Técnico |
| El monto del gasto debe ser mayor a 0          | Bien    |
| El monto supera el máximo permitido            | Bien    |
| fechaGasto debe ser una fecha ISO 8601         | Técnico |
| fechaGasto es obligatoria                      | Técnico |
| estadoPago debe ser PAGADO o PENDIENTE         | Técnico |
| subloteIds debe ser un arreglo de UUIDs        | Técnico |
| Cada subloteId debe ser un UUID v4 válido      | Técnico |

### Bodega

| Mensaje backend                                       | QA      |
| ----------------------------------------------------- | ------- |
| El nombre de la bodega es requerido                   | Bien    |
| La capacidad de bodega no es válida                   | Bien    |
| La capacidad no puede ser menor al inventario actual  | Bien    |
| El precio máximo debe ser un número positivo          | Bien    |
| El precio máximo de venta debe ser un número positivo | Bien    |
| Usuario no encontrado o sin organización              | Técnico |

### Productores y clientes

| Mensaje backend                                           | QA      |
| --------------------------------------------------------- | ------- |
| El nombre del productor debe ser texto                    | Técnico |
| El nombre del productor es obligatorio                    | Bien    |
| El nombre del productor no puede exceder 120 caracteres   | Bien    |
| El tipo de documento del productor no es válido           | Bien    |
| El documento del productor es obligatorio                 | Bien    |
| El documento del productor no puede exceder 40 caracteres | Bien    |
| Productor no encontrado                                   | Bien    |
| El nombre del cliente debe ser texto                      | Técnico |
| El nombre del cliente es obligatorio                      | Bien    |
| El nombre del cliente no puede exceder 120 caracteres     | Bien    |
| Cliente no encontrado                                     | Bien    |

### Secado

| Mensaje backend                         | QA      |
| --------------------------------------- | ------- |
| El sublote origen no es válido          | Bien    |
| El sublote origen es obligatorio        | Bien    |
| El peso de entrada debe ser un número   | Técnico |
| El peso de entrada debe ser mayor a 0   | Bien    |
| La calidad de salida no es válida       | Bien    |
| El peso de salida debe ser un número    | Técnico |
| El peso de salida debe ser mayor a 0    | Bien    |
| La humedad debe ser un número           | Técnico |
| La humedad no puede ser negativa        | Bien    |
| La humedad no puede superar 100%        | Bien    |
| Debe incluir al menos un sublote origen | Bien    |
| Debe incluir al menos una salida seca   | Bien    |

## Mensajes ambiguos o a mejorar primero

| Prioridad | Mensaje actual                                                                                        | Problema                    | Propuesta                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------ |
| Alta      | Token de Google inválido                                                                              | Técnico para usuario final. | No pudimos validar tu cuenta de Google. Intenta nuevamente.                    |
| Alta      | Usuario no encontrado                                                                                 | Técnico y seco.             | No encontramos tu usuario. Inicia sesión nuevamente.                           |
| Alta      | fechaGasto debe ser una fecha ISO 8601                                                                | Técnico.                    | Elige una fecha válida para el gasto.                                          |
| Alta      | montoGasto debe ser un número                                                                         | Técnico.                    | Ingresa solo números.                                                          |
| Media     | Ups, no se pudo guardar.                                                                              | Tono informal y genérico.   | No se pudo guardar. Revisa los campos marcados.                                |
| Media     | No encontramos la información.                                                                        | Ambiguo.                    | No encontramos la información solicitada. Recarga e intenta otra vez.          |
| Media     | Valor inválido. Revisa el valor ingresado.                                                            | Ambiguo si aparece solo.    | Usar solo como fallback; preferir mensaje por campo.                           |
| Media     | Esta venta ya había sido registrada y luego anulada...                                                | Muy técnico para operación. | Esta venta no se puede reenviar. Crea una nueva venta.                         |
| Baja      | El cliente seleccionado no está disponible para esta organización. Revise el dato e intente de nuevo. | Formalidad inconsistente.   | El cliente seleccionado no está disponible. Revisa el dato e intenta de nuevo. |

## Checklist QA sugerido

1. Revisar cada formulario dejando campos vacíos.
2. Probar números exagerados en peso, precio, monto y capacidad.
3. Probar nombres con solo números.
4. Probar símbolos raros en nombres, concepto y documentos.
5. Probar fechas futuras.
6. Probar acciones sin conexión.
7. Probar bodega al 80%, 90% y 100%.
8. Probar compra sin espacio disponible.
9. Probar venta mayor al inventario.
10. Probar secado con salida mayor a entrada.
