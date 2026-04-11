import React from 'react';
import { ArrowLeft, ArrowRight, Banknote, CheckCircle2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppBottomNav } from '../components/AppBottomNav';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { LoteResumen, obtenerLotes } from '../services/lotesService';

type ModoVenta = 'PARCIAL' | 'TOTAL';

type LoteVenta = {
  id: string;
  codigo: string;
  tipoCafe: string;
  calidad: string;
  disponibleKg: number;
  cantidadKg: string;
  precioKg: string;
};

function formatearKg(valor: number) {
  return `${valor.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`;
}

function formatearMoneda(valor: number) {
  return `$${valor.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

function normalizarNumero(valor: string) {
  const numero = Number(valor.replace(',', '.'));
  return Number.isFinite(numero) ? numero : 0;
}

function crearLotesVenta(lotes: LoteResumen[]): LoteVenta[] {
  return lotes
    .filter((lote) => lote.pesoActual > 0)
    .map((lote) => ({
      id: lote.id,
      codigo: lote.codigo,
      tipoCafe: lote.tipoCafe,
      calidad: lote.calidad,
      disponibleKg: lote.pesoActual,
      cantidadKg: '',
      precioKg: String(Math.round(lote.precioPromedioKg || 0)),
    }));
}

export default function Ventas() {
  const navigate = useNavigate();
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [modoVenta, setModoVenta] = React.useState<ModoVenta>('PARCIAL');
  const [paso, setPaso] = React.useState<1 | 2 | 3>(1);
  const [cliente, setCliente] = React.useState('Cliente general');
  const [precioGlobal, setPrecioGlobal] = React.useState('');
  const [lotesVenta, setLotesVenta] = React.useState<LoteVenta[]>([]);

  const cargarLotes = React.useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const lotes = await obtenerLotes();
      setLotesVenta(crearLotesVenta(lotes));
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'No fue posible cargar el inventario para venta.';
      setError(mensaje);
    } finally {
      setCargando(false);
    }
  }, []);

  React.useEffect(() => {
    void cargarLotes();
  }, [cargarLotes]);

  const lotesConCantidad = React.useMemo(() => {
    if (modoVenta === 'TOTAL') {
      return lotesVenta.filter((lote) => lote.disponibleKg > 0).map((lote) => ({
        ...lote,
        cantidad: lote.disponibleKg,
        precio: normalizarNumero(precioGlobal),
      }));
    }

    return lotesVenta
      .map((lote) => ({
        ...lote,
        cantidad: normalizarNumero(lote.cantidadKg),
        precio: normalizarNumero(lote.precioKg),
      }))
      .filter((lote) => lote.cantidad > 0);
  }, [lotesVenta, modoVenta, precioGlobal]);

  const totalKg = React.useMemo(
    () => lotesConCantidad.reduce((acc, lote) => acc + lote.cantidad, 0),
    [lotesConCantidad],
  );

  const totalEstimado = React.useMemo(
    () => lotesConCantidad.reduce((acc, lote) => acc + lote.cantidad * lote.precio, 0),
    [lotesConCantidad],
  );

  const puedeContinuar = totalKg > 0 && totalEstimado > 0;

  const actualizarCampoLote = React.useCallback(
    (id: string, campo: 'cantidadKg' | 'precioKg', valor: string) => {
      setLotesVenta((prev) =>
        prev.map((lote) => (lote.id === id ? { ...lote, [campo]: valor } : lote)),
      );
    },
    [],
  );

  const reiniciarFlujo = React.useCallback(() => {
    setPaso(1);
    setCliente('Cliente general');
    setModoVenta('PARCIAL');
    setPrecioGlobal('');
    setLotesVenta((prev) =>
      prev.map((lote) => ({
        ...lote,
        cantidadKg: '',
      })),
    );
  }, []);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-5 pb-[145px] text-slate-900">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
        <header className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-[#eef2ff] p-3 text-[#102d92]">
                <Banknote size={18} />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Cafe Smart
                </p>
                <h1 className="mt-1 text-[1.35rem] font-black leading-tight text-[#102d92]">
                  Ventas
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Paso {paso} de 3
                </p>
              </div>
            </div>
            <CloudStatusBadge compact className="max-w-[190px]" />
          </div>
        </header>

        {cargando ? (
          <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-5 text-center shadow-sm">
            <p className="text-sm font-black text-[#102d92]">Cargando lotes para venta...</p>
          </section>
        ) : error ? (
          <section className="rounded-[22px] border border-[#ffd5d5] bg-[#fff6f6] p-4 shadow-sm">
            <p className="text-sm font-black text-[#a22424]">No se pudo cargar inventario de venta.</p>
            <p className="mt-1 text-sm text-[#8c3838]">{error}</p>
            <button
              type="button"
              onClick={() => void cargarLotes()}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#f4a7a7] bg-white px-3 py-2 text-xs font-black text-[#a22424]"
            >
              <RefreshCw size={14} />
              Reintentar
            </button>
          </section>
        ) : (
          <>
            {paso === 1 ? (
              <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Seleccionar cafe
                </p>
                <h2 className="mt-2 text-[1.3rem] font-black text-[#102d92]">
                  ¿Como deseas realizar la venta?
                </h2>

                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    onClick={() => setModoVenta('PARCIAL')}
                    className={`rounded-[16px] border p-4 text-left ${
                      modoVenta === 'PARCIAL'
                        ? 'border-[#102d92] bg-[#eef2ff]'
                        : 'border-[#e3e7f3] bg-white'
                    }`}
                  >
                    <p className="text-base font-black text-slate-900">Vender una parte del inventario</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Selecciona lotes especificos y ajusta cantidades.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModoVenta('TOTAL')}
                    className={`rounded-[16px] border p-4 text-left ${
                      modoVenta === 'TOTAL'
                        ? 'border-[#102d92] bg-[#eef2ff]'
                        : 'border-[#e3e7f3] bg-white'
                    }`}
                  >
                    <p className="text-base font-black text-slate-900">Vender todo el inventario</p>
                    <p className="mt-1 text-sm text-slate-600">Usa todos los lotes disponibles de una vez.</p>
                  </button>
                </div>

                {modoVenta === 'TOTAL' ? (
                  <div className="mt-4 rounded-[16px] border border-[#e5e8f3] bg-[#f8f9ff] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Precio por kg (COP)</p>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={precioGlobal}
                      onChange={(event) => setPrecioGlobal(event.target.value)}
                      placeholder="Ej: 12500"
                      className="mt-2 w-full rounded-xl border border-[#d7dcec] bg-white px-3 py-3 text-lg font-black text-[#102d92] outline-none focus:border-[#102d92]"
                    />
                  </div>
                ) : null}

                <div className="mt-5 space-y-3">
                  {lotesVenta.map((lote) => (
                    <article
                      key={lote.id}
                      className="rounded-[16px] border border-[#e5e8f3] bg-[#fcfcff] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-[#102d92]">{lote.codigo}</p>
                          <p className="text-sm text-slate-600">
                            {lote.tipoCafe} · {lote.calidad}
                          </p>
                          <p className="mt-1 text-sm font-black text-slate-900">
                            Disponible: {formatearKg(lote.disponibleKg)}
                          </p>
                        </div>
                      </div>

                      {modoVenta === 'PARCIAL' ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={lote.disponibleKg}
                            value={lote.cantidadKg}
                            onChange={(event) =>
                              actualizarCampoLote(lote.id, 'cantidadKg', event.target.value)
                            }
                            placeholder="Cantidad kg"
                            className="w-full rounded-xl border border-[#d7dcec] bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#102d92]"
                          />
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            value={lote.precioKg}
                            onChange={(event) =>
                              actualizarCampoLote(lote.id, 'precioKg', event.target.value)
                            }
                            placeholder="Precio por kg"
                            className="w-full rounded-xl border border-[#d7dcec] bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#102d92]"
                          />
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-600">
                          En modo total este lote se vende completo.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {paso === 2 ? (
              <section className="rounded-[22px] border border-[#e5e7f2] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Revision final
                </p>
                <h2 className="mt-2 text-[1.3rem] font-black text-[#102d92]">Confirma los datos de la venta</h2>

                <div className="mt-4 rounded-[14px] border border-[#dbe1f1] bg-[#f7f8fe] p-3">
                  <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Cliente
                  </label>
                  <input
                    type="text"
                    value={cliente}
                    onChange={(event) => setCliente(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#d7dcec] bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#102d92]"
                  />
                </div>

                <div className="mt-4 space-y-2">
                  {lotesConCantidad.map((lote) => (
                    <div
                      key={lote.id}
                      className="rounded-[12px] border border-[#e5e7f2] bg-[#fcfcff] px-3 py-2"
                    >
                      <p className="text-sm font-black text-slate-900">{lote.codigo}</p>
                      <p className="text-xs text-slate-600">
                        {lote.tipoCafe} · {lote.calidad}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#102d92]">
                        {formatearKg(lote.cantidad)} · {formatearMoneda(lote.cantidad * lote.precio)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {paso === 3 ? (
              <section className="rounded-[22px] border border-[#daf0e3] bg-white p-5 text-center shadow-sm">
                <div className="mx-auto inline-flex rounded-full bg-[#e8fff3] p-3 text-[#0d7b67]">
                  <CheckCircle2 size={28} />
                </div>
                <h2 className="mt-3 text-[1.35rem] font-black text-[#102d92]">Venta registrada (modo visual)</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Lista para conectar guardado real cuando el backend de ventas quede expuesto.
                </p>
                <p className="mt-3 text-lg font-black text-slate-900">{formatearMoneda(totalEstimado)}</p>

                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={reiniciarFlujo}
                    className="rounded-[14px] border border-[#d6dcf0] bg-white px-4 py-3 text-sm font-black text-[#102d92]"
                  >
                    Nueva venta
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/inicio')}
                    className="rounded-[14px] bg-[#102d92] px-4 py-3 text-sm font-black text-white"
                  >
                    Volver al inicio
                  </button>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>

      {!cargando && !error ? (
        <section className="fixed bottom-[74px] left-0 right-0 z-20 border-t border-[#dce2f4] bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto w-full max-w-[520px]">
            <div className="flex items-center justify-between text-sm font-black text-slate-900">
              <span>Total seleccionado</span>
              <span>{formatearKg(totalKg)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[1.1rem] font-black text-[#102d92]">
              <span>Total estimado</span>
              <span>{formatearMoneda(totalEstimado)}</span>
            </div>

            {paso === 1 ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/inicio')}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-[14px] border border-[#d6dcf0] bg-white px-4 py-3 text-sm font-black text-slate-700"
                >
                  <ArrowLeft size={16} />
                  Atras
                </button>
                <button
                  type="button"
                  disabled={!puedeContinuar}
                  onClick={() => setPaso(2)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Siguiente paso
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : null}

            {paso === 2 ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaso(1)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-[14px] border border-[#d6dcf0] bg-white px-4 py-3 text-sm font-black text-slate-700"
                >
                  <ArrowLeft size={16} />
                  Atras
                </button>
                <button
                  type="button"
                  onClick={() => setPaso(3)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 py-3 text-sm font-black text-white"
                >
                  Confirmar venta
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <AppBottomNav />
    </div>
  );
}
