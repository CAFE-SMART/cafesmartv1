import type { DocumentType } from '../../utils/personValidation';

export type ModoVenta = 'PARCIAL' | 'TOTAL';
export type Step = 1 | 2 | 3;

export type ClienteOption = {
  id: string;
  nombre: string;
  documento: string;
  detalle: string;
  telefono?: string;
  tipoDocumento?: DocumentType;
  createdAt?: string;
  rapido?: boolean;
};

export type ClienteForm = {
  nombre: string;
  telefono: string;
  documento: string;
  tipoDocumento: DocumentType | '';
};

export type ClienteFormErrors = Partial<Record<keyof ClienteForm, string>>;

export type LoteVenta = {
  id: string;
  codigo: string;
  tipoCafeId: string;
  tipoCafe: string;
  calidadId: string;
  calidad: string;
  disponibleKg: number;
  cantidadKg: string;
  precioKg: string;
  pesoVerificadoKg: string;
};

export type VentaFifoItem = {
  groupId: string;
  subloteId: string;
  subloteNombre: string;
  fifoPosition: number;
  pesoAsignado: number;
  fechaEntrada: string;
  costoBase: number | null;
};

export type VentaGuardadaResumen = {
  referenciaId: string;
  fecha: string;
  clienteNombre: string;
  clienteDocumento: string;
  totalKg: number;
  totalVenta: number;
  items: Array<{
    codigo: string;
    tipoCafe: string;
    calidad: string;
    cantidadKg: number;
    subtotal: number;
  }>;
  fifoBreakdown?: VentaFifoItem[];
};

export type VentaParcialCardAlert = {
  title: string;
  detail: string;
};

export type ClienteSortMode = 'recent' | 'oldest' | 'az' | 'za' | 'doc-asc' | 'doc-desc';

export type UseVentasState = {
  cargando: boolean;
  loadError: string | null;
  guardandoVenta: boolean;
  submitError: string | null;
  registroErrorMensaje: string | null;
  ventaGuardada: VentaGuardadaResumen | null;
  paso: Step;
  botonConfirmarPresionado: boolean;
  intentoPaso1: boolean;
  intentoPaso2: boolean;
  clienteMetodo: 'BUSCAR' | 'GENERAL' | 'REGISTRAR' | null;
  modoVenta: ModoVenta | null;
  fechaVenta: string;
  fechaVentaPickerOpen: boolean;
  preciosVentaTotal: Record<string, string>;
  lotesVenta: LoteVenta[];
  ventaParcialOpenId: string | null;
  busquedaCafeVenta: string;
  tipoCafeFiltroVenta: string;
  calidadFiltroVenta: string;
  tipoCafeFiltroOpen: boolean;
  calidadFiltroOpen: boolean;
  mostrarTodosCafeVenta: boolean;
  ventaParcialAlert: string | null;
  ventaParcialCardAlerts: Record<string, VentaParcialCardAlert>;
  ajustesVentaParcialConfirmados: Record<string, true>;
  ventaFifoBreakdown: VentaFifoItem[];
  mostrarDesgloseSublotesVenta: boolean;
  revisionDeleteAlert: VentaParcialCardAlert | null;
  borradorVentaPendiente: any | null;
  mostrarModalBorradorVenta: boolean;
  clientes: ClienteOption[];
  clienteSeleccionado: ClienteOption | null;
  busquedaCliente: string;
  busquedaAplicada: string;
  mostrarModal: boolean;
  mostrarModalClientes: boolean;
  clienteDetalle: ClienteOption | null;
  clienteEditando: ClienteOption | null;
  mostrarModalConfirmar: boolean;
  mostrarModalCancelar: boolean;
  busquedaClientesModal: string;
  clientesSortMode: ClienteSortMode;
  clientesSortDropdownOpen: boolean;
  clienteDocumentoDropdownOpen: boolean;
  mostrarHistorialVentas: boolean;
  historialVentaFecha: string;
  historialVentaFechaPickerOpen: boolean;
  historialVentaCliente: string;
  historialVentaOrden: 'recent' | 'oldest';
  mostrarHistorialLotesVenta: boolean;
  ventasRealizadas: VentaGuardadaResumen[];
  clienteForm: ClienteForm;
  nombreMaxToast: boolean;
  clienteFormErrors: ClienteFormErrors;
  clienteFormError: string | null;
};
