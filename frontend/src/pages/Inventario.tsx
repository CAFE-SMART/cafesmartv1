function Inventario() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-lg">
        {/* 🔷 HEADER */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">☕ Café Smart - Inventario</h1>
          <p className="mt-2 text-slate-600">
            Inicio de sesión exitoso. Bienvenido al panel de inventario.
          </p>
        </div>
      </section>
    </main>
  );
}

export default Inventario;
