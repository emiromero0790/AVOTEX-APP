import React, { useMemo, useState } from "react";
import {
  Activity, ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Clock3,
  Droplets, Filter, Leaf, Plus, ScanLine, ShieldAlert, Trash2, TrendingUp, X
} from "lucide-react";

type Section = "insight" | "history" | "plan";
type FilterKey = "Todos" | "Aguacate" | "Mango" | "Limón" | "Guayaba";
type Scan = { fruit: string; icon: string; label: string; score: number; date: string; time: string; confidence: string; status: "saludable" | "alerta" };
type Task = { id: number; title: string; detail: string; date: string; done: boolean; urgency: "alta" | "media" | "baja" };

const scans: Scan[] = [
  { fruit: "Aguacate", icon: "A", label: "Saludable", score: 94, date: "12 jun 2024", time: "10:42", confidence: "Alta · 94%", status: "saludable" },
  { fruit: "Mango", icon: "M", label: "Signos de deterioro", score: 62, date: "10 jun 2024", time: "09:30", confidence: "Media · 62%", status: "alerta" },
  { fruit: "Limón", icon: "L", label: "Saludable", score: 89, date: "11 jun 2024", time: "16:18", confidence: "Alta · 89%", status: "saludable" },
  { fruit: "Guayaba", icon: "G", label: "Saludable", score: 91, date: "08 jun 2024", time: "13:06", confidence: "Alta · 91%", status: "saludable" },
  { fruit: "Mango", icon: "M", label: "En observación", score: 74, date: "06 jun 2024", time: "08:14", confidence: "Media · 74%", status: "alerta" },
];

const initialTasks: Task[] = [
  { id: 1, title: "Separar el mango detectado", detail: "Evita que el deterioro se propague a la caja 04.", date: "Hoy", done: false, urgency: "alta" },
  { id: 2, title: "Revisar humedad del almacén", detail: "La lectura subió 8% desde el último control.", date: "Mañana", done: false, urgency: "media" },
  { id: 3, title: "Escanear lote de limones", detail: "Toca el lote L-18 antes de cerrar la jornada.", date: "Jue, 13 jun", done: true, urgency: "baja" },
];

const filters: FilterKey[] = ["Todos", "Aguacate", "Mango", "Limón", "Guayaba"];

export function ActionCenter() {
  const [section, setSection] = useState<Section>("insight");
  const [filter, setFilter] = useState<FilterKey>("Todos");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [expanded, setExpanded] = useState<number | null>(1);
  const [showTask, setShowTask] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [notice, setNotice] = useState("");

  const filteredScans = useMemo(() => filter === "Todos" ? scans : scans.filter((scan) => scan.fruit === filter), [filter]);
  const days = useMemo(() => ["L", "M", "X", "J", "V", "S", "D"].map((day, i) => ({ day, date: 10 + i + weekOffset * 7 })), [weekOffset]);
  const toggleTask = (id: number) => setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  const addTask = () => {
    if (!taskName.trim()) return;
    setTasks((current) => [{ id: Date.now(), title: taskName.trim(), detail: "Creada desde tu centro de actividad.", date: "Hoy", done: false, urgency: "media" }, ...current]);
    setTaskName(""); setShowTask(false); setNotice("Tarea añadida a tu plan");
  };
  const scrollTo = (target: Section) => { setSection(target); document.getElementById(`activity-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  return (
    <main className="min-h-[100dvh] bg-[#f4f2eb] text-[#18352d] font-sans antialiased">
      <div className="mx-auto max-w-[520px] overflow-hidden pb-14">
        <header className="bg-[#18352d] px-5 pb-6 pt-5 text-[#f6f4ed]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-[#c7d5c1]"><Leaf size={15} /> Avotex / Actividad</div>
            <button onClick={() => { setNotice("Cámara lista para un nuevo escaneo"); }} aria-label="Iniciar escaneo" className="rounded-full border border-[#88a68e] p-2 text-[#e4f0dc] transition hover:bg-[#2e5544]"><ScanLine size={19} /></button>
          </div>
          <div className="mt-8">
            <p className="text-sm text-[#b7c9b6]">Miércoles, 12 de junio · 08:40</p>
            <h1 className="mt-2 text-[32px] font-medium leading-[1.06] tracking-[-.04em]">Tu campo, <em className="font-serif font-normal text-[#d8e69a]">en claro.</em></h1>
            <p className="mt-3 max-w-[320px] text-[14px] leading-5 text-[#ccdbca]">4 de 5 lecturas se mantienen saludables. Hay una acción que conviene atender hoy.</p>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            <Metric value="82%" label="salud global" trend="+6%" up />
            <Metric value="12" label="escaneos · 30d" />
            <Metric value="1" label="acción urgente" alert />
          </div>
        </header>

        <nav className="sticky top-0 z-10 border-b border-[#d9ddd1] bg-[#f4f2eb]/95 px-5 py-3 backdrop-blur" aria-label="Secciones de actividad">
          <div className="flex items-center justify-between">
            {(["insight", "history", "plan"] as Section[]).map((item) => <button key={item} onClick={() => scrollTo(item)} className={`relative px-1 py-1 text-[12px] font-semibold transition ${section === item ? "text-[#18352d]" : "text-[#7a887d]"}`}>{item === "insight" ? "Resumen" : item === "history" ? "Historial" : "Plan de trabajo"}{section === item && <span className="absolute -bottom-3 left-0 right-0 h-0.5 rounded-full bg-[#bb6b42]" />}</button>)}
            <button onClick={() => setFilter("Todos")} className="flex items-center gap-1 text-[12px] font-semibold text-[#617267]"><Filter size={14} /> Filtrar</button>
          </div>
        </nav>

        {notice && <div className="mx-5 mt-4 flex items-center justify-between rounded-xl bg-[#e2edd9] px-3 py-2 text-[12px] font-semibold text-[#31573c]" role="status">{notice}<button onClick={() => setNotice("")}><X size={14} /></button></div>}

        <section id="activity-insight" className="scroll-mt-14 px-5 pt-6">
          <div className="mb-3 flex items-end justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#a15e3d]">Lectura de hoy</p><h2 className="mt-1 text-[21px] font-semibold tracking-[-.03em]">¿Cómo va tu cosecha?</h2></div><span className="flex items-center gap-1 text-[11px] font-semibold text-[#39704f]"><TrendingUp size={14} /> +6% vs. semana anterior</span></div>
          <div className="rounded-2xl border border-[#d9ddd1] bg-[#fbfaf5] p-4 shadow-[0_4px_18px_rgba(40,62,45,.05)]">
            <div className="flex items-center gap-4">
              <div className="relative grid h-[92px] w-[92px] shrink-0 place-items-center rounded-full" style={{ background: "conic-gradient(#4d8661 0 82%, #e2e5d9 82% 100%)" }}><div className="grid h-[70px] w-[70px] place-items-center rounded-full bg-[#fbfaf5]"><strong className="text-[25px] tracking-[-.06em]">82</strong><span className="-ml-1 text-[11px] text-[#68786b]">/100</span></div></div>
              <div><p className="text-[15px] font-semibold">Salud general estable</p><p className="mt-1 text-[12px] leading-5 text-[#68786b]">Aguacate, limón y guayaba sostienen el promedio. El mango baja la lectura del lote.</p></div>
            </div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-[#e1e3da] border-t border-[#e1e3da] pt-3 text-center"><MiniStat value="3" label="saludables" /><MiniStat value="1" label="en observación" /><MiniStat value="1" label="requiere atención" /></div>
          </div>
        </section>

        <section className="px-5 pt-7">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#a15e3d]">Señales</p><h2 className="mt-1 text-[21px] font-semibold tracking-[-.03em]">Qué está cambiando</h2></div><Activity size={20} className="text-[#719079]" /></div>
          <div className="rounded-2xl border border-[#d9ddd1] bg-[#fbfaf5] p-4">
            <div className="flex items-center justify-between"><div><p className="text-[13px] font-semibold">Salud por cultivo</p><p className="text-[11px] text-[#758177]">Últimos 30 días · confianza media</p></div><span className="rounded-full bg-[#e2edd9] px-2 py-1 text-[10px] font-bold text-[#396448]">TENDENCIA</span></div>
            <div className="mt-4 flex h-[88px] items-end gap-2 border-b border-l border-[#d9ddd1] px-2 pb-0">{[58, 61, 59, 68, 65, 74, 70, 82].map((height, i) => <div key={i} className="group relative flex h-full flex-1 items-end"><div className={`w-full rounded-t-[4px] ${i === 7 ? "bg-[#bb6b42]" : "bg-[#7da27d]"}`} style={{ height: `${height}%` }} /></div>)}</div>
            <div className="mt-2 flex justify-between pl-2 text-[10px] text-[#7a887d]"><span>14 may</span><span>28 may</span><span>12 jun</span></div>
          </div>
          <div className="mt-3 rounded-2xl border border-[#d9ddd1] bg-[#e8efe2] p-4"><div className="flex items-start gap-3"><Droplets size={18} className="mt-0.5 shrink-0 text-[#47785d]" /><div><p className="text-[13px] font-bold">La humedad pide atención</p><p className="mt-1 text-[12px] leading-5 text-[#5c715f]">El mango concentra 2 de 3 lecturas por debajo de 70%. Revisa ventilación y separa el lote M-04.</p></div></div></div>
        </section>

        <section className="px-5 pt-8">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#a15e3d]">Prioridad</p><h2 className="mt-1 text-[21px] font-semibold tracking-[-.03em]">Lo que puedes hacer ahora</h2></div><span className="text-[11px] font-semibold text-[#718074]">1 de 3 atendida</span></div>
          <div className="space-y-3">{[
            { icon: ShieldAlert, title: "Aísla el mango del lote M-04", detail: "62% de confianza · deterioro detectado", tag: "URGENTE", color: "border-[#d8b29f] bg-[#fbf2ec]", action: "Marcar como hecho" },
            { icon: Droplets, title: "Mide la humedad del almacén", detail: "Subió 8% en la última semana", tag: "HOY", color: "border-[#cbdcc4] bg-[#edf3e9]", action: "Añadir al plan" },
          ].map(({ icon: Icon, title, detail, tag, color, action }, i) => <div key={title} className={`rounded-2xl border p-4 ${color}`}><div className="flex gap-3"><div className="mt-0.5 rounded-lg bg-[#fbfaf5]/70 p-2"><Icon size={18} className="text-[#8d553b]" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><span className="text-[10px] font-bold tracking-[.12em] text-[#8e5d46]">{tag}</span><p className="mt-1 text-[14px] font-bold">{title}</p></div><button onClick={() => setNotice(`${action}: ${title}`)} className="rounded-full p-1.5 text-[#657467] hover:bg-white/60" aria-label={`Gestionar ${title}`}><ArrowRight size={17} /></button></div><p className="mt-1 text-[12px] text-[#68786b]">{detail}</p><button onClick={() => setNotice(`${action}: ${title}`)} className="mt-3 text-[11px] font-bold text-[#7e4d36] underline underline-offset-2">{action}</button></div></div></div>)}</div>
        </section>

        <section id="activity-history" className="scroll-mt-14 px-5 pt-9">
          <div className="flex items-end justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#a15e3d]">Registro</p><h2 className="mt-1 text-[21px] font-semibold tracking-[-.03em]">Historial de diagnósticos</h2></div><span className="text-[11px] font-semibold text-[#718074]">{filteredScans.length} lecturas</span></div>
          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">{filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold ${filter === item ? "border-[#18352d] bg-[#18352d] text-[#f6f4ed]" : "border-[#ccd4c8] bg-transparent text-[#627267]"}`}>{item}</button>)}</div>
          <div className="mt-3 divide-y divide-[#e1e3da] rounded-2xl border border-[#d9ddd1] bg-[#fbfaf5] px-4">{filteredScans.map((scan) => <ScanRow key={`${scan.date}-${scan.time}`} scan={scan} />)}</div>
          <button onClick={() => { setFilter("Todos"); setNotice("Mostrando todos los diagnósticos"); }} className="mt-3 flex w-full items-center justify-center gap-2 text-[12px] font-bold text-[#52705a]">Ver todas las lecturas <ArrowRight size={14} /></button>
        </section>

        <section id="activity-plan" className="scroll-mt-14 px-5 pt-9">
          <div className="flex items-end justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#a15e3d]">Organiza el trabajo</p><h2 className="mt-1 text-[21px] font-semibold tracking-[-.03em]">Tu plan de esta semana</h2></div><button onClick={() => setShowTask(!showTask)} className="flex items-center gap-1 rounded-full bg-[#18352d] px-3 py-2 text-[11px] font-bold text-white"><Plus size={14} /> Tarea</button></div>
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#d9ddd1] bg-[#fbfaf5] px-3 py-3"><button onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Semana anterior" className="rounded-full p-1 hover:bg-[#e9ede3]"><ChevronLeft size={17} /></button><div className="flex flex-1 justify-around">{days.map((day, i) => <button key={`${day.day}-${day.date}`} onClick={() => setNotice(`Tareas del ${day.date} de junio`)} className={`flex w-8 flex-col items-center gap-1 rounded-xl py-1 ${i === 2 && weekOffset === 0 ? "bg-[#dce9d5] text-[#315d40]" : "text-[#758177]"}`}><span className="text-[10px] font-bold">{day.day}</span><b className="text-[13px]">{day.date}</b>{i === 2 && <i className="h-1 w-1 rounded-full bg-[#bb6b42]" />}</button>)}</div><button onClick={() => setWeekOffset(weekOffset + 1)} aria-label="Semana siguiente" className="rounded-full p-1 hover:bg-[#e9ede3]"><ChevronRight size={17} /></button></div>
          {showTask && <div className="mt-3 flex gap-2 rounded-2xl border border-[#b9cdb5] bg-[#e8efe2] p-3"><input autoFocus value={taskName} onChange={(e) => setTaskName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder="Ej. Revisar caja de aguacates" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#849385]" /><button onClick={addTask} className="rounded-lg bg-[#315d40] px-3 py-2 text-[11px] font-bold text-white">Añadir</button></div>}
          <div className="mt-3 rounded-2xl border border-[#d9ddd1] bg-[#fbfaf5] px-4">{tasks.map((task) => <div key={task.id} className="flex items-start gap-3 border-b border-[#e1e3da] py-3 last:border-0"><button onClick={() => toggleTask(task.id)} aria-label={task.done ? `Reabrir ${task.title}` : `Completar ${task.title}`} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${task.done ? "border-[#47785d] bg-[#47785d] text-white" : "border-[#8da08d] text-transparent"}`}>{task.done ? <Check size={13} /> : <Circle size={12} />}</button><div className="min-w-0 flex-1"><p className={`text-[13px] font-semibold ${task.done ? "text-[#89958b] line-through" : ""}`}>{task.title}</p><p className="mt-1 text-[11px] leading-4 text-[#7a887d]">{task.detail}</p><span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#8c6652]"><Clock3 size={12} /> {task.date} · {task.urgency}</span></div><button onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))} aria-label={`Eliminar ${task.title}`} className="p-1 text-[#9a887f] hover:text-[#9b4f3c]"><Trash2 size={15} /></button></div>)}</div>
        </section>

        <button onClick={() => setNotice("Abriendo cámara para escanear un fruto")} className="mx-5 mt-9 flex w-[calc(100%-40px)] items-center justify-center gap-2 rounded-2xl bg-[#bb6b42] py-3.5 text-[13px] font-bold text-[#fffaf3] shadow-[0_6px_14px_rgba(131,76,46,.18)]"><ScanLine size={18} /> Escanear un fruto</button>
        <p className="mt-3 text-center text-[11px] text-[#879287]">Última sincronización · hoy, 08:40</p>
      </div>
    </main>
  );
}

function Metric({ value, label, trend, up, alert }: { value: string; label: string; trend?: string; up?: boolean; alert?: boolean }) {
  return <div className="rounded-xl bg-[#2a4c3d] p-3"><div className="flex items-center gap-1 text-[20px] font-semibold tracking-[-.05em]">{value}{trend && <span className="text-[10px] font-bold text-[#c9df9c]">{trend}</span>}</div><p className="mt-1 text-[10px] leading-3 text-[#b5c8b5]">{label}</p>{up && <TrendingUp size={12} className="mt-2 text-[#c9df9c]" />}{alert && <ShieldAlert size={13} className="mt-2 text-[#e6b397]" />}</div>;
}
function MiniStat({ value, label }: { value: string; label: string }) { return <div><strong className="text-[18px]">{value}</strong><p className="mt-1 text-[10px] text-[#778578]">{label}</p></div>; }
function ScanRow({ scan }: { scan: Scan }) {
  const good = scan.status === "saludable";
  return <details className="group"><summary className="flex cursor-pointer list-none items-center gap-3 py-3.5 [&::-webkit-details-marker]:hidden"><span className={`grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold ${good ? "bg-[#e1eddb] text-[#3f7651]" : "bg-[#f5e3d9] text-[#975438]"}`}>{scan.icon}</span><span className="min-w-0 flex-1"><b className="block text-[13px]">{scan.fruit}</b><span className="mt-0.5 block text-[11px] text-[#7b887c]">{scan.date} · {scan.time}</span></span><span className={`mr-1 text-right text-[11px] font-bold ${good ? "text-[#427354]" : "text-[#9a5539]"}`}>{scan.score}%<small className="block font-normal text-[#7b887c]">{scan.label}</small></span><ChevronDown size={15} className="text-[#8b978d] transition group-open:rotate-180" /></summary><div className="mb-3 ml-11 grid grid-cols-2 gap-2 rounded-lg bg-[#f0f1e9] p-2 text-[10px] text-[#68786b]"><span>Confianza<br /><b className="text-[#365d43]">{scan.confidence}</b></span><span>Estado<br /><b className="text-[#365d43]">{good ? "Sin señales de riesgo" : "Revisión recomendada"}</b></span></div></details>;
}