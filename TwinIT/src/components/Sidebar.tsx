"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BrainCircuit, ChartNoAxesCombined, FileText, Gauge, GitCompareArrows, Lightbulb, Settings2, MessageCircle, Database } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Overview", icon: Gauge },
  { href: "/chat", label: "AI analyst", icon: MessageCircle },
  { href: "/data", label: "Business data", icon: Database },
  { href: "/simulations", label: "Simulation lab", icon: GitCompareArrows },
  { href: "/forecasts", label: "Forecasts", icon: ChartNoAxesCombined },
  { href: "/recommendations", label: "AI insights", icon: Lightbulb },
  { href: "/reports", label: "Reports", icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  return <aside className="sidebar">
    <Link href="/dashboard" className="brand"><span className="brand-mark"><BrainCircuit size={22}/></span><span>Twin<span className="brand-accent">IT</span><small>BUSINESS DIGITAL TWIN</small></span></Link>
    <div className="nav-caption">WORKSPACE</div>
    <nav className="nav-list">{links.map(({href,label,icon:Icon}) => <Link key={href} href={href} className={`nav-link ${pathname === href ? "active" : ""}`}><Icon size={18}/><span>{label}</span>{href === "/recommendations" && <span className="nav-new">AI</span>}</Link>)}</nav>
    <div className="sidebar-bottom"><div className="live-status"><span className="status-dot"/><div><b>Digital twin active</b><small>Using your business profile</small></div></div><Link href="/onboarding" className="nav-link"><Settings2 size={18}/>Business settings</Link><p className="sidebar-foot">TwinIT · Simulate smarter.<br/>Decide better.</p></div>
  </aside>;
}
