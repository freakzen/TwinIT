import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
export default function MetricCard({title,value,detail,icon:Icon,tone="violet",trend}:{title:string;value:string;detail:string;icon:LucideIcon;tone?:string;trend?:"up"|"down"}) {
 return <article className="metric-card"><div className="metric-top"><span className={`metric-icon ${tone}`}><Icon size={19}/></span>{trend && <span className={`trend ${trend}`}>{trend==="up"?<ArrowUpRight size={14}/>:<ArrowDownRight size={14}/>} {trend==="up"?"Positive":"Monitor"}</span>}</div><p className="metric-title">{title}</p><div className="metric-value">{value}</div><p className="metric-detail">{detail}</p></article>;
}
