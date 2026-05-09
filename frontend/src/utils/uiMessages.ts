export type MensajeUI = {
  titulo: string;
  mensaje: string;
  accion?: string;
};

export const UI_MESSAGES = {
  auth: {
    invalidCredentials: {
      titulo: 'No pudimos iniciar sesión',
      mensaje: 'Revisa el correo o la contraseña.',
      accion: 'Ajusta los datos e intenta nuevamente',
    },
    forbidden: {
      titulo: 'Acceso no disponible',
      mensaje: 'No tienes acceso a esta opción.',
      accion: 'Contacta al administrador',
    },
    offline: {
      titulo: 'Sin conexión',
      mensaje: 'No pudimos conectarnos en este momento.',
      accion: 'Intenta nuevamente en unos segundos',
    },
    registerFailed: {
      titulo: 'No pudimos completar el registro',
      mensaje: 'No pudimos completar el registro.',
      accion: 'Intenta nuevamente',
    },
    sessionExpired: {
      titulo: 'Tu sesión expiró',
      mensaje: 'Tu sesión expiró.',
      accion: 'Inicia sesión nuevamente',
    },
  },
  inventory: {
    notFound: {
      titulo: 'No encontramos la información',
      mensaje: 'No encontramos la información.',
      accion: 'Verifica los datos',
    },
    noStock: {
      titulo: 'Stock insuficiente',
      mensaje: 'No hay suficiente stock disponible.',
      accion: 'Ajusta la cantidad',
    },
  },
  forms: {
    invalidDate: {
      titulo: 'Fecha inválida',
      mensaje: 'La fecha ingresada no es válida.',
      accion: 'Verifica e intenta otra vez',
    },
    invalidValue: {
      titulo: 'Valor inválido',
      mensaje: 'Revisa el valor ingresado.',
      accion: 'Corrige el dato',
    },
    incompleteData: {
      titulo: 'Faltan datos por completar',
      mensaje: 'Faltan datos por completar.',
      accion: 'Revisa los campos marcados',
    },
  },
  system: {
    saveFailed: {
      titulo: 'No pudimos guardar la información',
      mensaje: 'No pudimos guardar la información.',
      accion: 'Intenta nuevamente',
    },
    timeout: {
      titulo: 'La conexión tardó demasiado',
      mensaje: 'La conexión tardó demasiado.',
      accion: 'Intenta nuevamente',
    },
    internalError: {
      titulo: 'Tuvimos un problema',
      mensaje: 'Tuvimos un problema.',
      accion: 'Intenta más tarde',
    },
  },
  loading: {
    inventory: 'Cargando inventario...',
    movements: 'Cargando movimientos...',
    lotsForSale: 'Cargando lotes para venta...',
    lotsForDrying: 'Cargando lotes para secado...',
  },
  empty: {
    recentMovements: {
      titulo: 'Sin movimientos recientes',
      mensaje:
        'Cuando registres compras o gastos, aparecerán aquí para revisar la actividad del negocio.',
      accion: 'Registrar compra',
    },
    dashboardMovements: {
      titulo: 'Todavía no hay movimientos',
      mensaje:
        'Registra una compra o una venta para que el resumen del día empiece a mostrar actividad.',
    },
    inventoryByFilter: {
      titulo: 'No encontramos lotes en este filtro',
      mensaje:
        'Cambia el tipo de café o registra una compra para crear los primeros lotes.',
      accion: 'Registrar compra',
    },
    clients: {
      titulo: 'No encontramos clientes para mostrar',
      mensaje:
        'Prueba otra búsqueda o registra un cliente nuevo para completar la venta.',
    },
    dryLots: {
      titulo: 'No hay lotes verdes disponibles',
      mensaje: 'Registra una compra primero para iniciar un proceso de secado.',
      accion: 'Registrar compra',
    },
  },
  success: {
    saved: {
      titulo: 'Información guardada',
      mensaje: 'Información guardada correctamente.',
      accion: 'Seguir',
    },
    saleCreated: {
      titulo: 'Venta registrada',
      mensaje: 'La venta se registró correctamente.',
      accion: 'Ver detalle',
    },
    expenseCreated: {
      titulo: 'Gasto registrado',
      mensaje: 'El gasto se guardó correctamente.',
      accion: 'Registrar otro',
    },
    purchaseCreated: {
      titulo: 'Compra registrada',
      mensaje: 'Compra registrada correctamente.',
      accion: 'Ver detalle',
    },
    registerComplete: {
      titulo: 'Registro exitoso',
      mensaje: 'Registro completado con éxito.',
      accion: 'Continúa',
    },
    accountCreated: {
      titulo: 'Cuenta creada',
      mensaje: 'Tu cuenta quedó lista correctamente.',
      accion: 'Continúa',
    },
  },
} as const;

export function createUiMessage(
  titulo: string,
  mensaje: string,
  accion?: string,
): MensajeUI {
  return { titulo, mensaje, accion };
}
