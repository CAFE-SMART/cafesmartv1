import React from 'react';
import { Link } from 'react-router-dom';
import {
  Coffee,
  Sparkles,
  Activity,
  PlusCircle,
  DollarSign,
  TrendingUp,
  Shield,
  FileText,
  CheckCircle2,
  Smartphone,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-white to-[#eef4ff] text-slate-900 font-sans selection:bg-[#1D4ED8]/10 selection:text-[#1D4ED8]">
      {/* 1. Header */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/85 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <nav className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-[#1D4ED8] p-2 text-white shadow-md shadow-blue-500/10">
                <Coffee size={20} className="stroke-[2.5]" />
              </div>
              <span className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">
                Cafe Smart
              </span>
            </div>
            {/* Action Button */}
            <Link
              to="/login"
              className="inline-flex h-9 items-center justify-center rounded-full bg-[#1D4ED8] px-5 text-xs font-black text-white shadow-[0_4px_12px_rgba(29,78,216,0.15)] transition hover:bg-[#1e40af] hover:shadow-[0_6px_16px_rgba(29,78,216,0.22)] active:scale-[0.98]"
            >
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </header>

      {/* 2. Hero Principal */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="py-12 sm:py-16 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Hero Text & Actions */}
            <div className="text-center lg:col-span-7 lg:text-left">
              <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
                Controla tu negocio cafetero{' '}
                <span className="bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] bg-clip-text text-transparent">
                  desde el celular
                </span>
              </h1>

              <p className="mt-6 text-base leading-relaxed text-slate-600 sm:text-lg">
                Cafe Smart es un asistente virtual diseñado para ayudarte a
                organizar inventarios, secados, compras, ventas, gastos y
                reportes de tu negocio cafetero de forma fácil y rápida.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Link
                  to="/register"
                  className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-[#1D4ED8] px-8 text-sm font-black text-white shadow-[0_8px_20px_rgba(29,78,216,0.2)] transition-all hover:bg-[#1e40af] hover:shadow-[0_12px_24px_rgba(29,78,216,0.3)] active:scale-[0.99] sm:w-auto"
                >
                  Comenzar gratis
                  <ArrowRight size={16} />
                </Link>
                <a
                  href="#que-puedes-hacer"
                  className="inline-flex min-h-[50px] items-center justify-center rounded-full bg-[#edf1f8] px-8 text-sm font-black text-[#1f3f97] transition-all hover:bg-[#e2eafd] active:scale-[0.99] sm:w-auto"
                >
                  Ver cómo funciona
                </a>
              </div>
            </div>

            {/* Hero Live Mockup Dashboard */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto w-full max-w-[290px] sm:max-w-[320px]">
                {/* Background glow effects */}
                <div className="absolute -inset-4 rounded-[40px] bg-gradient-to-tr from-blue-500/20 to-indigo-500/20 opacity-70 blur-2xl lg:-inset-8" />

                {/* Smartphone Device Frame */}
                <div className="relative w-full rounded-[38px] border-8 border-slate-900 bg-slate-900 p-2 shadow-2xl transition-all duration-500 hover:rotate-1 hover:scale-[1.02]">
                  {/* Phone Notch/Camera */}
                  <div className="absolute left-1/2 top-4 h-4 w-28 -translate-x-1/2 rounded-full bg-slate-900 z-20 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-800" />
                  </div>

                  {/* Screen Content Wrapper */}
                  <div className="relative rounded-[24px] bg-[#f8faff] overflow-hidden text-left z-10 aspect-[9/18.5] flex flex-col pt-6 pb-2 px-3.5">
                    {/* Mockup Header */}
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <div className="rounded-lg bg-[#1D4ED8] p-1 text-white">
                          <Coffee size={11} className="stroke-[2.5]" />
                        </div>
                        <span className="text-[10px] font-black text-slate-800">
                          Cafe Smart
                        </span>
                      </div>
                      <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center text-[8px] font-bold text-[#1D4ED8]">
                        DN
                      </div>
                    </div>

                    {/* Mockup Scrollable Screen Dashboard */}
                    <div className="mt-2.5 flex-1 overflow-y-auto space-y-2.5 pr-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {/* Virtual Assistant Notification bubble */}
                      <div className="rounded-xl bg-gradient-to-r from-blue-600 to-[#1D4ED8] p-2 text-white shadow-sm flex items-start gap-1.5">
                        <Sparkles
                          size={11}
                          className="shrink-0 mt-0.5 text-blue-100"
                        />
                        <div>
                          <p className="text-[8px] text-blue-100 font-bold uppercase tracking-wider">
                            Asistente Café
                          </p>
                          <p className="text-[9.5px] font-bold leading-tight mt-0.5">
                            ¡Tienes 2 lotes en secado listos para registrar!
                          </p>
                        </div>
                      </div>

                      {/* Info Cards Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-white p-2 border border-slate-100 shadow-[0_2px_6px_rgba(15,23,42,0.02)]">
                          <span className="text-[7.5px] font-bold text-slate-400 block uppercase tracking-wider">
                            Inventario
                          </span>
                          <span className="text-[11.5px] font-black text-slate-800 block mt-0.5">
                            4,850 kg
                          </span>
                          <span className="text-[7px] text-emerald-500 font-bold">
                            12% esta semana
                          </span>
                        </div>
                        <div className="rounded-xl bg-white p-2 border border-slate-100 shadow-[0_2px_6px_rgba(15,23,42,0.02)]">
                          <span className="text-[7.5px] font-bold text-slate-400 block uppercase tracking-wider">
                            Secados Activos
                          </span>
                          <span className="text-[11.5px] font-black text-slate-800 block mt-0.5">
                            2 Sublotes
                          </span>
                          <span className="text-[7px] text-amber-500 font-bold">
                            En proceso
                          </span>
                        </div>
                      </div>

                      {/* Active Drying Progress */}
                      <div className="rounded-xl bg-white p-2 border border-slate-100 shadow-sm space-y-1.5">
                        <div className="flex items-center justify-between text-[8px]">
                          <div className="flex items-center gap-1 text-slate-600">
                            <Activity size={10} className="text-[#1D4ED8]" />
                            <span className="font-bold">
                              Secando: Sublote 3B
                            </span>
                          </div>
                          <span className="font-black text-amber-600 bg-amber-50 px-1 py-0.5 rounded">
                            12.4% Hum.
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: '80%' }}
                          />
                        </div>
                      </div>

                      {/* Recent Activities List */}
                      <div className="space-y-1.5">
                        <p className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider px-0.5">
                          Operaciones Recientes
                        </p>

                        <div className="rounded-xl bg-white p-2 border border-slate-100 shadow-sm flex items-center justify-between text-[8px]">
                          <div className="flex items-center gap-1.5">
                            <span className="h-4 w-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-[9px]">
                              +
                            </span>
                            <div>
                              <p className="font-bold text-slate-700 leading-none">
                                Compra de Café
                              </p>
                              <p className="text-slate-400 text-[6.5px] mt-0.5">
                                Pergamino • 180 kg
                              </p>
                            </div>
                          </div>
                          <p className="font-extrabold text-slate-800">
                            $2,430k
                          </p>
                        </div>

                        <div className="rounded-xl bg-white p-2 border border-slate-100 shadow-sm flex items-center justify-between text-[8px]">
                          <div className="flex items-center gap-1.5">
                            <span className="h-4 w-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[9px]">
                              -
                            </span>
                            <div>
                              <p className="font-bold text-slate-700 leading-none">
                                Venta de Café
                              </p>
                              <p className="text-slate-400 text-[6.5px] mt-0.5">
                                Verde • 320 kg
                              </p>
                            </div>
                          </div>
                          <p className="font-extrabold text-slate-800">
                            $4,960k
                          </p>
                        </div>
                      </div>

                      {/* Mockup Chat Bubble */}
                      <div className="rounded-xl bg-blue-50/80 border border-blue-100 p-2 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Sparkles size={9} className="text-[#1D4ED8]" />
                          <span className="text-[7px] font-bold text-[#1D4ED8] uppercase">
                            Sugerencia del Asistente
                          </span>
                        </div>
                        <p className="text-[8.5px] leading-relaxed text-blue-900 font-medium">
                          "Tus gastos esta semana bajaron un 8%. Recomiendo
                          vender el café pergamino seco mañana para optimizar
                          ganancias."
                        </p>
                      </div>
                    </div>

                    {/* Mockup Navigation Tabs */}
                    <div className="border-t border-slate-200 bg-white -mx-3.5 -mb-2 mt-2 pt-2 pb-3.5 px-3 flex justify-between items-center text-slate-400">
                      <div className="flex flex-col items-center flex-1 text-[#1D4ED8]">
                        <Coffee size={12} />
                        <span className="text-[6.5px] font-bold mt-0.5">
                          Inicio
                        </span>
                      </div>
                      <div className="flex flex-col items-center flex-1">
                        <PlusCircle size={12} />
                        <span className="text-[6.5px] font-bold mt-0.5">
                          Compras
                        </span>
                      </div>
                      <div className="flex flex-col items-center flex-1">
                        <Activity size={12} />
                        <span className="text-[6.5px] font-bold mt-0.5">
                          Inventario
                        </span>
                      </div>
                      <div className="flex flex-col items-center flex-1">
                        <DollarSign size={12} />
                        <span className="text-[6.5px] font-bold mt-0.5">
                          Ventas
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Sección de Beneficios Rápidos */}
        <section
          id="beneficios"
          className="py-12 border-t border-slate-100 sm:py-16"
        >
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">
              ¿Por qué elegir Cafe Smart?
            </h2>
            <p className="mt-3 text-slate-500 text-sm sm:text-base">
              Simplificamos el control de tu finca o negocio de café, pensados
              100% para celular.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Tarjeta 1 */}
            <div className="rounded-[20px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)] transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={20} className="stroke-[2.5]" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">
                Control preciso
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Registra entradas, salidas, compras, ventas y movimientos de
                café sin perder información.
              </p>
            </div>

            {/* Tarjeta 2 */}
            <div className="rounded-[20px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)] transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Smartphone size={20} className="stroke-[2.5]" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">
                Fácil de usar
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Diseñado para el día a día del negocio cafetero, sin procesos
                complicados.
              </p>
            </div>

            {/* Tarjeta 3 */}
            <div className="rounded-[20px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)] transition-all sm:col-span-2 lg:col-span-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <ClipboardList size={20} className="stroke-[2.5]" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">
                Menos desorden
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Evita depender de cuadernos, hojas sueltas o cálculos manuales.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Sección "¿Qué puedes hacer con Cafe Smart?" */}
        <section
          id="que-puedes-hacer"
          className="py-12 border-t border-slate-100 sm:py-16"
        >
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">
              ¿Qué puedes hacer con Cafe Smart?
            </h2>
            <p className="mt-3 text-slate-500 text-sm sm:text-base">
              Todo lo necesario para administrar y hacer crecer tu negocio
              cafetero.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Compras */}
            <div className="rounded-[20px] border border-slate-50 bg-white/70 p-5 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#1D4ED8]">
                <PlusCircle size={18} />
              </div>
              <h4 className="mt-3 text-sm font-bold text-slate-900">
                Registrar compras de café
              </h4>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                Lleva el control de cada entrada de café al negocio.
              </p>
            </div>

            {/* Inventario */}
            <div className="rounded-[20px] border border-slate-50 bg-white/70 p-5 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#1D4ED8]">
                <Coffee size={18} />
              </div>
              <h4 className="mt-3 text-sm font-bold text-slate-900">
                Controlar inventario
              </h4>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                Consulta cuánto café tienes disponible, en qué estado está y
                dónde se encuentra.
              </p>
            </div>

            {/* Secado */}
            <div className="rounded-[20px] border border-slate-50 bg-white/70 p-5 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#1D4ED8]">
                <Activity size={18} />
              </div>
              <h4 className="mt-3 text-sm font-bold text-slate-900">
                Gestionar secado
              </h4>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                Haz seguimiento a los sublotes que están en proceso de secado y
                evita confusiones con el inventario.
              </p>
            </div>

            {/* Ventas y Gastos */}
            <div className="rounded-[20px] border border-slate-50 bg-white/70 p-5 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#1D4ED8]">
                <DollarSign size={18} />
              </div>
              <h4 className="mt-3 text-sm font-bold text-slate-900">
                Registrar ventas y gastos
              </h4>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                Organiza los movimientos económicos del negocio.
              </p>
            </div>

            {/* Reportes */}
            <div className="rounded-[20px] border border-slate-50 bg-white/70 p-5 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#1D4ED8]">
                <FileText size={18} />
              </div>
              <h4 className="mt-3 text-sm font-bold text-slate-900">
                Ver reportes del negocio
              </h4>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                Consulta compras, ventas, gastos, mermas, rendimiento y utilidad
                de forma sencilla.
              </p>
            </div>

            {/* Asistente virtual */}
            <div className="rounded-[20px] border border-slate-50 bg-white/70 p-5 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#1D4ED8]">
                <Sparkles size={18} />
              </div>
              <h4 className="mt-3 text-sm font-bold text-slate-900">
                Usar un asistente virtual
              </h4>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                Recibe apoyo para consultar información y analizar tus procesos
                de forma más rápida.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Sección Importante: "Tu Asistente Virtual Cafetero" */}
        <section className="py-12 border-t border-slate-100 sm:py-16">
          <div className="rounded-[30px] bg-gradient-to-br from-[#edf4ff] to-white border border-blue-100 p-6 sm:p-10 shadow-lg">
            <div className="grid gap-8 lg:grid-cols-12 items-center">
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#1D4ED8]">
                  <Sparkles size={12} className="stroke-[2.5]" />
                  Inteligencia a tu servicio
                </div>

                <h2 className="mt-4 text-2xl font-black text-slate-900 sm:text-3xl">
                  Tu asistente virtual cafetero
                </h2>

                <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                  Cafe Smart no solo guarda información. También te ayuda a
                  entenderla. Puedes consultar datos de tu negocio, revisar
                  movimientos, analizar inventario y recibir apoyo para tomar
                  mejores decisiones sobre compras, ventas, secado y rendimiento
                  del café.
                </p>

                {/* Highlight Quote Pill */}
                <div className="mt-6 border-l-4 border-[#1D4ED8] pl-4">
                  <p className="text-base font-extrabold italic text-slate-800">
                    “Menos desorden. Más control. Mejores decisiones.”
                  </p>
                </div>
              </div>

              {/* Chat simulation container */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Simulación de Consulta
                  </span>
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                {/* User Message */}
                <div className="flex flex-col items-end">
                  <div className="rounded-2xl rounded-tr-sm bg-slate-100 px-3.5 py-2 max-w-[85%]">
                    <p className="text-xs font-medium text-slate-700">
                      ¿Cuánto café pergamino tengo en secado?
                    </p>
                  </div>
                  <span className="text-[8px] text-slate-400 mt-1 mr-1">
                    Tú (Productor)
                  </span>
                </div>

                {/* Assistant Message */}
                <div className="flex flex-col items-start">
                  <div className="rounded-2xl rounded-tl-sm bg-blue-50 border border-blue-100 px-3.5 py-2 max-w-[85%] flex gap-2 items-start">
                    <Sparkles
                      size={12}
                      className="text-[#1D4ED8] shrink-0 mt-0.5"
                    />
                    <p className="text-xs font-bold text-blue-900">
                      Tienes 1,200 kg del Sublote 2B en secado activo con una
                      humedad estimada de 13.2%. Falta poco para sacarlo.
                    </p>
                  </div>
                  <span className="text-[8px] text-blue-500 mt-1 ml-1 font-bold">
                    Asistente Cafe Smart
                  </span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 6. Sección para Dueños o Administradores */}
        <section className="py-12 border-t border-slate-100 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">
                Pensado para dueños y administradores cafeteros
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                Cafe Smart te ayuda a ver lo más importante de tu negocio sin
                tener que revisar cuadernos, hojas sueltas o cálculos manuales.
                Desde tu celular puedes conocer el estado del inventario, los
                secados activos, las ventas, los gastos y el rendimiento general
                del café.
              </p>

              <ul className="mt-6 space-y-3">
                <li className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-slate-700">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    ✓
                  </div>
                  Monitoreo de inventarios 24/7 en la nube
                </li>
                <li className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-slate-700">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    ✓
                  </div>
                  Alertas sobre humedad y mermas en secado
                </li>
                <li className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-slate-700">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    ✓
                  </div>
                  Reportes instantáneos de utilidad y gastos
                </li>
              </ul>
            </div>

            <div className="bg-[#f8faff] rounded-[24px] border border-slate-100 p-6 text-center space-y-4">
              <div className="inline-flex p-3 rounded-full bg-blue-50 text-[#1D4ED8]">
                <Smartphone size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Todo el control en un solo lugar
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                No importa dónde estés, accede a los datos de tu finca y toma
                decisiones al instante con la interfaz optimizada para
                dispositivos móviles.
              </p>
            </div>
          </div>
        </section>

        {/* 7. Sección de Características Principales */}
        <section className="py-12 border-t border-slate-100 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">
              Características principales
            </h2>
            <p className="mt-3 text-slate-500 text-sm sm:text-base">
              Las herramientas que necesitas para llevar tu negocio cafetero al
              siguiente nivel.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Característica 1 */}
            <div className="rounded-[22px] border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#1D4ED8]">
                  <Coffee size={20} />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">
                  Inventario inteligente
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Controla café pergamino, café verde, café en secado y café
                  almacenado desde una sola vista.
                </p>
              </div>
            </div>

            {/* Característica 2 */}
            <div className="rounded-[22px] border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#1D4ED8]">
                  <TrendingUp size={20} />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">
                  Reportes claros
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Consulta compras, ventas, gastos, mermas, rendimiento y
                  utilidad de forma sencilla.
                </p>
              </div>
            </div>

            {/* Característica 3 */}
            <div className="rounded-[22px] border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between sm:col-span-2 lg:col-span-1">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#1D4ED8]">
                  <Shield size={20} />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">
                  Información segura
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Tus datos se guardan de forma organizada para que puedas
                  consultarlos cuando los necesites.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 8. CTA Final */}
        <section className="py-12 border-t border-slate-100 sm:py-16">
          <div className="rounded-[30px] bg-gradient-to-r from-blue-900 to-indigo-950 p-8 text-center text-white sm:p-12 shadow-xl relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-xl" />
            <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-xl" />

            <div className="relative z-10 mx-auto max-w-2xl">
              <h2 className="text-2xl font-black sm:text-4xl">
                Empieza a organizar tu negocio cafetero hoy
              </h2>

              <p className="mt-4 text-sm text-blue-100 sm:text-base leading-relaxed">
                Cafe Smart te ayuda a tener más control, ahorrar tiempo y tomar
                mejores decisiones desde tu celular.
              </p>

              <div className="mt-8 flex justify-center">
                <Link
                  to="/register"
                  className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-white px-8 text-sm font-black text-[#1D4ED8] shadow-lg transition-all hover:bg-slate-100 active:scale-[0.99]"
                >
                  Probar Cafe Smart
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-slate-50 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Cafe Smart. Todos los derechos
            reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
