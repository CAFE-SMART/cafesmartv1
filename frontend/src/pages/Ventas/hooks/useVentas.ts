import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Preferences } from '@capacitor/preferences';
import { listarClientes } from '../../../services/clientesService';
import { obtenerLotes, obtenerDetalleLote, guardarPesosSublotes } from '../../../services/lotesService';
import { crearVenta } from '../../../services/ventasService';
import { obtenerDeviceId } from '../../../utils/deviceId';
import { getTodayLocalDateValue, validateBusinessDateRange, toIsoDateAtUtcNoon } from '../../../utils/date';
import { PRECIO_MINIMO_KG } from '../../../utils/businessRules';
import { VENTA_DRAFT_STORAGE_KEY, VENTA_FILTRO_TODOS } from '../constants';
import type { VentaGuardadaResumen, ClienteOption, ClienteForm, ClienteFormErrors, LoteVenta, ModoVenta, Step, VentaParcialCardAlert, VentaFifoItem } from '../types';
import { dedupeClientesOptions, esErrorGeneralGuardadoVenta, findClienteExistente, getDisponibleVenta, getVentaSubmitMessage, isValidCantidadInput, isValidPrecioInput, kg, mapClienteToOption, mkLotes, money, norm, pesoVerificadoInvalido, round2, toNum, uid, soloDigitos, MAX_PRECIO_KG } from '../utils';
import { ENABLE_SECADO_PROTOTYPE } from '../../../config/features';
import { applySecadoToLots, applySecadoToDetalle } from '../../../utils/secadoFlow';
import { sanitizeSearchInput } from '../../../utils/inputLimits';
import { sanitizeNameInput, sanitizeDocumentInput, formatPhoneNumber, sanitizeDigits as sanitizePersonDigits, normalizeCompanyName, normalizeHumanName, normalizeDocumentForStorage, validateCompanyName, validatePersonName, validateDocumentNumber } from '../../../utils/personValidation';

async function readVentaDraft() {
  try {
    const raw = await Preferences.get({ key: VENTA_DRAFT_STORAGE_KEY });
    return raw.value ? JSON.parse(raw.value) : null;
  } catch {
    return null;
  }
}

async function writeVentaDraft(draft: any) {
  try {
    await Preferences.set({ key: VENTA_DRAFT_STORAGE_KEY, value: JSON.stringify(draft) });
  } catch {}
}

async function clearVentaDraft() {
  try {
    await Preferences.remove({ key: VENTA_DRAFT_STORAGE_KEY });
  } catch {}
}

export function useVentas() {
  const navigate = useNavigate();
  const [cargando, setCargando] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [guardandoVenta, setGuardandoVenta] = React.useState(false);
  const [validandoPasoVenta, setValidandoPasoVenta] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [registroErrorMensaje, setRegistroErrorMensaje] = React.useState<string | null>(null);
  const [ventaGuardada, setVentaGuardada] = React.useState<VentaGuardadaResumen | null>(null);
  const [paso, setPaso] = React.useState<Step>(1);
  const [botonConfirmarPresionado, setBotonConfirmarPresionado] = React.useState(false);
  const [intentoPaso1, setIntentoPaso1] = React.useState(false);
  const [intentoPaso2, setIntentoPaso2] = React.useState(false);
  const [clienteMetodo, setClienteMetodo] = React.useState<'BUSCAR' | 'GENERAL' | 'REGISTRAR' | null>(null);
  const [modoVenta, setModoVenta] = React.useState<ModoVenta | null>(null);
  const [fechaVenta, setFechaVenta] = React.useState(getTodayLocalDateValue());
  const [fechaVentaPickerOpen, setFechaVentaPickerOpen] = React.useState(false);
  const [preciosVentaTotal, setPreciosVentaTotal] = React.useState<Record<string, string>>({});
  const [lotesVenta, setLotesVenta] = React.useState<LoteVenta[]>([]);
  const [ventaParcialOpenId, setVentaParcialOpenId] = React.useState<string | null>(null);
  const [busquedaCafeVenta, setBusquedaCafeVenta] = React.useState('');
  const [tipoCafeFiltroVenta, setTipoCafeFiltroVenta] = React.useState(VENTA_FILTRO_TODOS);
  const [calidadFiltroVenta, setCalidadFiltroVenta] = React.useState(VENTA_FILTRO_TODOS);
  const [tipoCafeFiltroOpen, setTipoCafeFiltroOpen] = React.useState(false);
  const [calidadFiltroOpen, setCalidadFiltroOpen] = React.useState(false);
  const [mostrarTodosCafeVenta, setMostrarTodosCafeVenta] = React.useState(false);
  const [ventaParcialAlert, setVentaParcialAlert] = React.useState<string | null>(null);
  const [ventaParcialCardAlerts, setVentaParcialCardAlerts] = React.useState<Record<string, VentaParcialCardAlert>>({});
  const [ajustesVentaParcialConfirmados, setAjustesVentaParcialConfirmados] = React.useState<Record<string, true>>({});
  const [ventaFifoBreakdown, setVentaFifoBreakdown] = React.useState<VentaFifoItem[]>([]);
  const [mostrarDesgloseSublotesVenta, setMostrarDesgloseSublotesVenta] = React.useState(false);
  const [revisionDeleteAlert, setRevisionDeleteAlert] = React.useState<VentaParcialCardAlert | null>(null);
  const [borradorVentaPendiente, setBorradorVentaPendiente] = React.useState<any | null>(null);
  const [mostrarModalBorradorVenta, setMostrarModalBorradorVenta] = React.useState(false);
  const [clientes, setClientes] = React.useState<ClienteOption[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = React.useState<ClienteOption | null>(null);
  const [busquedaCliente, setBusquedaCliente] = React.useState('');
  const [busquedaAplicada, setBusquedaAplicada] = React.useState('');
  const [mostrarModal, setMostrarModal] = React.useState(false);
  const [mostrarModalClientes, setMostrarModalClientes] = React.useState(false);
  const [clienteDetalle, setClienteDetalle] = React.useState<ClienteOption | null>(null);
  const [clienteEditando, setClienteEditando] = React.useState<ClienteOption | null>(null);
  const [mostrarModalConfirmar, setMostrarModalConfirmar] = React.useState(false);
  const [mostrarModalCancelar, setMostrarModalCancelar] = React.useState(false);
  const clientesSearchRef = React.useRef<HTMLInputElement | null>(null);
  const [busquedaClientesModal, setBusquedaClientesModal] = React.useState('');
  const [clientesSortMode, setClientesSortMode] = React.useState<'recent' | 'oldest' | 'az' | 'za' | 'doc-asc' | 'doc-desc'>('recent');
  const [clientesSortDropdownOpen, setClientesSortDropdownOpen] = React.useState(false);
  const [clienteDocumentoDropdownOpen, setClienteDocumentoDropdownOpen] = React.useState(false);
  const [mostrarHistorialVentas, setMostrarHistorialVentas] = React.useState(false);
  const [historialVentaFecha, setHistorialVentaFecha] = React.useState('');
  const [historialVentaFechaPickerOpen, setHistorialVentaFechaPickerOpen] = React.useState(false);
  const [historialVentaCliente, setHistorialVentaCliente] = React.useState('TODOS');
  const [historialVentaOrden, setHistorialVentaOrden] = React.useState<'recent' | 'oldest'>('recent');
  const [mostrarHistorialLotesVenta, setMostrarHistorialLotesVenta] = React.useState(false);
  const [ventasRealizadas, setVentasRealizadas] = React.useState<VentaGuardadaResumen[]>([]);
  const [clienteForm, setClienteForm] = React.useState<ClienteForm>({ nombre: '', telefono: '', documento: '', tipoDocumento: '' });
  const [nombreMaxToast, setNombreMaxToast] = React.useState(false);
  const nombreMaxToastTimerRef = React.useRef<number | null>(null);
  const [clienteFormErrors, setClienteFormErrors] = React.useState<ClienteFormErrors>({});
  const [clienteFormError, setClienteFormError] = React.useState<string | null>(null);
  const ventaLocalIdRef = React.useRef(uid());
  const ventaParcialAlertTimerRef = React.useRef<number | null>(null);
  const ventaParcialCardAlertTimerRef = React.useRef<number | null>(null);
  const revisionDeleteAlertTimerRef = React.useRef<number | null>(null);

  const cargarLotes = React.useCallback(async () => {
    try {
      setCargando(true);
      setLoadError(null);
      const [lotesResult, clientesResult] = await Promise.allSettled([obtenerLotes(), listarClientes()]);
      if (lotesResult.status === 'rejected') throw lotesResult.reason;
      if (clientesResult.status === 'rejected') setClientes([]);
      const lotes = lotesResult.value;
      const clientesData = clientesResult.status === 'fulfilled' ? clientesResult.value : [];
      const lotesDisponibles = ENABLE_SECADO_PROTOTYPE ? applySecadoToLots(lotes, { includeGeneratedOutputs: false }) : lotes;
      setLotesVenta(mkLotes(lotesDisponibles));
      setClientes(dedupeClientesOptions(clientesData.map(mapClienteToOption)));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'No fue posible cargar el inventario para venta.');
    } finally {
      setCargando(false);
    }
  }, []);

  React.useEffect(() => {
    void cargarLotes();
  }, [cargarLotes]);

  React.useEffect(() => {
    const loadDraft = async () => {
      const draft = await readVentaDraft();
      if (draft?.savedAt) {
        setBorradorVentaPendiente(draft);
        setMostrarModalBorradorVenta(true);
      }
    };
    void loadDraft();
  }, []);

  React.useEffect(() => {
    if (cargando || ventaGuardada || registroErrorMensaje || mostrarModalBorradorVenta || borradorVentaPendiente) return;
    const hasProgress = paso > 1 || Boolean(clienteSeleccionado) || Boolean(modoVenta) || lotesVenta.some((lote) => lote.cantidadKg || lote.pesoVerificadoKg) || Object.values(preciosVentaTotal).some((precio) => precio.trim() !== '');
    if (!hasProgress) {
      void clearVentaDraft();
      return;
    }
    const timer = window.setTimeout(() => {
      void writeVentaDraft({
        savedAt: Date.now(),
        paso,
        clienteSeleccionado,
        clienteMetodo,
        fechaVenta,
        modoVenta,
        lotesVenta,
        preciosVentaTotal,
        ajustesVentaParcialConfirmados,
        localId: ventaLocalIdRef.current,
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [cargando, borradorVentaPendiente, clienteMetodo, clienteSeleccionado, fechaVenta, lotesVenta, mostrarModalBorradorVenta, modoVenta, paso, preciosVentaTotal, registroErrorMensaje, ventaGuardada, ajustesVentaParcialConfirmados]);

  const clientesRecientes = React.useMemo(() => {
    const base = dedupeClientesOptions([...clientes]);
    const term = norm(busquedaAplicada.trim());
    if (!term) return base;
    return base.filter((c) => [c.nombre, c.documento, c.detalle].some((v) => norm(v).includes(term)));
  }, [busquedaAplicada, clientes]);

  const sinClientesRegistrados = clientes.length === 0;

  const lotesConCantidad = React.useMemo(() => {
    if (modoVenta === 'TOTAL') {
      return lotesVenta.filter((l) => getDisponibleVenta(l) > 0).map((l) => ({
        ...l,
        cantidad: getDisponibleVenta(l),
        precio: toNum(preciosVentaTotal[l.tipoCafeId] ?? ''),
      }));
    }
    if (modoVenta !== 'PARCIAL') return [];
    return lotesVenta.map((l) => ({ ...l, cantidad: toNum(l.cantidadKg), precio: toNum(l.precioKg) })).filter((l) => ajustesVentaParcialConfirmados[l.id] && l.cantidad > 0);
  }, [ajustesVentaParcialConfirmados, lotesVenta, modoVenta, preciosVentaTotal]);

  const totalKg = React.useMemo(() => lotesConCantidad.reduce((a, l) => a + l.cantidad, 0), [lotesConCantidad]);
  const totalEstimado = React.useMemo(() => lotesConCantidad.reduce((a, l) => a + l.cantidad * l.precio, 0), [lotesConCantidad]);
  const totalDisponibleVenta = React.useMemo(() => lotesVenta.reduce((total, lote) => total + getDisponibleVenta(lote), 0), [lotesVenta]);

  const resumenDisponiblePorTipo = React.useMemo(() => {
    const resumen = new Map<string, { tipoCafeId: string; tipoCafe: string; pesoKg: number }>();
    for (const lote of lotesVenta) {
      const actual = resumen.get(lote.tipoCafeId);
      resumen.set(lote.tipoCafeId, {
        tipoCafeId: lote.tipoCafeId,
        tipoCafe: lote.tipoCafe,
        pesoKg: round2((actual?.pesoKg ?? 0) + getDisponibleVenta(lote)),
      });
    }
    return Array.from(resumen.values());
  }, [lotesVenta]);

  const preciosVentaTotalInvalidos = React.useMemo(() => {
    const invalidos = new Set<string>();
    for (const item of resumenDisponiblePorTipo) {
      if (!isValidPrecioInput(preciosVentaTotal[item.tipoCafeId] ?? '')) {
        invalidos.add(item.tipoCafeId);
      }
    }
    return invalidos;
  }, [preciosVentaTotal, resumenDisponiblePorTipo]);

  const fechaVentaValidacion = React.useMemo(() => validateBusinessDateRange(fechaVenta), [fechaVenta]);

  const validarPasoVenta = React.useCallback(() => {
    if (!fechaVentaValidacion.isValid) return fechaVentaValidacion.message ?? 'Selecciona la fecha de venta.';
    if (!lotesVenta.length) return 'No hay lotes disponibles para vender.';
    if (!modoVenta) return 'Selecciona como deseas realizar la venta.';
    if (modoVenta === 'TOTAL') {
      const tipoSinPrecio = resumenDisponiblePorTipo.find((item) => preciosVentaTotalInvalidos.has(item.tipoCafeId));
      if (tipoSinPrecio) {
        const precio = preciosVentaTotal[tipoSinPrecio.tipoCafeId] ?? '';
        if (!precio.trim()) return 'Ingresa el precio por kilo.';
        if (toNum(precio) > MAX_PRECIO_KG) return 'El precio supera el máximo permitido.';
        return 'Ingresa solo números válidos.';
      }
      return null;
    }
    if (modoVenta === 'PARCIAL' && !lotesConCantidad.length) return 'Ingresa al menos una cantidad para continuar.';
    for (const l of lotesConCantidad) {
      if (pesoVerificadoInvalido(l)) return `El peso verificado no puede superar el disponible en ${l.codigo}.`;
      const disponible = getDisponibleVenta(l);
      if (l.cantidad > disponible) return `Cantidad máxima permitida: ${kg(disponible)}.`;
      if (!isValidCantidadInput(String(l.cantidad), disponible)) return `La cantidad ingresada no es válida en ${l.codigo}.`;
      if (l.precio < PRECIO_MINIMO_KG) return `Ingresa un precio por kg valido en ${l.codigo}.`;
    }
    return null;
  }, [fechaVentaValidacion.isValid, fechaVentaValidacion.message, lotesVenta.length, modoVenta, preciosVentaTotalInvalidos, resumenDisponiblePorTipo, lotesConCantidad]);

  const hayCantidadParcial = React.useMemo(
    () =>
      lotesVenta.some(
        (l) =>
          ajustesVentaParcialConfirmados[l.id] &&
          isValidCantidadInput(l.cantidadKg, getDisponibleVenta(l)) &&
          isValidPrecioInput(l.precioKg),
      ),
    [ajustesVentaParcialConfirmados, lotesVenta],
  );

  const parcialConErrores = React.useMemo(() => {
    if (modoVenta !== 'PARCIAL') return false;
    return lotesVenta.some((lote) => {
      if (!ajustesVentaParcialConfirmados[lote.id]) return false;
      const cantidad = toNum(lote.cantidadKg);
      return (
        !isValidCantidadInput(lote.cantidadKg, getDisponibleVenta(lote)) ||
        cantidad <= 0 ||
        cantidad > getDisponibleVenta(lote) ||
        !isValidPrecioInput(lote.precioKg) ||
        pesoVerificadoInvalido(lote)
      );
    });
  }, [ajustesVentaParcialConfirmados, lotesVenta, modoVenta]);

  const puedeAvanzarPaso2 =
    !fechaVentaValidacion.isValid || modoVenta === null
      ? false
      : modoVenta === 'TOTAL'
      ? resumenDisponiblePorTipo.length > 0 && preciosVentaTotalInvalidos.size === 0 && !lotesVenta.some(pesoVerificadoInvalido)
      : hayCantidadParcial && !parcialConErrores;

  const tipoCafeFiltroOpciones = React.useMemo(() => {
    const vistos = new Set<string>();
    return [
      { value: VENTA_FILTRO_TODOS, label: 'Todos los tipos' },
      ...lotesVenta.reduce<Array<{ value: string; label: string }>>((opciones, lote) => {
        const key = lote.tipoCafe.trim().toLowerCase();
        if (!key || vistos.has(key)) return opciones;
        vistos.add(key);
        opciones.push({ value: lote.tipoCafe, label: lote.tipoCafe });
        return opciones;
      }, []),
    ];
  }, [lotesVenta]);

  const calidadFiltroOpciones = React.useMemo(() => {
    const vistos = new Set<string>();
    return [
      { value: VENTA_FILTRO_TODOS, label: 'Todas las calidades' },
      ...lotesVenta.reduce<Array<{ value: string; label: string }>>((opciones, lote) => {
        const key = lote.calidad.trim().toLowerCase();
        if (!key || vistos.has(key)) return opciones;
        vistos.add(key);
        opciones.push({ value: lote.calidad, label: lote.calidad });
        return opciones;
      }, []),
    ];
  }, [lotesVenta]);

  const lotesVentaParcialFiltrados = React.useMemo(() => {
    const termino = norm(busquedaCafeVenta.trim());
    return lotesVenta.filter((lote) => {
      const texto = norm(`${lote.tipoCafe} ${lote.calidad} ${lote.codigo}`);
      const coincideBusqueda = !termino || texto.includes(termino);
      const coincideTipo = tipoCafeFiltroVenta === VENTA_FILTRO_TODOS || norm(lote.tipoCafe) === norm(tipoCafeFiltroVenta);
      const coincideCalidad = calidadFiltroVenta === VENTA_FILTRO_TODOS || norm(lote.calidad) === norm(calidadFiltroVenta);
      return coincideBusqueda && coincideTipo && coincideCalidad;
    });
  }, [busquedaCafeVenta, calidadFiltroVenta, lotesVenta, tipoCafeFiltroVenta]);

  const lotesVentaParcialVisibles = mostrarTodosCafeVenta ? lotesVentaParcialFiltrados : lotesVentaParcialFiltrados.slice(0, 3);

  const historialVentaClientes = React.useMemo(() => {
    const options = new Map<string, string>();
    options.set('TODOS', 'Todos');
    options.set('NO_REGISTRADO', 'Cliente no registrado');
    ventasRealizadas.forEach((venta) => {
      const nombre = venta.clienteNombre?.trim();
      if (nombre) options.set(nombre, nombre);
    });
    return Array.from(options.entries());
  }, [ventasRealizadas]);

  const ventasHistorialFiltradas = React.useMemo(() => {
    const sameDate = (value: string) => value.slice(0, 10) === historialVentaFecha;
    return [...ventasRealizadas]
      .filter((venta) => !historialVentaFecha || sameDate(venta.fecha))
      .filter((venta) => {
        if (historialVentaCliente === 'TODOS') return true;
        const noRegistrado = venta.clienteNombre === 'Cliente general' || venta.clienteDocumento === 'Sin detalle';
        if (historialVentaCliente === 'NO_REGISTRADO') return noRegistrado;
        return venta.clienteNombre === historialVentaCliente;
      })
      .sort((a, b) => (historialVentaOrden === 'oldest' ? new Date(a.fecha).getTime() - new Date(b.fecha).getTime() : new Date(b.fecha).getTime() - new Date(a.fecha).getTime()));
  }, [historialVentaCliente, historialVentaFecha, historialVentaOrden, ventasRealizadas]);

  const siguiente = React.useCallback(() => {
    if (validandoPasoVenta) return;
    setValidandoPasoVenta(true);
    window.setTimeout(() => setValidandoPasoVenta(false), 180);

    if (paso === 1) {
      setIntentoPaso1(true);
      if (!clienteSeleccionado) {
        setSubmitError('Selecciona un cliente para continuar.');
        setClienteFormError(null);
        return;
      }
      setSubmitError(null);
      setIntentoPaso2(false);
      return setPaso(2);
    }
    if (paso === 2) {
      setIntentoPaso2(true);
      const mensajeValidacion = validarPasoVenta();
      if (mensajeValidacion || !puedeAvanzarPaso2) {
        setSubmitError(
          mensajeValidacion ?? 'Revisa los campos obligatorios antes de continuar.',
        );
        return;
      }
      setVentaParcialCardAlerts({});
      setSubmitError(null);
      return setPaso(3);
    }
  }, [clienteSeleccionado, paso, puedeAvanzarPaso2, validarPasoVenta, validandoPasoVenta]);

  const anterior = React.useCallback(() => {
    setSubmitError(null);
    setPaso((p) => Math.max(1, p - 1) as Step);
  }, []);

  const mostrarAlertaVentaParcial = React.useCallback((message: string) => {
    setVentaParcialAlert(message);
    if (ventaParcialAlertTimerRef.current) window.clearTimeout(ventaParcialAlertTimerRef.current);
    ventaParcialAlertTimerRef.current = window.setTimeout(() => setVentaParcialAlert(null), 4200);
  }, []);

  const getVentaParcialCardAlert = React.useCallback(
    (lote: LoteVenta, requireEmpty = false, skipConfirmCheck = false): VentaParcialCardAlert | null => {
      const nombreCafe = `${lote.tipoCafe} ${lote.calidad}`;
      const cantidadTexto = lote.cantidadKg.trim();
      const precioTexto = lote.precioKg.trim();
      const cantidad = toNum(lote.cantidadKg);
      const precio = toNum(lote.precioKg);
      const disponible = getDisponibleVenta(lote);

      if (!cantidadTexto && !precioTexto) return requireEmpty ? { title: `Confirma el ajuste de ${nombreCafe}.`, detail: 'Completa cantidad y precio, luego confirma el ajuste para agregarlo a la venta.' } : null;
      if (!cantidadTexto && precioTexto) return { title: `Falta la cantidad en ${nombreCafe}.`, detail: 'Ingresa cuántos kg deseas vender.' };
      if (cantidad > disponible) return { title: `La cantidad supera el disponible de ${nombreCafe}.`, detail: `Disponible: ${kg(disponible)}.` };
      if (!isValidCantidadInput(cantidadTexto, disponible)) return { title: `Cantidad inválida en ${nombreCafe}.`, detail: `Ingresa un valor válido hasta ${kg(disponible)} con máximo 3 decimales.` };
      if (!precioTexto) return { title: `Falta el precio en ${nombreCafe}.`, detail: 'Ingresa el precio por kilo.' };
      if (precio > MAX_PRECIO_KG) return { title: 'El precio supera el máximo permitido.', detail: `Usa un valor hasta ${money(MAX_PRECIO_KG)} por kg.` };
      if (!isValidPrecioInput(precioTexto)) return { title: `Precio inválido en ${nombreCafe}.`, detail: 'Ingresa un precio válido por kilogramo.' };
      if (precio < PRECIO_MINIMO_KG) return { title: `El precio de ${nombreCafe} es demasiado bajo.`, detail: 'Ingresa un valor desde $1.000 por kg.' };
      if (pesoVerificadoInvalido(lote)) return { title: `Revisa el peso de ${nombreCafe}.`, detail: `No puede superar el disponible: ${kg(disponible)}.` };
      if (!skipConfirmCheck && !ajustesVentaParcialConfirmados[lote.id]) return { title: `Confirma el ajuste de ${nombreCafe}.`, detail: 'Presiona "Confirmar ajuste" para agregarlo a la venta.' };
      return null;
    },
    [ajustesVentaParcialConfirmados],
  );

  const mostrarAlertaTarjetaVentaParcial = React.useCallback((loteId: string, alert: VentaParcialCardAlert) => {
    setVentaParcialCardAlerts({ [loteId]: alert });
    if (ventaParcialCardAlertTimerRef.current) window.clearTimeout(ventaParcialCardAlertTimerRef.current);
    ventaParcialCardAlertTimerRef.current = window.setTimeout(() => setVentaParcialCardAlerts({}), 4200);
  }, []);

  const mostrarAlertaRevision = React.useCallback((alert: VentaParcialCardAlert) => {
    setRevisionDeleteAlert(alert);
    if (revisionDeleteAlertTimerRef.current) window.clearTimeout(revisionDeleteAlertTimerRef.current);
    revisionDeleteAlertTimerRef.current = window.setTimeout(() => setRevisionDeleteAlert(null), 4200);
  }, []);

  const confirmar = React.useCallback(async () => {
    if (!clienteSeleccionado) {
      setPaso(1);
      setIntentoPaso1(true);
      return;
    }
    const m = validarPasoVenta();
    if (m) {
      setPaso(2);
      setIntentoPaso2(true);
      return;
    }
    if (guardandoVenta) return;
    setGuardandoVenta(true);
    setBotonConfirmarPresionado(true);
    setSubmitError(null);
    setRegistroErrorMensaje(null);
    try {
      const detalles = [] as Array<{ subloteId: string; pesoVendido: number; precioKg: number }>;
      for (const lote of lotesConCantidad) {
        const poolKey = `${lote.tipoCafeId}::${lote.calidadId}`;
        const detalleBase = await obtenerDetalleLote(lote.tipoCafeId, lote.calidadId);
        const detalle = ENABLE_SECADO_PROTOTYPE ? applySecadoToDetalle(detalleBase, lote.tipoCafeId, lote.calidadId, { includeGeneratedOutputs: false }) : detalleBase;
        let pool = (detalle?.sublotes ?? [])
          .filter((sublote) => sublote.pesoActual > 0)
          .sort((a, b) => new Date(a.fechaIngreso).getTime() - new Date(b.fechaIngreso).getTime())
          .map((sublote) => ({ subloteId: sublote.id, disponibleKg: round2(sublote.pesoActual) }));
        let restante = round2(lote.cantidad);
        for (const entry of pool) {
          if (restante <= 0) break;
          if (entry.disponibleKg <= 0) continue;
          const asignado = round2(Math.min(restante, entry.disponibleKg));
          if (asignado <= 0) continue;
          detalles.push({ subloteId: entry.subloteId, pesoVendido: asignado, precioKg: round2(lote.precio) });
          entry.disponibleKg = round2(entry.disponibleKg - asignado);
          restante = round2(restante - asignado);
        }
        if (restante > 0.001) throw new Error(`La cantidad supera el disponible en ${lote.codigo}.`);
      }
      const fechaVentaIso = toIsoDateAtUtcNoon(fechaVenta);
      const respuesta = await crearVenta({
        ...(fechaVentaIso ? { fecha: fechaVentaIso } : {}),
        ...(!clienteSeleccionado.rapido ? { clienteId: clienteSeleccionado.id } : {}),
        deviceId: await obtenerDeviceId(),
        localId: ventaLocalIdRef.current,
        detalles,
      });
      const ventaResumen: VentaGuardadaResumen = {
        referenciaId: respuesta.venta.id,
        fecha: respuesta.venta.fecha,
        clienteNombre: clienteSeleccionado.nombre,
        clienteDocumento: clienteSeleccionado.documento,
        totalKg,
        totalVenta: totalEstimado,
        items: lotesConCantidad.map((item) => ({
          codigo: item.codigo,
          tipoCafe: item.tipoCafe,
          calidad: item.calidad,
          cantidadKg: item.cantidad,
          subtotal: item.cantidad * item.precio,
        })),
        fifoBreakdown: ventaFifoBreakdown,
      };
      setVentaGuardada(ventaResumen);
      setVentasRealizadas((actual) => [ventaResumen, ...actual]);
      await clearVentaDraft();
      await cargarLotes();
    } catch (error) {
      const mensaje = getVentaSubmitMessage(error);
      if (esErrorGeneralGuardadoVenta(error)) {
        setRegistroErrorMensaje(mensaje);
        setSubmitError(null);
      } else {
        setSubmitError(mensaje);
      }
    } finally {
      setGuardandoVenta(false);
      setBotonConfirmarPresionado(false);
    }
  }, [cargarLotes, clienteSeleccionado, guardandoVenta, lotesConCantidad, fechaVenta, totalEstimado, totalKg, ventaFifoBreakdown, validarPasoVenta]);

  const reiniciar = React.useCallback(() => {
    void clearVentaDraft();
    setPaso(1);
    setGuardandoVenta(false);
    setSubmitError(null);
    setRegistroErrorMensaje(null);
    setVentaGuardada(null);
    setClienteSeleccionado(null);
    setClienteMetodo(null);
    setBusquedaCliente('');
    setBusquedaAplicada('');
    setModoVenta(null);
    setMostrarModalConfirmar(false);
    setMostrarModalCancelar(false);
    setFechaVenta(getTodayLocalDateValue());
    setPreciosVentaTotal({});
    setAjustesVentaParcialConfirmados({});
    setVentaFifoBreakdown([]);
    setClienteFormErrors({});
    setIntentoPaso1(false);
    setIntentoPaso2(false);
    setLoadError(null);
    ventaLocalIdRef.current = uid();
    void cargarLotes();
  }, [cargarLotes]);

  const continuarBorradorVenta = React.useCallback(() => {
    const draft = borradorVentaPendiente;
    if (!draft) return;
    setPaso((draft.paso || 1) as Step);
    setClienteSeleccionado(draft.clienteSeleccionado ?? null);
    setClienteMetodo(draft.clienteMetodo ?? null);
    setFechaVenta(draft.fechaVenta || getTodayLocalDateValue());
    setModoVenta(draft.modoVenta ?? null);
    if (Array.isArray(draft.lotesVenta)) setLotesVenta(draft.lotesVenta);
    setPreciosVentaTotal(draft.preciosVentaTotal ?? {});
    setAjustesVentaParcialConfirmados(draft.ajustesVentaParcialConfirmados ?? {});
    ventaLocalIdRef.current = draft.localId || uid();
    setMostrarModalBorradorVenta(false);
    setBorradorVentaPendiente(null);
  }, [borradorVentaPendiente]);

  const empezarVentaNuevaDesdeBorrador = React.useCallback(() => {
    void clearVentaDraft();
    setMostrarModalBorradorVenta(false);
    setBorradorVentaPendiente(null);
    reiniciar();
  }, [reiniciar]);

  const updateLote = (id: string, campo: 'cantidadKg' | 'precioKg' | 'pesoVerificadoKg', valor: string) => {
    setVentaParcialCardAlerts((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setSubmitError(null);
    setAjustesVentaParcialConfirmados((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLotesVenta((prev) =>
      prev.map((lote) => {
        if (lote.id !== id) return lote;

        if (campo === 'cantidadKg') {
          const normalized = valor.replace(',', '.').replace(/[^\d.]/g, '');
          const parts = normalized.split('.');
          const nextValue =
            parts.length > 1
              ? `${parts[0].slice(0, 8)}.${parts.slice(1).join('').slice(0, 3)}`
              : parts[0].slice(0, 8);
          const disponible = getDisponibleVenta(lote);
          const cantidad = toNum(nextValue);

          if (nextValue && cantidad > disponible) {
            setVentaParcialCardAlerts((current) => ({
              ...current,
              [id]: {
                title: `La cantidad máxima disponible es ${kg(disponible)}.`,
                detail: 'Conservamos el último valor válido para evitar exceder el inventario.',
              },
            }));
            return lote;
          }

          return { ...lote, cantidadKg: nextValue };
        }

        if (campo === 'precioKg') {
          const nextValue = valor.replace(/[^\d]/g, '').slice(0, 8);
          const precio = toNum(nextValue);

          if (nextValue && precio > MAX_PRECIO_KG) {
            setVentaParcialCardAlerts((current) => ({
              ...current,
              [id]: {
                title: 'El precio ingresado supera el máximo permitido.',
                detail: `Usa un valor hasta ${money(MAX_PRECIO_KG)} por kg.`,
              },
            }));
            return lote;
          }

          return { ...lote, precioKg: nextValue };
        }

        return { ...lote, [campo]: valor };
      }),
    );
  };

  const confirmarAjusteParcial = React.useCallback(
    (lote: LoteVenta) => {
      const alerta = getVentaParcialCardAlert(lote, false, true);
      if (alerta) {
        mostrarAlertaTarjetaVentaParcial(lote.id, alerta);
        return;
      }
      setAjustesVentaParcialConfirmados((current) => ({ ...current, [lote.id]: true }));
      setVentaParcialCardAlerts((current) => {
        if (!current[lote.id]) return current;
        const next = { ...current };
        delete next[lote.id];
        return next;
      });
      setVentaParcialOpenId(null);
    },
    [getVentaParcialCardAlert, mostrarAlertaTarjetaVentaParcial],
  );

  const seleccionarCliente = React.useCallback((cliente: ClienteOption) => {
    setClienteSeleccionado(cliente);
    setClienteMetodo(cliente.rapido ? 'GENERAL' : 'BUSCAR');
    setBusquedaCliente('');
    setBusquedaAplicada('');
    setIntentoPaso1(false);
    setSubmitError(null);
  }, []);

  const buscarCliente = () => setBusquedaAplicada(busquedaCliente.trim());

  const validarClienteForm = React.useCallback(() => {
    const errores: ClienteFormErrors = {};
    const nombre = clienteForm.tipoDocumento === 'NIT' ? validateCompanyName(clienteForm.nombre) : validatePersonName(clienteForm.nombre, 'El nombre');
    if (!nombre.isValid) errores.nombre = nombre.message;
    const telefono = clienteForm.telefono && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(clienteForm.telefono) ? 'No uses letras.' : null;
    if (telefono) errores.telefono = telefono;
    if (!clienteForm.tipoDocumento) errores.tipoDocumento = 'Selecciona el tipo de documento.';
    const tipoSeleccionado = clienteForm.tipoDocumento || null;
    const documento = validateDocumentNumber(clienteForm.documento, 'El documento', { optional: false, type: tipoSeleccionado });
    if (clienteForm.documento.trim() && !clienteForm.tipoDocumento) {
      errores.documento = undefined;
    } else if (!documento.isValid) {
      errores.documento = documento.message;
    }
    return errores;
  }, [clienteForm.documento, clienteForm.nombre, clienteForm.telefono, clienteForm.tipoDocumento]);

  const guardarCliente = async () => {
    const nombre = clienteForm.tipoDocumento === 'NIT' ? normalizeCompanyName(clienteForm.nombre) : normalizeHumanName(clienteForm.nombre);
    const telefono = sanitizePersonDigits(clienteForm.telefono);
    const tipoDocumento = clienteForm.tipoDocumento || undefined;
    const documento = tipoDocumento ? normalizeDocumentForStorage(clienteForm.documento, tipoDocumento as any) : '';
    const errores = validarClienteForm();
    setClienteFormErrors(errores);
    setClienteFormError(null);
    if (Object.keys(errores).length > 0) return;
    const clienteExistente = findClienteExistente(clientes, nombre, documento, clienteEditando?.id);
    if (clienteExistente) {
      setClienteFormErrors((actual) => ({ ...actual, documento: 'Este documento ya está registrado.' }));
      setClienteFormError('Este documento ya está registrado. Busca el registro existente o usa otro número.');
      return;
    }
    try {
      if (clienteEditando) {
        setClienteSeleccionado({ id: clienteEditando.id, nombre, documento, detalle: clienteEditando.detalle, telefono, tipoDocumento: tipoDocumento as any });
      } else {
        setClienteSeleccionado({ id: uid(), nombre, documento, detalle: 'Cliente registrado', telefono, tipoDocumento: tipoDocumento as any });
      }
      setClienteForm({ nombre: '', telefono: '', documento: '', tipoDocumento: '' });
      setClienteFormErrors({});
      setClienteFormError(null);
      setMostrarModal(false);
      setClienteEditando(null);
      setIntentoPaso1(false);
      setSubmitError(null);
    } catch (error) {
      setClienteFormError('Error al guardar el cliente.');
    }
  };

  const editarLoteDesdeRevision = React.useCallback(() => {
    setSubmitError(null);
    setIntentoPaso2(false);
    setPaso(2);
  }, []);

  const eliminarLoteDesdeRevision = React.useCallback(
    (loteId: string) => {
      setSubmitError(null);
      setIntentoPaso2(false);
      if (lotesConCantidad.length <= 1) {
        setMostrarHistorialLotesVenta(false);
        mostrarAlertaRevision({ title: 'Debe quedar al menos un café agregado', detail: 'Si deseas cancelar completamente la venta, usa la opción "Cancelar venta".' });
        return;
      }
      setLotesVenta((prev) =>
        prev.map((lote) => {
          if (modoVenta === 'TOTAL') {
            return { ...lote, cantidadKg: lote.id === loteId ? '' : String(lote.disponibleKg), precioKg: preciosVentaTotal[lote.tipoCafeId] || lote.precioKg };
          }
          if (lote.id !== loteId) return lote;
          return { ...lote, cantidadKg: '' };
        }),
      );
      if (modoVenta === 'TOTAL') {
        setModoVenta('PARCIAL');
        setPreciosVentaTotal({});
      }
    },
    [lotesConCantidad.length, modoVenta, mostrarAlertaRevision, preciosVentaTotal],
  );

  const pasoActual = React.useMemo(() => {
    const pasos: Record<Step, { titulo: string; progreso: number }> = {
      1: { titulo: 'Cliente', progreso: 33 },
      2: { titulo: 'Seleccionar cafe', progreso: 66 },
      3: { titulo: 'Confirmar venta', progreso: 100 },
    };
    return pasos[paso];
  }, [paso]);

  const clienteInvalido = paso === 1 && intentoPaso1 && !clienteSeleccionado;
  const modoInvalido = paso === 2 && intentoPaso2 && !modoVenta;
  const fechaVentaInvalida = paso === 2 && intentoPaso2 && !fechaVentaValidacion.isValid;
  const precioTotalInvalido = paso === 2 && modoVenta === 'TOTAL' && intentoPaso2 && preciosVentaTotalInvalidos.size > 0;
  const sinInventario = paso === 2 && lotesVenta.length === 0;
  const parcialSinCantidad = paso === 2 && modoVenta === 'PARCIAL' && !hayCantidadParcial;
  const parcialSinSeleccion = parcialSinCantidad && intentoPaso2;

  const confirmarCancelarVenta = () => {
    setMostrarModalCancelar(false);
    reiniciar();
  };

  React.useEffect(() => {
    if (paso !== 3 || modoVenta !== 'PARCIAL' || lotesConCantidad.length === 0) {
      setVentaFifoBreakdown([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const breakdown: VentaFifoItem[] = [];
      for (const lote of lotesConCantidad) {
        const detalleBase = await obtenerDetalleLote(lote.tipoCafeId, lote.calidadId);
        const detalle = ENABLE_SECADO_PROTOTYPE ? applySecadoToDetalle(detalleBase, lote.tipoCafeId, lote.calidadId, { includeGeneratedOutputs: false }) : detalleBase;
        let restante = round2(lote.cantidad);
        const sublotesOrdenados = [...(detalle?.sublotes ?? [])].filter((sublote) => sublote.pesoActual > 0).sort((a, b) => new Date(a.fechaIngreso).getTime() - new Date(b.fechaIngreso).getTime());
        sublotesOrdenados.forEach((sublote, index) => {
          if (restante <= 0) return;
          const asignado = round2(Math.min(restante, sublote.pesoActual));
          if (asignado <= 0) return;
          breakdown.push({
            groupId: lote.id,
            subloteId: sublote.id,
            subloteNombre: sublote.etiqueta || `Sublote ${index + 1}`,
            fifoPosition: index + 1,
            pesoAsignado: asignado,
            fechaEntrada: sublote.fechaIngreso,
            costoBase: Number.isFinite(sublote.costoPorKg) ? sublote.costoPorKg : null,
          });
          restante = round2(restante - asignado);
        });
      }
      if (!cancelled) setVentaFifoBreakdown(breakdown);
    })().catch(() => {
      if (!cancelled) setVentaFifoBreakdown([]);
    });
    return () => {
      cancelled = true;
    };
  }, [lotesConCantidad, modoVenta, paso]);

  return {
    cargando, loadError, guardandoVenta, validandoPasoVenta, submitError, registroErrorMensaje, ventaGuardada, paso, botonConfirmarPresionado, intentoPaso1, intentoPaso2,
    clienteMetodo, clienteSeleccionado, busquedaCliente, busquedaAplicada, clientes, clientesRecientes, clienteForm, clienteFormErrors, clienteFormError, clienteEditando, clienteDetalle, sinClientesRegistrados, clientesSearchRef, busquedaClientesModal, clientesSortMode, clientesSortDropdownOpen, clienteDocumentoDropdownOpen, nombreMaxToast,
    mostrarModal, mostrarModalClientes, mostrarModalConfirmar, mostrarModalCancelar, mostrarModalBorradorVenta, mostrarHistorialLotesVenta, mostrarDesgloseSublotesVenta, mostrarHistorialVentas,
    modoVenta, fechaVenta, fechaVentaPickerOpen, fechaVentaValidacion, lotesVenta, lotesConCantidad, totalKg, totalEstimado, totalDisponibleVenta, busquedaCafeVenta, tipoCafeFiltroVenta, calidadFiltroVenta, tipoCafeFiltroOpen, calidadFiltroOpen, mostrarTodosCafeVenta, tipoCafeFiltroOpciones, calidadFiltroOpciones, lotesVentaParcialFiltrados, lotesVentaParcialVisibles, preciosVentaTotal, preciosVentaTotalInvalidos, resumenDisponiblePorTipo, ventaParcialOpenId, ventaParcialAlert, ventaParcialCardAlerts, ajustesVentaParcialConfirmados, hayCantidadParcial, puedeAvanzarPaso2, ventaFifoBreakdown, historialVentaFecha, historialVentaFechaPickerOpen, historialVentaCliente, historialVentaOrden, ventasRealizadas, ventasHistorialFiltradas, historialVentaClientes, borradorVentaPendiente, pasoActual, clienteInvalido, modoInvalido, fechaVentaInvalida, precioTotalInvalido, sinInventario, parcialSinCantidad, parcialSinSeleccion,
    siguiente, anterior, confirmar, reiniciar, cargarLotes, seleccionarCliente, buscarCliente, validarClienteForm, guardarCliente, updateLote, confirmarAjusteParcial, setModoVenta, setFechaVenta, setPaso, setClienteSeleccionado, setClienteMetodo, setBusquedaCliente, setBusquedaAplicada, setLotesVenta, setPreciosVentaTotal, setMostrarModal, setMostrarModalClientes, setMostrarModalConfirmar, setClienteForm, setClienteFormErrors, setClienteFormError, setClienteEditando, setClienteDetalle, setMostrarModalBorradorVenta, setBorradorVentaPendiente, continuarBorradorVenta, empezarVentaNuevaDesdeBorrador, mostrarAlertaVentaParcial, getVentaParcialCardAlert, mostrarAlertaTarjetaVentaParcial, mostrarAlertaRevision, editarLoteDesdeRevision, eliminarLoteDesdeRevision, setVentaParcialOpenId, confirmarCancelarVenta, setBusquedaCafeVenta, setTipoCafeFiltroVenta, setCalidadFiltroVenta, setTipoCafeFiltroOpen, setCalidadFiltroOpen, setMostrarTodosCafeVenta, setVentaParcialAlert, setVentaParcialCardAlerts, setAjustesVentaParcialConfirmados, setVentaFifoBreakdown, setBusquedaClientesModal, setClientesSortMode, setClientesSortDropdownOpen, setClienteDocumentoDropdownOpen, setSubmitError, setRegistroErrorMensaje, setGuardandoVenta, setBotonConfirmarPresionado, setFechaVentaPickerOpen, setIntentoPaso1, setIntentoPaso2, setVentaGuardada, setCargando, setLoadError, setMostrarHistorialVentas, setHistorialVentaFecha, setHistorialVentaFechaPickerOpen, setHistorialVentaCliente, setHistorialVentaOrden, setMostrarHistorialLotesVenta, setVentasRealizadas, setMostrarDesgloseSublotesVenta, setMostrarModalCancelar, setNombreMaxToast, revisionDeleteAlert, setRevisionDeleteAlert,
  };
}
