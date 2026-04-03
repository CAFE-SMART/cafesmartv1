import { CloudStatusBadge } from '../components/CloudStatusBadge';

function Inventario() {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-4">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Cafe Smart
            </p>
            <h1 className="text-2xl font-bold text-slate-900">Inventario</h1>
          </div>
          <CloudStatusBadge />
        </div>
      </header>

      <main className="p-6">
        <section className="mx-auto w-full max-w-5xl rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Panel inicial</h2>
            <p className="mt-2 text-slate-600">
              Inicio de sesion exitoso. Bienvenido al panel de inventario.
            </p>
            <p className="mt-3 text-sm text-slate-500">
              El icono de nube en la parte superior indica si la API esta conectada,
              si una operacion se esta sincronizando o si ya quedo confirmada en la nube.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Inventario;
