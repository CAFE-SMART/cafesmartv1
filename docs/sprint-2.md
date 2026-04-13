## 🧾 Sprint 2 – Iteración mejorada

### 🔹 Avances del sistema
- Implementación completa del flujo base del negocio: **compra → inventario → venta**, alineado al modelo de sublotes como unidad de trazabilidad.  
- Autenticación funcional con Supabase Auth (registro e inicio de sesión), asegurando acceso básico al sistema.  
- Registro de compras mediante formulario estructurado que genera sublotes con datos clave (tipo, calidad, peso, precio), garantizando consistencia en inventario.  
- Visualización de inventario enfocada en claridad para el usuario final, mostrando estado actual de cada sublote.  
- Registro de ventas conectado directamente al inventario, con validación automática para evitar inconsistencias (no permite vender más de lo disponible).  

---

### 🔹 Decisiones técnicas
- Uso de **Supabase** para backend y autenticación con el fin de reducir complejidad operativa y acelerar el desarrollo del MVP.  
- Implementación de **React Native** para asegurar portabilidad móvil y facilidad de uso en campo.  
- Modelo basado en **sublotes como entidad central**, permitiendo trazabilidad real sin sobrecomplicar la estructura.  
- Separación frontend/backend para mejorar mantenibilidad y escalabilidad.  
- Uso de **Docker** para garantizar consistencia en entornos de desarrollo.  

---

### 🔹 Enfoque del Sprint
- Prioridad en un **MVP funcional y usable** sobre funcionalidades avanzadas.  
- Reducción de alcance (sin offline, alertas ni analítica avanzada) para enfocarse en valor real.  
- Validación del flujo con lógica de negocio real (cooperativa vs compraventa).  

---

### 🔹 Resultado del Sprint
- Flujo completo operativo y validado.  
- Base sólida lista para integrar el módulo financiero en el Sprint 3 (utilidad, merma, gastos, dashboard).