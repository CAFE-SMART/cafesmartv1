import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Preferences } from '@capacitor/preferences';
import { listarClientes } from '../../../services/clientesService';
import { obtenerLotes, obtenerDetalleLote, guardarPesosSublotes, type LoteDetalle, type LoteResumen } from '../../../services/lotesService';
import { crearVenta, listarVentas } from '../../../services/ventasService';
import { obtenerConfiguracionBodega, type ConfiguracionBodega } from '../../../services/bodegaApi';
import {
  configurarLimitesEntradaCache,
  getLimitesEntradaSnapshot,
} from '../../../services/limitesEntradaService';
import { createOfflineDraft } from '../../../services/offlineDraftService';
import { getOfflineCache, saveOfflineCache } from '../../../services/offlineCacheService';
import { addSyncOperation } from '../../../services/syncQueueService';
import { obtenerDeviceId } from '../../../utils/deviceId';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { getTodayLocalDateValue, validateBusinessDateRange, toIsoDateAtUtcNoon } from '../../../utils/date';
import { VENTA_DRAFT_STORAGE_KEY, VENTA_FILTRO_TODOS } from '../constants';
import type { VentaGuardadaResumen, ClienteOption, ClienteForm, ClienteFormErrors, LoteVenta, ModoVenta, Step, VentaParcialCardAlert, VentaFifoItem } from '../types';
import { dedupeClientesOptions, distribuirPesoVerificado, esErrorGeneralGuardadoVenta, findClienteExistente, getDisponibleVenta, getPesoVerificado, getVentaSubmitMessage, isLoteVendible, isValidCantidadInput, isValidPrecioInput, kg, mapClienteToOption, mkLotes, money, norm, pesoVerificadoInvalido, round2, toNum, uid, soloDigitos } from '../utils';
import { ENABLE_SECADO_PROTOTYPE } from '../../../config/features';
import { applySecadoToLots, applySecadoToDetalle } from '../../../utils/secadoFlow';
import { getSubloteCodeMap } from '../../../utils/coffeeCodes';
import { sanitizeSearchInput } from '../../../utils/inputLimits';
import { fuzzySearch, useDebouncedValue } from '../../../utils/fuzzySearch';
import { sanitizeNameInput, sanitizeDocumentInput, formatPhoneNumber, normalizeCompanyName, normalizeHumanName, normalizeDocumentForStorage, validateCompanyName, validatePersonName, validateDocumentNumber, validatePhoneNumber } from '../../../utils/personValidation';
import { formatCoffeeFullName, getSubloteDisplayCode } from '../../../utils/coffeeCodes';

const INVENTORY_SUBLOTES_CACHE_KEY = 'inventory_sublotes';
const CATALOG_CLIENTES_CACHE_KEY = 'catalog_clientes';
const WAREHOUSE_CAPACITY_CACHE_KEY = 'warehouse_capacity';
const VENTAS_RECIENTES_CACHE_KEY = 'ventas_recent';

function detalleSublotesCacheKey(tipoCafeId: string, calidadId: string) {
  return `${INVENTORY_SUBLOTES_CACHE_KEY}:${tipoCafeId}:${calidadId}`;
}

function getSubloteOrigenVenta(sublote: {
  codigoOrigen?: string | null;
  procesoOrigen?: string | null;
}) {
  const originCode = sublote.codigoOrigen?.trim();
  return originCode && sublote.procesoOrigen === 'SECADO'
    ? `Origen: ${originCode}`
    : null;
}

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
  const { isOffline } = useNetworkStatus();
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
  const [bodegaConfig, setBodegaConfig] = React.useState<ConfiguracionBodega | null>(null);
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
      if (isOffline) {
        const [lotesCache, clientesCache, bodegaCache, ventasCache] = await Promise.all([
          getOfflineCache<LoteResumen[]>(INVENTORY_SUBLOTES_CACHE_KEY),
          getOfflineCache<Awaited<ReturnType<typeof listarClientes>>>(CATALOG_CLIENTES_CACHE_KEY),
          getOfflineCache<ConfiguracionBodega>(WAREHOUSE_CAPACITY_CACHE_KEY),
          getOfflineCache<Awaited<ReturnType<typeof listarVentas>>>(VENTAS_RECIENTES_CACHE_KEY),
        ]);

        if (!lotesCache?.length) {
          setLotesVenta([]);
          setClientes(clientesCache?.length ? dedupeClientesOptions(clientesCache.map(mapClienteToOption)) : []);
          setBodegaConfig(bodegaCache ?? null);
          setVentasRealizadas([]);
          setLoadError('No hay inventario guardado. Conéctate a internet una vez para cargar el inventario antes de vender sin conexión.');
          return;
        }

        if (!clientesCache?.length) {
          setLotesVenta(mkLotes(lotesCache));
          setClientes([]);
          setBodegaConfig(bodegaCache ?? null);
          setVentasRealizadas([]);
          setLoadError('No hay clientes guardados. Conéctate a internet una vez para cargar tus clientes antes de registrar ventas sin conexión.');
          return;
        }

        const lotesDisponibles = ENABLE_SECADO_PROTOTYPE
          ? applySecadoToLots(lotesCache, { includeGeneratedOutputs: false })
          : lotesCache;
        setLotesVenta(mkLotes(lotesDisponibles));
        setClientes(clientesCache?.length ? dedupeClientesOptions(clientesCache.map(mapClienteToOption)) : []);
        configurarLimitesEntradaCache(bodegaCache ?? null);
        setBodegaConfig(bodegaCache ?? null);
        if (ventasCache?.registros) {
          setVentasRealizadas(
            ventasCache.registros.map((venta) => ({
              referenciaId: venta.id,
              fecha: venta.fecha,
              clienteNombre: venta.clienteNombre,
              clienteDocumento: venta.clienteDocumento || 'Sin detalle',
              totalKg: venta.totalKg,
              totalVenta: venta.totalVenta,
              items: [],
            })),
          );
        }
        return;
      }

      const [lotesResult, clientesResult, bodegaResult, ventasResult] = await Promise.allSettled([
        obtenerLotes(),
        listarClientes(),
        obtenerConfiguracionBodega(),
        listarVentas({ limit: 50 }),
      ]);
      if (lotesResult.status === 'rejected') throw lotesResult.reason;
      if (clientesResult.status === 'rejected') setClientes([]);
      if (bodegaResult.status === 'fulfilled') {
        configurarLimitesEntradaCache(bodegaResult.value);
        setBodegaConfig(bodegaResult.value);
      }
      const lotes = lotesResult.value;
      const clientesData = clientesResult.status === 'fulfilled' ? clientesResult.value : [];
      const lotesDisponibles = ENABLE_SECADO_PROTOTYPE ? applySecadoToLots(lotes, { includeGeneratedOutputs: false }) : lotes;
      const lotesVendibles = lotesDisponibles.filter(isLoteVendible);
      setLotesVenta(mkLotes(lotesVendibles));
      setClientes(dedupeClientesOptions(clientesData.map(mapClienteToOption)));
      void saveOfflineCache(INVENTORY_SUBLOTES_CACHE_KEY, lotesVendibles);
      void saveOfflineCache(CATALOG_CLIENTES_CACHE_KEY, clientesData);
      if (bodegaResult.status === 'fulfilled') {
        void saveOfflineCache(WAREHOUSE_CAPACITY_CACHE_KEY, bodegaResult.value);
      }
      if (ventasResult.status === 'fulfilled') {
        void saveOfflineCache(VENTAS_RECIENTES_CACHE_KEY, ventasResult.value);
        setVentasRealizadas(
          ventasResult.value.registros.map((venta) => ({
            referenciaId: venta.id,
            fecha: venta.fecha,
            clienteNombre: venta.clienteNombre,
            clienteDocumento: venta.clienteDocumento || 'Sin detalle',
            totalKg: venta.totalKg,
            totalVenta: venta.totalVenta,
            items: [],
            fifoBreakdown: (venta.detallesSublotes?.length
              ? venta.detallesSublotes.map((detalle, index) => ({
                  groupId: venta.id,
                  subloteId: detalle.subloteId,
                  subloteCodigo: detalle.codigoSublote,
                  subloteNombre: detalle.codigoSublote,
                  tipoCafe: detalle.tipoCafe ?? '',
                  calidad: detalle.calidad ?? '',
                  nombreCafe: [detalle.tipoCafe, detalle.calidad].filter(Boolean).join(' '),
                  fifoPosition: index + 1,
                  pesoAsignado: detalle.kilosVendidos,
                  pesoRestante: detalle.inventarioRestante,
                  fechaEntrada: detalle.fechaIngreso,
                  costoBase: detalle.precioCompraKg,
                }))
              : venta.detalles.map((detalle, index) => ({
                  groupId: venta.id,
                  subloteId: detalle.subloteId ?? `${venta.id}-${index}`,
                  subloteCodigo: detalle.subloteCodigo ?? `SUB-${String(index + 1).padStart(2, '0')}`,
                  subloteNombre: detalle.subloteCodigo ?? `SUB-${String(index + 1).padStart(2, '0')}`,
                  tipoCafe: detalle.tipoCafe ?? '',
                  calidad: detalle.calidad ?? '',
                  nombreCafe: [detalle.tipoCafe, detalle.calidad].filter(Boolean).join(' '),
                  fifoPosition: detalle.ventaNumero ?? index + 1,
                  pesoAsignado: detalle.pesoVendido,
                  pesoRestante:
                    detalle.pesoRestante ??
                    detalle.peso_restante ??
                    detalle.sublote?.pesoDisponible ??
                    detalle.sublote?.peso_disponible ??
                    0,
                  fechaEntrada:
                    detalle.fechaIngreso ??
                    detalle.fecha_ingreso ??
                    detalle.sublote?.fechaIngreso ??
                    detalle.sublote?.fecha_ingreso ??
                    venta.fecha,
                  costoBase:
                    detalle.precioCompra ??
                    detalle.precio_compra ??
                    detalle.sublote?.precioCompra ??
                    detalle.sublote?.precio_compra ??
                    null,
                }))),
          })),
        );
      }
      void Promise.allSettled(
        lotesVendibles.map((lote) =>
          obtenerDetalleLote(lote.tipoCafeId, lote.calidadId).then((detalle) =>
            saveOfflineCache(
              detalleSublotesCacheKey(lote.tipoCafeId, lote.calidadId),
              detalle,
            ),
          ),
        ),
      );
    } catch (e) {
      setLoadError(
        isOffline
          ? 'No hay inventario guardado. Conéctate a internet una vez para cargar el inventario antes de vender sin conexión.'
          : e instanceof Error
            ? e.message
            : 'No fue posible cargar el inventario para venta.',
      );
    } finally {
      setCargando(false);
    }
  }, [isOffline]);

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

  const busquedaAplicadaDebounced = useDebouncedValue(busquedaAplicada);
  const busquedaCafeVentaDebounced = useDebouncedValue(busquedaCafeVenta);
  const busquedaClientesModalDebounced = useDebouncedValue(busquedaClientesModal);

  const clientesSearchResult = React.useMemo(() => {
    const base = dedupeClientesOptions([...clientes]);
    return fuzzySearch(base, busquedaAplicadaDebounced, (c) => [
      c.nombre,
      c.documento,
      c.detalle,
      c.telefono ?? '',
    ]);
  }, [busquedaAplicadaDebounced, clientes]);
  const clientesRecientes = clientesSearchResult.items;
  const clientesRecientesUsaSimilares = clientesSearchResult.isSimilar;

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

  const ajustesParcialesPendientes =
    modoVenta === 'PARCIAL'
      ? lotesVenta.filter(
          (lote) =>
            !ajustesVentaParcialConfirmados[lote.id] &&
            toNum(lote.cantidadKg) > 0,
        )
      : [];

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
        const limitesVenta = getLimitesEntradaSnapshot();
        if (!precio.trim()) return 'Ingresa el precio por kilo.';
        if (toNum(precio) > limitesVenta.maxPrecioVentaKg) return 'El precio supera el máximo permitido.';
        if (toNum(precio) < limitesVenta.minPrecioVentaKg) return 'El precio está por debajo del mínimo permitido.';
        return 'Ingresa solo números válidos.';
      }
      return null;
    }
    if (modoVenta === 'PARCIAL' && ajustesParcialesPendientes.length > 0) return 'Todavía hay cafés sin confirmar.';
    if (modoVenta === 'PARCIAL' && !lotesConCantidad.length) return 'Ingresa al menos una cantidad para continuar.';
    for (const l of lotesConCantidad) {
      if (pesoVerificadoInvalido(l)) return `El peso verificado no puede superar el disponible en ${l.codigo}.`;
      const disponible = getDisponibleVenta(l);
      if (l.cantidad > disponible) return `Cantidad máxima permitida: ${kg(disponible)}.`;
      if (!isValidCantidadInput(String(l.cantidad), disponible)) return `La cantidad ingresada no es válida en ${l.codigo}.`;
      const limitesVenta = getLimitesEntradaSnapshot();
      if (l.precio < limitesVenta.minPrecioVentaKg) return `Ingresa un precio por kg válido en ${l.codigo}.`;
      if (l.precio > limitesVenta.maxPrecioVentaKg) return `El precio supera el máximo permitido en ${l.codigo}.`;
    }
    return null;
  }, [ajustesParcialesPendientes.length, fechaVentaValidacion.isValid, fechaVentaValidacion.message, lotesVenta.length, modoVenta, preciosVentaTotalInvalidos, resumenDisponiblePorTipo, lotesConCantidad]);

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
      : hayCantidadParcial && !parcialConErrores && ajustesParcialesPendientes.length === 0;

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
    const codeMap = getSubloteCodeMap(lotesVenta);
    const resultado = fuzzySearch(lotesVenta, busquedaCafeVentaDebounced, (lote) => [
      lote.tipoCafe,
      lote.calidad,
      lote.codigo,
      codeMap.get(lote.id) ?? '',
      `${lote.tipoCafe} ${lote.calidad}`,
      `${lote.tipoCafe} ${lote.calidad} ${lote.codigo} ${codeMap.get(lote.id) ?? ''}`,
    ]);
    return resultado.items.filter((lote) => {
      const coincideTipo = tipoCafeFiltroVenta === VENTA_FILTRO_TODOS || norm(lote.tipoCafe) === norm(tipoCafeFiltroVenta);
      const coincideCalidad = calidadFiltroVenta === VENTA_FILTRO_TODOS || norm(lote.calidad) === norm(calidadFiltroVenta);
      return coincideTipo && coincideCalidad;
    });
  }, [busquedaCafeVentaDebounced, calidadFiltroVenta, lotesVenta, tipoCafeFiltroVenta]);
  const lotesVentaParcialUsaSimilares = React.useMemo(
    () => {
      const codeMap = getSubloteCodeMap(lotesVenta);
      return fuzzySearch(lotesVenta, busquedaCafeVentaDebounced, (lote) => [
        lote.tipoCafe,
        lote.calidad,
        lote.codigo,
        codeMap.get(lote.id) ?? '',
        `${lote.tipoCafe} ${lote.calidad}`,
        `${lote.tipoCafe} ${lote.calidad} ${lote.codigo} ${codeMap.get(lote.id) ?? ''}`,
      ]).isSimilar;
    },
    [busquedaCafeVentaDebounced, lotesVenta],
  );

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
      if (clienteMetodo === 'REGISTRAR' && !clienteSeleccionado) {
        setSubmitError('Guarda el cliente para continuar.');
        setClienteFormError(null);
        return;
      }
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
        if (ajustesParcialesPendientes.length > 0) {
          setVentaParcialCardAlerts(
            ajustesParcialesPendientes.reduce<Record<string, VentaParcialCardAlert>>(
              (alerts, lote) => {
                alerts[lote.id] = {
                  title: 'Todavía hay cafés sin confirmar.',
                  detail: 'Confirma este ajuste o cancélalo antes de continuar.',
                };
                return alerts;
              },
              {},
            ),
          );
        }
        setSubmitError(
          mensajeValidacion ??
            (ajustesParcialesPendientes.length > 0
              ? 'Todavía hay cafés sin confirmar.'
              : 'Revisa los campos obligatorios antes de continuar.'),
        );
        return;
      }
      setVentaParcialCardAlerts({});
      setSubmitError(null);
      return setPaso(3);
    }
  }, [ajustesParcialesPendientes, clienteMetodo, clienteSeleccionado, paso, puedeAvanzarPaso2, validarPasoVenta, validandoPasoVenta]);

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
      const limitesVenta = getLimitesEntradaSnapshot();
      if (precio > limitesVenta.maxPrecioVentaKg) return { title: 'El precio supera el máximo permitido.', detail: `Usa un valor hasta ${money(limitesVenta.maxPrecioVentaKg)} por kg.` };
      if (!isValidPrecioInput(precioTexto)) return { title: `Precio inválido en ${nombreCafe}.`, detail: 'Ingresa un precio válido por kilogramo.' };
      if (precio < limitesVenta.minPrecioVentaKg) return { title: `El precio de ${nombreCafe} es demasiado bajo.`, detail: `Ingresa un valor desde ${money(limitesVenta.minPrecioVentaKg)} por kg.` };
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

  const cargarDetalleVenta = React.useCallback(
    async (tipoCafeId: string, calidadId: string) => {
      const cacheKey = detalleSublotesCacheKey(tipoCafeId, calidadId);

      if (isOffline) {
        const cached = await getOfflineCache<LoteDetalle>(cacheKey);
        if (!cached) {
          throw new Error(
            'No hay inventario guardado. Conéctate a internet una vez para cargar el inventario antes de vender sin conexión.',
          );
        }
        return cached;
      }

      const detalle = await obtenerDetalleLote(tipoCafeId, calidadId);
      void saveOfflineCache(cacheKey, detalle);
      return detalle;
    },
    [isOffline],
  );

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
      if (isOffline) {
        const detalles = [] as Array<{ subloteId: string; pesoVendido: number; precioKg: number }>;
        const desgloseFIFO: VentaFifoItem[] = [];
        const pools = new Map<
          string,
          Array<{
            subloteId: string;
            subloteCodigo: string;
            subloteNombre: string;
            tipoCafe: string;
            calidad: string;
            nombreCafe: string;
            origenSublote?: string | null;
            fifoPosition: number;
            fechaEntrada: string;
            costoBase: number | null;
            disponibleKg: number;
          }>
        >();

        for (const lote of lotesConCantidad) {
          const poolKey = `${lote.tipoCafeId}::${lote.calidadId}`;
          if (!pools.has(poolKey)) {
            const detalleBase = await cargarDetalleVenta(lote.tipoCafeId, lote.calidadId);
            const detalle = ENABLE_SECADO_PROTOTYPE
              ? applySecadoToDetalle(detalleBase, lote.tipoCafeId, lote.calidadId, {
                  includeGeneratedOutputs: false,
                })
              : detalleBase;
            let pool = [...(detalle?.sublotes ?? [])]
              .filter((sublote) => sublote.pesoActual > 0)
              .sort((a, b) => new Date(a.fechaIngreso).getTime() - new Date(b.fechaIngreso).getTime())
              .map((sublote, index) => ({
                subloteId: sublote.id,
                subloteCodigo: getSubloteDisplayCode(sublote, index),
                subloteNombre: sublote.etiqueta || getSubloteDisplayCode(sublote, index),
                tipoCafe: sublote.tipoCafe,
                calidad: sublote.calidad,
                nombreCafe: formatCoffeeFullName(sublote),
                origenSublote: getSubloteOrigenVenta(sublote),
                fifoPosition: index + 1,
                fechaEntrada: sublote.fechaIngreso,
                costoBase: Number.isFinite(sublote.costoPorKg) ? sublote.costoPorKg : null,
                disponibleKg: round2(sublote.pesoActual),
              }));
            const pesoVerificado = getPesoVerificado(lote);
            const totalPool = round2(pool.reduce((sum, item) => sum + item.disponibleKg, 0));
            if (pesoVerificado !== null && pesoVerificado < totalPool) {
              pool = distribuirPesoVerificado(pool, pesoVerificado);
            }
            pools.set(poolKey, pool);
          }

          const pool = pools.get(poolKey) ?? [];
          let restante = round2(lote.cantidad);
          for (const entry of pool) {
            if (restante <= 0) break;
            if (entry.disponibleKg <= 0) continue;
            const asignado = round2(Math.min(restante, entry.disponibleKg));
            if (asignado <= 0) continue;
            detalles.push({
              subloteId: entry.subloteId,
              pesoVendido: asignado,
              precioKg: round2(lote.precio),
            });
            entry.disponibleKg = round2(entry.disponibleKg - asignado);
            desgloseFIFO.push({
              groupId: lote.id,
              subloteId: entry.subloteId,
              subloteCodigo: entry.subloteCodigo,
              subloteNombre: entry.subloteNombre,
              tipoCafe: entry.tipoCafe,
              calidad: entry.calidad,
              nombreCafe: entry.nombreCafe,
              origenSublote: entry.origenSublote,
              fifoPosition: entry.fifoPosition,
              pesoAsignado: asignado,
              pesoRestante: entry.disponibleKg,
              fechaEntrada: entry.fechaEntrada,
              costoBase: entry.costoBase,
            });
            restante = round2(restante - asignado);
          }
          if (restante > 0.001) throw new Error(`La cantidad supera el disponible en ${lote.codigo}.`);
        }

        const fechaVentaIso = toIsoDateAtUtcNoon(fechaVenta);
        const deviceId = await obtenerDeviceId();
        const payload = {
          ...(fechaVentaIso ? { fecha: fechaVentaIso } : {}),
          ...(clienteSeleccionado.rapido
            ? {
                clienteId: null,
                clienteRapido: true,
                clienteNombre: clienteSeleccionado.nombre || 'Cliente General',
              }
            : { clienteId: clienteSeleccionado.id, clienteRapido: false }),
          deviceId,
          localId: ventaLocalIdRef.current,
          totalKg,
          totalEstimado,
          detalles,
        };

        addSyncOperation({
          idLocal: ventaLocalIdRef.current,
          clientMutationId: ventaLocalIdRef.current,
          deviceId,
          modulo: 'VENTA',
          endpoint: '/ventas',
          method: 'POST',
          payload,
        });
        await createOfflineDraft('VENTA', {
          localId: ventaLocalIdRef.current,
          createdAt: new Date().toISOString(),
          syncStatus: 'PENDIENTE',
          payload,
          formState: {
            paso,
            clienteMetodo,
            clienteSeleccionado,
            fechaVenta,
            modoVenta,
            lotesVenta,
            preciosVentaTotal,
            ajustesVentaParcialConfirmados,
          },
          resumen: {
            totalKg,
            totalEstimado,
          },
        });
        setVentaFifoBreakdown(desgloseFIFO);
        setMostrarModalConfirmar(false);
        setVentaGuardada({
          referenciaId: ventaLocalIdRef.current,
          pendienteOffline: true,
          fecha: fechaVentaIso ?? new Date().toISOString(),
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
          fifoBreakdown: desgloseFIFO,
        });
        await clearVentaDraft();
        return;
      }

      const detalles = [] as Array<{ subloteId: string; pesoVendido: number; precioKg: number }>;
      const desgloseFIFO: VentaFifoItem[] = [];
      type PoolEntry = {
        subloteId: string;
        subloteCodigo: string;
        subloteNombre: string;
        tipoCafe: string;
        calidad: string;
        nombreCafe: string;
        origenSublote?: string | null;
        fifoPosition: number;
        fechaEntrada: string;
        costoBase: number | null;
        disponibleKg: number;
      };
      const pools = new Map<string, PoolEntry[]>();

      for (const lote of lotesConCantidad) {
        const poolKey = `${lote.tipoCafeId}::${lote.calidadId}`;
        if (!pools.has(poolKey)) {
          const detalleBase = await cargarDetalleVenta(lote.tipoCafeId, lote.calidadId);
          const detalle = ENABLE_SECADO_PROTOTYPE ? applySecadoToDetalle(detalleBase, lote.tipoCafeId, lote.calidadId, { includeGeneratedOutputs: false }) : detalleBase;
          let pool = [...(detalle?.sublotes ?? [])]
            .filter((sublote) => sublote.pesoActual > 0)
            .sort((a, b) => new Date(a.fechaIngreso).getTime() - new Date(b.fechaIngreso).getTime())
            .map((sublote, index) => ({
              subloteId: sublote.id,
              subloteCodigo: getSubloteDisplayCode(sublote, index),
              subloteNombre: sublote.etiqueta || getSubloteDisplayCode(sublote, index),
              tipoCafe: sublote.tipoCafe,
              calidad: sublote.calidad,
              nombreCafe: formatCoffeeFullName(sublote),
              origenSublote: getSubloteOrigenVenta(sublote),
              fifoPosition: index + 1,
              fechaEntrada: sublote.fechaIngreso,
              costoBase: Number.isFinite(sublote.costoPorKg) ? sublote.costoPorKg : null,
              disponibleKg: round2(sublote.pesoActual),
            }));
          const pesoVerificado = getPesoVerificado(lote);
          const totalPool = round2(pool.reduce((sum, item) => sum + item.disponibleKg, 0));
          if (pesoVerificado !== null && pesoVerificado < totalPool) {
            const poolAjustado = distribuirPesoVerificado(pool, pesoVerificado);
            await guardarPesosSublotes(
              poolAjustado.map((entry) => ({
                id: entry.subloteId,
                pesoActual: entry.disponibleKg,
                motivo: 'Calibración antes de venta',
              })),
            );
            pool = poolAjustado;
          }
          pools.set(poolKey, pool);
        }
        const pool = pools.get(poolKey) ?? [];
        let restante = round2(lote.cantidad);
        for (const entry of pool) {
          if (restante <= 0) break;
          if (entry.disponibleKg <= 0) continue;
          const asignado = round2(Math.min(restante, entry.disponibleKg));
          if (asignado <= 0) continue;
          detalles.push({ subloteId: entry.subloteId, pesoVendido: asignado, precioKg: round2(lote.precio) });
          entry.disponibleKg = round2(entry.disponibleKg - asignado);
          desgloseFIFO.push({
            groupId: lote.id,
            subloteId: entry.subloteId,
            subloteCodigo: entry.subloteCodigo,
            subloteNombre: entry.subloteNombre,
            tipoCafe: entry.tipoCafe,
            calidad: entry.calidad,
            nombreCafe: entry.nombreCafe,
            origenSublote: entry.origenSublote,
            fifoPosition: entry.fifoPosition,
            pesoAsignado: asignado,
            pesoRestante: entry.disponibleKg,
            fechaEntrada: entry.fechaEntrada,
            costoBase: entry.costoBase,
          });
          restante = round2(restante - asignado);
        }
        if (restante > 0.001) throw new Error(`La cantidad supera el disponible en ${lote.codigo}.`);
      }
      const detalleInvalido = detalles.find((detalle) => {
        return (
          !detalle.subloteId ||
          !Number.isFinite(detalle.pesoVendido) ||
          detalle.pesoVendido <= 0 ||
          !Number.isFinite(detalle.precioKg) ||
          detalle.precioKg <= 0
        );
      });

      if (detalleInvalido) {
        console.info(
          '[CafeSmart][ventas-submit] payload invalido',
          JSON.stringify({
            subloteId: detalleInvalido.subloteId || null,
            pesoVendido: detalleInvalido.pesoVendido,
            precioKg: detalleInvalido.precioKg,
          }),
        );
        throw new Error(
          !detalleInvalido.subloteId
            ? 'El sublote seleccionado no esta disponible para la venta.'
            : 'Revisa cantidad y precio antes de registrar la venta.',
        );
      }

      setVentaFifoBreakdown(desgloseFIFO);
      const fechaVentaIso = toIsoDateAtUtcNoon(fechaVenta);
      const payloadVenta = {
        ...(fechaVentaIso ? { fecha: fechaVentaIso } : {}),
        ...(clienteSeleccionado.rapido
          ? {
              clienteId: null,
              clienteRapido: true,
              clienteNombre: clienteSeleccionado.nombre || 'Cliente General',
            }
          : { clienteId: clienteSeleccionado.id, clienteRapido: false }),
        deviceId: await obtenerDeviceId(),
        localId: ventaLocalIdRef.current,
        totalKg,
        totalEstimado,
        detalles,
      };

      console.info(
        '[CafeSmart][ventas-submit] payload listo',
        JSON.stringify({
          fecha: payloadVenta.fecha ?? null,
          clienteId: payloadVenta.clienteId ?? null,
          clienteRapido: Boolean(clienteSeleccionado.rapido),
          detallesCount: detalles.length,
          totalKg,
          totalEstimado,
          detalleIds: detalles.map((detalle) => detalle.subloteId),
        }),
      );

      const respuesta = await crearVenta(payloadVenta);
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
        fifoBreakdown: desgloseFIFO,
      };
      setVentaGuardada(ventaResumen);
      setVentasRealizadas((actual) => [ventaResumen, ...actual]);
      await clearVentaDraft();
      await cargarLotes();
    } catch (error) {
      const mensaje = getVentaSubmitMessage(error);
      console.info(
        '[CafeSmart][ventas-submit] error capturado',
        JSON.stringify({
          name: error instanceof Error ? error.name : typeof error,
          message: error instanceof Error ? error.message : String(error),
          status:
            typeof error === 'object' && error && 'status' in error
              ? (error as { status?: number }).status
              : null,
          code:
            typeof error === 'object' && error && 'code' in error
              ? (error as { code?: string | null }).code
              : null,
          field:
            typeof error === 'object' && error && 'field' in error
              ? (error as { field?: string | null }).field
              : null,
        }),
      );
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
  }, [
    ajustesVentaParcialConfirmados,
    cargarDetalleVenta,
    cargarLotes,
    clienteMetodo,
    clienteSeleccionado,
    fechaVenta,
    guardandoVenta,
    isOffline,
    lotesConCantidad,
    lotesVenta,
    modoVenta,
    paso,
    preciosVentaTotal,
    totalEstimado,
    totalKg,
    validarPasoVenta,
  ]);

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
          const limitesVenta = getLimitesEntradaSnapshot();

          if (nextValue && precio > limitesVenta.maxPrecioVentaKg) {
            setVentaParcialCardAlerts((current) => ({
              ...current,
              [id]: {
                title: 'El precio ingresado supera el máximo permitido.',
                detail: `Usa un valor hasta ${money(limitesVenta.maxPrecioVentaKg)} por kg.`,
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
      setVentaParcialAlert(null);
      setSubmitError(null);
      setIntentoPaso2(false);
      setVentaParcialOpenId(null);
    },
    [getVentaParcialCardAlert, mostrarAlertaTarjetaVentaParcial],
  );

  const cancelarAjusteParcial = React.useCallback((loteId: string) => {
    const ajusteYaConfirmado = Boolean(ajustesVentaParcialConfirmados[loteId]);
    setVentaParcialCardAlerts((current) => {
      if (!current[loteId]) return current;
      const next = { ...current };
      delete next[loteId];
      return next;
    });
    if (!ajusteYaConfirmado) {
      setAjustesVentaParcialConfirmados((current) => {
        if (!current[loteId]) return current;
        const next = { ...current };
        delete next[loteId];
        return next;
      });
      setLotesVenta((current) =>
        current.map((lote) =>
          lote.id === loteId
            ? {
                ...lote,
                cantidadKg: '',
              }
            : lote,
        ),
      );
    }
    setVentaParcialAlert(null);
    setSubmitError(null);
    setIntentoPaso2(false);
    setVentaParcialOpenId(null);
  }, [ajustesVentaParcialConfirmados]);

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
    const telefono = validatePhoneNumber(clienteForm.telefono, 'El teléfono', { optional: true });
    if (!telefono.isValid) errores.telefono = telefono.message;
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
    const telefono = clienteForm.telefono.trim();
    const tipoDocumento = clienteForm.tipoDocumento || undefined;
    const documento = tipoDocumento ? normalizeDocumentForStorage(clienteForm.documento, tipoDocumento as any) : '';
    const errores = validarClienteForm();
    setClienteFormErrors(errores);
    setClienteFormError(null);
    if (Object.keys(errores).length > 0) return;
    const clienteExistente = findClienteExistente(clientes, nombre, documento, clienteEditando?.id);
    if (clienteExistente) {
      setClienteFormErrors((actual) => ({ ...actual, documento: 'Este cliente ya está registrado con este documento.' }));
      setClienteFormError('Este cliente ya está registrado con este documento.');
      return;
    }
    try {
      if (clienteEditando) {
        setClienteSeleccionado({ id: clienteEditando.id, nombre, documento, detalle: clienteEditando.detalle, telefono, tipoDocumento: tipoDocumento as any });
      } else {
        setClienteSeleccionado({ id: uid(), nombre, documento, detalle: 'Cliente registrado', telefono, tipoDocumento: tipoDocumento as any });
      }
      setClienteMetodo('REGISTRAR');
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

  const clienteInvalido = paso === 1 && intentoPaso1 && !clienteSeleccionado && !submitError;
  const modoInvalido = paso === 2 && intentoPaso2 && !modoVenta;
  const fechaVentaInvalida = paso === 2 && intentoPaso2 && !fechaVentaValidacion.isValid;
  const precioTotalInvalido = paso === 2 && modoVenta === 'TOTAL' && intentoPaso2 && preciosVentaTotalInvalidos.size > 0;
  const sinInventario = paso === 2 && lotesVenta.length === 0;
  const parcialSinCantidad = paso === 2 && modoVenta === 'PARCIAL' && !hayCantidadParcial;
  const parcialSinSeleccion = parcialSinCantidad && intentoPaso2;

  React.useEffect(() => {
    if (!modoVenta) return;
    setIntentoPaso2(false);
    setSubmitError((current) =>
      current === 'Selecciona como deseas realizar la venta.' ? null : current,
    );
  }, [modoVenta]);

  React.useEffect(() => {
    if (!modoInvalido) return undefined;

    const timer = window.setTimeout(() => {
      setIntentoPaso2(false);
      setSubmitError((current) =>
        current === 'Selecciona como deseas realizar la venta.' ? null : current,
      );
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [modoInvalido]);

  const confirmarCancelarVenta = () => {
    setMostrarModalCancelar(false);
    reiniciar();
  };

  React.useEffect(() => {
    if (paso !== 3 || !modoVenta || lotesConCantidad.length === 0) {
      setVentaFifoBreakdown([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const breakdown: VentaFifoItem[] = [];
      for (const lote of lotesConCantidad) {
        const detalleBase = await cargarDetalleVenta(lote.tipoCafeId, lote.calidadId);
        const detalle = ENABLE_SECADO_PROTOTYPE ? applySecadoToDetalle(detalleBase, lote.tipoCafeId, lote.calidadId, { includeGeneratedOutputs: false }) : detalleBase;
        let restante = round2(lote.cantidad);
        const sublotesOrdenados = [...(detalle?.sublotes ?? [])]
          .filter((sublote) => sublote.pesoActual > 0)
          .sort((a, b) => new Date(a.fechaIngreso).getTime() - new Date(b.fechaIngreso).getTime());
        let pool = sublotesOrdenados.map((sublote, index) => ({
          subloteId: sublote.id,
          sublote,
          fifoPosition: index + 1,
          disponibleKg: round2(sublote.pesoActual),
        }));
        const pesoVerificado = getPesoVerificado(lote);
        const totalPool = round2(pool.reduce((sum, item) => sum + item.disponibleKg, 0));
        if (pesoVerificado !== null && pesoVerificado < totalPool) {
          pool = distribuirPesoVerificado(pool, pesoVerificado);
        }
        pool.forEach((entry) => {
          if (restante <= 0) return;
          const asignado = round2(Math.min(restante, entry.disponibleKg));
          if (asignado <= 0) return;
          breakdown.push({
            groupId: lote.id,
            subloteId: entry.sublote.id,
            subloteCodigo: getSubloteDisplayCode(entry.sublote, entry.fifoPosition - 1),
            subloteNombre: entry.sublote.etiqueta || getSubloteDisplayCode(entry.sublote, entry.fifoPosition - 1),
            tipoCafe: entry.sublote.tipoCafe,
            calidad: entry.sublote.calidad,
            nombreCafe: formatCoffeeFullName(entry.sublote),
            origenSublote: getSubloteOrigenVenta(entry.sublote),
            fifoPosition: entry.fifoPosition,
            pesoAsignado: asignado,
            pesoRestante: round2(entry.disponibleKg - asignado),
            fechaEntrada: entry.sublote.fechaIngreso,
            costoBase: Number.isFinite(entry.sublote.costoPorKg) ? entry.sublote.costoPorKg : null,
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
  }, [cargarDetalleVenta, lotesConCantidad, modoVenta, paso]);

  return {
    isOffline, cargando, loadError, guardandoVenta, validandoPasoVenta, submitError, registroErrorMensaje, ventaGuardada, paso, botonConfirmarPresionado, intentoPaso1, intentoPaso2,
    clienteMetodo, clienteSeleccionado, busquedaCliente, busquedaAplicada, clientes, clientesRecientes, clientesRecientesUsaSimilares, clienteForm, clienteFormErrors, clienteFormError, clienteEditando, clienteDetalle, sinClientesRegistrados, clientesSearchRef, busquedaClientesModal, busquedaClientesModalDebounced, clientesSortMode, clientesSortDropdownOpen, clienteDocumentoDropdownOpen, nombreMaxToast,
    mostrarModal, mostrarModalClientes, mostrarModalConfirmar, mostrarModalCancelar, mostrarModalBorradorVenta, mostrarHistorialLotesVenta, mostrarDesgloseSublotesVenta, mostrarHistorialVentas,
    modoVenta, fechaVenta, fechaVentaPickerOpen, fechaVentaValidacion, lotesVenta, bodegaConfig, lotesConCantidad, totalKg, totalEstimado, totalDisponibleVenta, busquedaCafeVenta, tipoCafeFiltroVenta, calidadFiltroVenta, tipoCafeFiltroOpen, calidadFiltroOpen, mostrarTodosCafeVenta, tipoCafeFiltroOpciones, calidadFiltroOpciones, lotesVentaParcialFiltrados, lotesVentaParcialVisibles, lotesVentaParcialUsaSimilares, preciosVentaTotal, preciosVentaTotalInvalidos, resumenDisponiblePorTipo, ventaParcialOpenId, ventaParcialAlert, ventaParcialCardAlerts, ajustesVentaParcialConfirmados, hayCantidadParcial, puedeAvanzarPaso2, ventaFifoBreakdown, historialVentaFecha, historialVentaFechaPickerOpen, historialVentaCliente, historialVentaOrden, ventasRealizadas, ventasHistorialFiltradas, historialVentaClientes, borradorVentaPendiente, pasoActual, clienteInvalido, modoInvalido, fechaVentaInvalida, precioTotalInvalido, sinInventario, parcialSinCantidad, parcialSinSeleccion,
    siguiente, anterior, confirmar, reiniciar, cargarLotes, seleccionarCliente, buscarCliente, validarClienteForm, guardarCliente, updateLote, confirmarAjusteParcial, cancelarAjusteParcial, setModoVenta, setFechaVenta, setPaso, setClienteSeleccionado, setClienteMetodo, setBusquedaCliente, setBusquedaAplicada, setLotesVenta, setPreciosVentaTotal, setMostrarModal, setMostrarModalClientes, setMostrarModalConfirmar, setClienteForm, setClienteFormErrors, setClienteFormError, setClienteEditando, setClienteDetalle, setMostrarModalBorradorVenta, setBorradorVentaPendiente, continuarBorradorVenta, empezarVentaNuevaDesdeBorrador, mostrarAlertaVentaParcial, getVentaParcialCardAlert, mostrarAlertaTarjetaVentaParcial, mostrarAlertaRevision, editarLoteDesdeRevision, eliminarLoteDesdeRevision, setVentaParcialOpenId, confirmarCancelarVenta, setBusquedaCafeVenta, setTipoCafeFiltroVenta, setCalidadFiltroVenta, setTipoCafeFiltroOpen, setCalidadFiltroOpen, setMostrarTodosCafeVenta, setVentaParcialAlert, setVentaParcialCardAlerts, setAjustesVentaParcialConfirmados, setVentaFifoBreakdown, setBusquedaClientesModal, setClientesSortMode, setClientesSortDropdownOpen, setClienteDocumentoDropdownOpen, setSubmitError, setRegistroErrorMensaje, setGuardandoVenta, setBotonConfirmarPresionado, setFechaVentaPickerOpen, setIntentoPaso1, setIntentoPaso2, setVentaGuardada, setCargando, setLoadError, setMostrarHistorialVentas, setHistorialVentaFecha, setHistorialVentaFechaPickerOpen, setHistorialVentaCliente, setHistorialVentaOrden, setMostrarHistorialLotesVenta, setVentasRealizadas, setMostrarDesgloseSublotesVenta, setMostrarModalCancelar, setNombreMaxToast, revisionDeleteAlert, setRevisionDeleteAlert,
  };
}
