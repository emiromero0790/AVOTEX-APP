import React, { useMemo, useState } from "react";
import { BarChart3, BrainCircuit, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Leaf, List, PieChart, Plus, ShieldAlert } from "lucide-react";
import "./_group.css";

type View = "charts" | "list" | "agenda";
const scans = [
  { fruit: "Aguacate", label: "Saludable", score: 94, date: "12 de junio de 2024, 10:42" },
  { fruit: "Limón", label: "Saludable", score: 89, date: "11 de junio de 2024, 16:18" },
  { fruit: "Mango", label: "Con signos de deterioro", score: 62, date: "10 de junio de 2024, 09:30" },
  { fruit: "Guayaba", label: "Saludable", score: 91, date: "8 de junio de 2024, 13:06" },
];
const recommendations = [
  { text: "La mayoría de tus frutos están saludables. Continúa revisando su estado con frecuencia.", kind: "positive" },
  { text: "Se detectaron signos de deterioro en algunos frutos. Revisa el almacenamiento y la ventilación.", kind: "warning" },
  { text: "Realiza escaneos periódicos para recibir recomendaciones más precisas.", kind: "info" },
];

export function Current() {
  const [view, setView] = useState<View>("charts");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState(3);
  const [tasks, setTasks] = useState([
    { title: "Revisar los frutos almacenados", detail: "Comprueba que no presenten manchas o humedad.", done: false },
    { title: "Separar el mango detectado", detail: "Evita que el deterioro se propague a otros frutos.", done: true },
  ]);
  const days = useMemo(() => ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((name, i) => ({ name, number: 10 + i + weekOffset * 7 })), [weekOffset]);
  return <main className="activity-screen">
    <nav className="activity-toggle" aria-label="Actividad">
      <button className={view === "charts" ? "active" : ""} onClick={() => setView("charts")}><PieChart size={17}/>Gráficas</button>
      <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><List size={17}/>Lista</button>
      <button className={view === "agenda" ? "active" : ""} onClick={() => setView("agenda")}><CalendarDays size={17}/>Agenda</button>
    </nav>
    {view !== "agenda" && <section className="activity-heading"><BarChart3 size={30} color="#0f766e"/><h1>Tu actividad</h1><p>Consulta el historial y el estado de tus escaneos</p></section>}
    {view === "charts" && <Charts/>}
    {view === "list" && <ScanList/>}
    {view === "agenda" && <Agenda days={days} selected={selected} setSelected={setSelected} offset={weekOffset} setOffset={setWeekOffset} tasks={tasks} setTasks={setTasks}/>}
  </main>;
}

function Charts() { return <><section className="activity-card"><h2>Estado de tus frutos</h2><div className="chart-row"><div className="donut"/><div className="legend"><span><i className="dot" style={{background:"#16877e"}}/>Saludable 58%</span><span><i className="dot" style={{background:"#c75c4b"}}/>Deteriorado 20%</span><span><i className="dot" style={{background:"#f6d365"}}/>En observación 13%</span><span><i className="dot" style={{background:"#9b8afb"}}/>Otros 9%</span></div></div></section><section className="activity-card"><h2>Escaneos por fruto</h2><div className="bars"><i className="bar" style={{height:"92%"}}/><i className="bar" style={{height:"68%"}}/><i className="bar" style={{height:"46%"}}/><i className="bar" style={{height:"32%"}}/></div><div className="bar-labels"><span>Aguacate</span><span>Limón</span><span>Mango</span><span>Guayaba</span></div></section><section className="activity-card"><h2>Resumen</h2><div className="scan-card"><BrainCircuit size={25} color="#16877e"/><div><strong>12 escaneos realizados</strong><small>En los últimos 30 días</small></div><span className="score">+18%</span></div><div className="scan-card"><ShieldAlert size={25} color="#c75c4b"/><div><strong>2 requieren atención</strong><small>Revisa los resultados recientes</small></div></div></section></> }
function ScanList() { return <section className="activity-card"><h2>Historial de escaneos</h2>{scans.map((scan) => <div className="scan-card" key={scan.date}><div className="fruit"><Leaf size={21} color={scan.score < 70 ? "#c75c4b" : "#16877e"}/></div><div><strong>{scan.fruit} · {scan.label}</strong><small>{scan.date}</small></div><span className={"score " + (scan.score < 70 ? "bad" : "")}>{scan.score}%</span></div>)}</section> }
function Agenda({days, selected, setSelected, offset, setOffset, tasks, setTasks}: {days: {name:string,number:number}[],selected:number,setSelected:(n:number)=>void,offset:number,setOffset:(n:number)=>void,tasks:{title:string,detail:string,done:boolean}[],setTasks:React.Dispatch<React.SetStateAction<{title:string,detail:string,done:boolean}[]>>}) {
 return <><section className="activity-heading"><BrainCircuit size={30} color="#0f766e"/><h1>Recomendaciones</h1><p>Análisis y acciones sugeridas basadas en tus escaneos</p></section><section className="activity-card calendar"><div className="calendar-head"><button onClick={()=>setOffset(offset-1)}><ChevronLeft size={19}/></button><span>junio 2024</span><button onClick={()=>setOffset(offset+1)}><ChevronRight size={19}/></button></div><div className="week">{days.map((d,i)=><button className={"day "+(selected===i?"selected":"")} onClick={()=>setSelected(i)} key={d.name}><b>{d.number}</b>{d.name}</button>)}</div></section><div className="section-label">Mis Tareas Personales</div><button className="action"><Plus size={18}/>Agregar Tarea</button><section className="activity-card">{tasks.map((task,i)=><div className="task" key={task.title}><button onClick={()=>setTasks(old=>old.map((t,j)=>j===i?{...t,done:!t.done}:t))}>{task.done?<CheckCircle2 size={21}/>:<span style={{display:"block",width:18,height:18,border:"2px solid #16877e",borderRadius:"50%"}}/>}</button><div><p style={{textDecoration:task.done?"line-through":"none"}}>{task.title}</p><small>{task.detail}</small></div></div>)}</section><div className="section-label">Recomendaciones</div><section className="activity-card">{recommendations.map((rec,i)=><div className={"recommendation "+(rec.kind==="info"?"info":rec.kind==="warning"?"warning":"")} key={i}>{rec.text}</div>)}</section></>
}