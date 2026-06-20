import { useState, useEffect, useCallback, useRef } from "react";
import { T, TECHNIQUES, CHAIN, MODELS, CAMPAIGNS, IOCS, COPILOT_ANSWERS } from "../data/projectData.js";
import { SEED_ALERTS } from "../data/alerts.js";
import { TWIN_LIST } from "../data/twins.js";
import { rand, randInt, pick, f1, f2, pct, mkAlert } from "../utils/helpers.js";

// ─── Reusable components ──────────────────────────────────────────────────────
const Badge = ({label, color=T.blue, bg=T.blueLight, style={}}) => (
  <span style={{
    display:"inline-block", padding:"2px 9px", borderRadius:4,
    fontSize:11, fontWeight:500, background:bg, color, whiteSpace:"nowrap",
    letterSpacing:"0.01em",
    border:`1px solid ${color}33`,
    ...style,
  }}>{label}</span>
);

const SEV_MAP = {
  Critical:{ bg:"#FDECEA", fg:T.red    },
  High:    { bg:"#FEF3C7", fg:T.amber  },
  Medium:  { bg:"#EEE9FB", fg:T.purple },
  Low:     { bg:T.slateLight, fg:T.slate},
};

const SevBadge = ({sev}) => {
  const m = SEV_MAP[sev]||SEV_MAP.Low;
  return <Badge label={sev} color={m.fg} bg={m.bg}/>;
};

const StatusBadge = ({s}) => {
  const m = s==="Blocked"?{bg:"#FDECEA",fg:T.red}:s==="Quarantined"?{bg:"#FEF3C7",fg:T.amber}:{bg:T.tealLight,fg:T.teal};
  return <Badge label={s} color={m.fg} bg={m.bg}/>;
};

function MiniSparkline({data, color, w=100, h=30}) {
  if (!data||data.length<2) return null;
  const mn=Math.min(...data), mx=Math.max(...data), rng=mx-mn||0.01;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-2-((v-mn)/rng)*(h-6)}`).join(" ");
  const lx=w, ly=h-2-((data[data.length-1]-mn)/rng)*(h-6);
  return (
    <svg width={w} height={h} style={{display:"block",overflow:"visible"}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={lx} cy={ly} r="2.5" fill={color}/>
    </svg>
  );
}

function ProgressBar({value, max=1, color=T.blue, height=5}) {
  return (
    <div style={{background:"rgba(255,255,255,0.06)", borderRadius:99, height, width:"100%", overflow:"hidden"}}>
      <div style={{width:`${Math.min(100,(value/max)*100)}%`, height:"100%", background:`linear-gradient(90deg, ${color}, ${T.blue})`, borderRadius:99, transition:"width 0.5s ease", boxShadow:`0 0 16px ${color}66`}}/>
    </div>
  );
}

function Card({children, style={}}) {
  return (
    <div style={{
      background:`linear-gradient(180deg, rgba(17,27,43,0.96), rgba(9,15,25,0.96))`,
      border:`1px solid ${T.border}`,
      borderRadius:8,
      boxShadow:"0 18px 50px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.04)",
      backdropFilter:"blur(16px)",
      ...style
    }}>
      {children}
    </div>
  );
}

function CardHeader({title, sub, right}) {
  return (
    <div style={{padding:"14px 18px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
      <div>
        <div style={{fontSize:13, fontWeight:700, color:T.textPrimary, letterSpacing:"0.01em"}}>{title}</div>
        {sub && <div style={{fontSize:11, color:T.textMuted, marginTop:2}}>{sub}</div>}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

const ICON_MARKS = {
  "ti-alert-triangle": "!",
  "ti-bell": "AL",
  "ti-users": "TW",
  "ti-cpu": "AI",
};

function MetricCard({icon, label, value, sub, subColor=T.textMuted, iconBg, iconColor}) {
  return (
    <Card>
      <div style={{padding:"16px 18px"}}>
        <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10}}>
          <div style={{width:36, height:36, borderRadius:8, background:iconBg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, border:`1px solid ${iconColor}55`, boxShadow:`0 0 24px ${iconColor}22`}}>
            <span style={{fontSize:12, color:iconColor, fontWeight:900, letterSpacing:"0.03em"}}>{ICON_MARKS[icon]||"SP"}</span>
          </div>
        </div>
        <div style={{fontSize:11, color:T.textMuted, marginBottom:4, fontWeight:500, letterSpacing:"0.02em"}}>{label}</div>
        <div style={{fontSize:24, fontWeight:700, color:T.textPrimary, lineHeight:1}}>{value}</div>
        {sub && <div style={{fontSize:11, color:subColor, marginTop:5}}>{sub}</div>}
      </div>
    </Card>
  );
}

function Btn({onClick, children, variant="default", disabled=false, style={}}) {
  const styles = {
    default: {bg:"rgba(255,255,255,0.03)", border:`1px solid ${T.borderMid}`, color:T.textPrimary},
    primary: {bg:`linear-gradient(135deg, ${T.red}, #2563EB)`, border:`1px solid ${T.red}`, color:"#fff"},
    danger:  {bg:T.redLight, border:`1px solid #f5b7bb`, color:T.red},
    ghost:   {bg:"transparent", border:"1px solid transparent", color:T.textSecondary},
  };
  const s = styles[variant]||styles.default;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display:"inline-flex", alignItems:"center", gap:6,
      padding:"7px 14px", fontSize:12, fontWeight:500,
      background: disabled ? T.bg : s.bg,
      border: disabled ? `1px solid ${T.border}` : s.border,
      color: disabled ? T.textMuted : s.color,
      borderRadius:7, cursor: disabled?"not-allowed":"pointer",
      transition:"all 0.15s", boxShadow:variant==="primary"?"0 12px 26px rgba(239,35,60,0.22)":"none", ...style,
    }}>{children}</button>
  );
}

function AgentTag({name}) {
  const c = name==="Responder"?{bg:"#FDECEA",fg:T.red}:name==="Attributor"?{bg:T.purpleLight,fg:T.purple}:name==="Correlator"?{bg:"#FEF3C7",fg:T.amber}:{bg:T.blueLight,fg:T.blue};
  return <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:4,background:c.bg,color:c.fg,flexShrink:0}}>{name}</span>;
}

// ─── Attack chain ─────────────────────────────────────────────────────────────
function ChainViz({step}) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:0, overflowX:"auto", paddingBottom:2}}>
      {CHAIN.map((s,i) => {
        const done=i<step, active=i===step;
        return (
          <div key={i} style={{display:"flex", alignItems:"center", flexShrink:0}}>
            <div style={{
              padding:"5px 11px", fontSize:11, fontWeight:active?600:400,
              borderRadius:5, whiteSpace:"nowrap",
              background:active?T.redLight:done?T.amberLight:T.bg,
              border:`1px solid ${active?"#f5b7bb":done?"#fcd34d":T.border}`,
              color:active?T.red:done?T.amber:T.textMuted,
            }}>
              {active&&<span style={{marginRight:3}}>›</span>}{s}
            </div>
            {i<CHAIN.length-1&&<div style={{width:12,height:1,background:done?"#fcd34d":T.border,flexShrink:0}}/>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Gauge ────────────────────────────────────────────────────────────────────
function RiskGauge({score}) {
  const r=42,cx=52,cy=52,circ=2*Math.PI*r,arc=circ*0.72,fill=arc*(score/10);
  const c=score>=8?T.red:score>=6?T.amber:score>=4?T.teal:T.green;
  return (
    <svg width={104} height={80} viewBox="0 0 104 86">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth="7"
        strokeDasharray={`${arc} ${circ-arc}`} strokeLinecap="round" transform={`rotate(-216 ${cx} ${cy})`}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth="7"
        strokeDasharray={`${fill} ${circ-fill}`} strokeLinecap="round" transform={`rotate(-216 ${cx} ${cy})`}
        style={{transition:"all 0.6s ease"}}/>
      <text x={cx} y={cx+4} textAnchor="middle" fontSize="19" fontWeight="700" fill={T.textPrimary} fontFamily="system-ui">{f1(score)}</text>
      <text x={cx} y={cx+18} textAnchor="middle" fontSize="10" fill={T.textMuted} fontFamily="system-ui">/10</text>
    </svg>
  );
}

function WebThreatMap({alerts}) {
  const nodes = [
    {id:"core", x:50, y:50, r:7, color:T.red, label:"CORE"},
    {id:"id", x:28, y:28, r:4, color:T.blue, label:"ID"},
    {id:"cloud", x:72, y:24, r:4, color:T.teal, label:"CLOUD"},
    {id:"db", x:78, y:68, r:5, color:T.amber, label:"DB"},
    {id:"fin", x:25, y:72, r:5, color:T.purple, label:"FIN"},
    {id:"edge", x:50, y:16, r:3, color:T.green, label:"EDGE"},
    {id:"ops", x:12, y:50, r:3, color:T.blue, label:"OPS"},
    {id:"c2", x:88, y:48, r:4, color:T.red, label:"C2"},
  ];
  const links = [["core","id"],["core","cloud"],["core","db"],["core","fin"],["core","edge"],["core","ops"],["core","c2"],["id","edge"],["cloud","c2"],["fin","ops"],["db","c2"]];
  const byId = Object.fromEntries(nodes.map(n=>[n.id,n]));
  const critical = alerts.filter(a=>a.sev==="Critical").length;
  return (
    <Card style={{height:"100%", overflow:"hidden"}}>
      <CardHeader
        title="Spider-web threat fabric"
        sub="Identity, endpoint, cloud, database, and C2 relationships"
        right={<Badge label={`${critical} critical paths`} color={T.red} bg={T.redLight}/>}
      />
      <div style={{position:"relative",height:278,padding:14}}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:"absolute",inset:0}}>
          <defs>
            <radialGradient id="webGlow" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#EF233C" stopOpacity="0.26"/>
              <stop offset="52%" stopColor="#38BDF8" stopOpacity="0.08"/>
              <stop offset="100%" stopColor="#05070D" stopOpacity="0"/>
            </radialGradient>
          </defs>
          <rect width="100" height="100" fill="url(#webGlow)"/>
          {[18,32,46,60].map((r,i)=>(
            <polygon key={r} points={`50,${50-r} ${50+r*0.86},${50-r*0.5} ${50+r*0.86},${50+r*0.5} 50,${50+r} ${50-r*0.86},${50+r*0.5} ${50-r*0.86},${50-r*0.5}`} fill="none" stroke={i===2?"rgba(239,35,60,0.22)":"rgba(125,211,252,0.12)"} strokeWidth="0.45"/>
          ))}
          {links.map(([a,b],i)=>(
            <line key={`${a}-${b}`} x1={byId[a].x} y1={byId[a].y} x2={byId[b].x} y2={byId[b].y} stroke={i%3===0?"rgba(239,35,60,0.62)":"rgba(125,211,252,0.32)"} strokeWidth={i%3===0?"0.75":"0.45"} strokeDasharray={i%3===0?"2 2":"none"}/>
          ))}
          {nodes.map(n=>(
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={n.r+3} fill={n.color} opacity="0.12"/>
              <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} opacity="0.92"/>
              <circle cx={n.x} cy={n.y} r={n.r+1.8} fill="none" stroke={n.color} strokeOpacity="0.45" strokeWidth="0.6"/>
            </g>
          ))}
        </svg>
        <div style={{position:"absolute",left:18,right:18,bottom:14,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {[
            {l:"Web density",v:"87%",c:T.blue},
            {l:"Attack paths",v:"14",c:T.red},
            {l:"Trust edges",v:"3.2K",c:T.teal},
          ].map(s=>(
            <div key={s.l} style={{padding:"9px 10px",border:`1px solid ${s.c}44`,background:"rgba(5,7,13,0.72)",borderRadius:7}}>
              <div style={{fontSize:10,color:T.textMuted,marginBottom:2}}>{s.l}</div>
              <div style={{fontSize:18,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function AnalyticsChart({title, sub, data, color=T.blue, value, suffix=""}) {
  const w=240, h=78, max=Math.max(...data), min=Math.min(...data), rng=max-min||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-8-((v-min)/rng)*(h-18)}`).join(" ");
  const area=`0,${h} ${pts} ${w},${h}`;
  return (
    <Card>
      <div style={{padding:"14px 16px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:8}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:T.textPrimary}}>{title}</div>
            <div style={{fontSize:10,color:T.textMuted,marginTop:2}}>{sub}</div>
          </div>
          <div style={{fontSize:20,fontWeight:800,color,lineHeight:1}}>{value}<span style={{fontSize:11,color:T.textMuted,fontWeight:500}}>{suffix}</span></div>
        </div>
        <svg width="100%" height="82" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          <polygon points={area} fill={color} opacity="0.12"/>
          <polyline points={pts} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          {data.map((v,i)=>i%3===0?(
            <circle key={i} cx={(i/(data.length-1))*w} cy={h-8-((v-min)/rng)*(h-18)} r="2" fill={color}/>
          ):null)}
        </svg>
      </div>
    </Card>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,   setTab]   = useState("dashboard");
  const [alerts,setAlerts]= useState(SEED_ALERTS);
  const [selAlert, setSelAlert]  = useState(null);
  const [twinSel,  setTwinSel]   = useState(TWIN_LIST[0]);
  const [chainStep,setChainStep] = useState(5);
  const [simRun,   setSimRun]    = useState(false);
  const [agentLog, setAgentLog]  = useState([]);
  const [contained,setContained] = useState(2);
  const [modelRows,setModelRows] = useState(MODELS);
  const [inferRun, setInferRun]  = useState(false);
  const [cpInput,  setCpInput]   = useState("");
  const [cpHistory,setCpHistory] = useState([{role:"assistant",text:"Hello. I'm the Sentinel Prime AI Analyst.\n\nTry: summarize · hunt · report\nOr ask any security question."}]);
  const [cpLoading,setCpLoading] = useState(false);
  const [metrics,  setMetrics]   = useState({eps:14820,twins:847,blocked:231,acc:99.61});
  const [pulse,    setPulse]     = useState(false);
  const [viewportW,setViewportW] = useState(typeof window==="undefined" ? 1440 : window.innerWidth);
  const chatRef = useRef(null);
  const compact = viewportW < 760;
  const mid = viewportW < 1180;
  const metricCols = compact ? "1fr" : mid ? "repeat(2,1fr)" : "repeat(4,1fr)";
  const heroCols = compact ? "1fr" : "1.02fr 0.98fr";
  const splitCols = compact ? "1fr" : "1fr 1fr";

  // Live ticker
  useEffect(()=>{
    const iv=setInterval(()=>{
      setMetrics(m=>({
        eps: Math.max(8000,Math.round(m.eps+randInt(-300,500))),
        twins: Math.max(800,m.twins+randInt(-1,2)),
        blocked: m.blocked+(Math.random()>0.65?1:0),
        acc: Math.min(99.99,parseFloat((m.acc+rand(-0.018,0.018)).toFixed(2))),
      }));
      if (Math.random()>0.82) {
        const sev=pick(["Critical","High","Medium","Low"]);
        setAlerts(a=>[mkAlert(sev),...a.slice(0,29)]);
        if (sev==="Critical"||sev==="High"){ setPulse(true); setTimeout(()=>setPulse(false),900); }
      }
    },2400);
    return ()=>clearInterval(iv);
  },[]);

  useEffect(()=>{
    const onResize=()=>setViewportW(window.innerWidth);
    window.addEventListener("resize",onResize);
    return ()=>window.removeEventListener("resize",onResize);
  },[]);

  // Scroll chat to bottom
  useEffect(()=>{ if(chatRef.current) chatRef.current.scrollTop=chatRef.current.scrollHeight; },[cpHistory,cpLoading]);

  // Attack simulation
  const runSim = useCallback(()=>{
    if (simRun) return;
    setSimRun(true); setChainStep(0); setAgentLog([]);
    const steps=[
      {step:0,agent:"Hunter",    msg:"Twin delta 0.94 flagged on john.doe — deviation exceeds 3σ threshold"},
      {step:1,agent:"Hunter",    msg:"Hypothesis generated: phishing-initiated credential access chain"},
      {step:2,agent:"Correlator",msg:"Correlating 847 related events across 3 entities — 94% match"},
      {step:3,agent:"Correlator",msg:"MITRE kill chain confirmed: T1566 → T1003 → T1021.001"},
      {step:4,agent:"Attributor",msg:"TTP fingerprint matches APT29 (Cozy Bear) at 91.4% confidence"},
      {step:5,agent:"Attributor",msg:"Linked to campaign COZY-BEAR-2024-03, active for 4 days"},
      {step:6,agent:"Responder", msg:"Isolating WS-FINANCE-01 via CrowdStrike EDR API — success"},
      {step:7,agent:"Responder", msg:"Revoking john.doe sessions via Okta identity platform — done"},
      {step:8,agent:"Responder", msg:"Blocking 185.220.0.0/16 on Palo Alto NGFW — rule applied"},
      {step:9,agent:"Responder", msg:"✓ Contained in 23 seconds · Evidence preserved to MinIO"},
    ];
    steps.forEach(({step,agent,msg},i)=>{
      setTimeout(()=>{
        setChainStep(Math.min(step,7));
        setAgentLog(l=>[...l,{agent,msg,t:new Date()}]);
        if (i===steps.length-1){ setSimRun(false); setContained(c=>c+1); setAlerts(a=>[mkAlert("Critical"),...a]); }
      },i*850);
    });
  },[simRun]);

  // Copilot
  const sendCopilot = useCallback(()=>{
    const msg=cpInput.trim(); if(!msg) return;
    setCpInput(""); setCpHistory(h=>[...h,{role:"user",text:msg}]); setCpLoading(true);
    setTimeout(()=>{
      const key=msg.toLowerCase().includes("hunt")?"hunt":msg.toLowerCase().includes("report")?"report":"summarize";
      setCpHistory(h=>[...h,{role:"assistant",text:COPILOT_ANSWERS[key]}]);
      setCpLoading(false);
    },1100);
  },[cpInput]);

  // Inference
  const runInfer = useCallback(()=>{
    setInferRun(true);
    MODELS.forEach((_,i)=>{
      setTimeout(()=>{
        setModelRows(ms=>ms.map((m,mi)=>mi===i?{...m,acc:parseFloat((m.acc+rand(-0.12,0.06)).toFixed(2))}:m));
        if(i===MODELS.length-1) setInferRun(false);
      },i*200);
    });
  },[]);

  const critN = alerts.filter(a=>a.sev==="Critical").length;
  const highN = alerts.filter(a=>a.sev==="High").length;
  const medN  = alerts.filter(a=>a.sev==="Medium").length;

  const NAV=[
    {id:"dashboard", icon:"ti-layout-dashboard", label:"Dashboard"},
    {id:"twins",     icon:"ti-users",             label:"Twin Engine"},
    {id:"models",    icon:"ti-cpu",               label:"AI Models"},
    {id:"intel",     icon:"ti-radar",             label:"Threat Intel"},
    {id:"copilot",   icon:"ti-message-chatbot",   label:"AI Copilot"},
  ];

  return (
    <div style={{
      display:"flex",
      flexDirection:compact?"column":"row",
      height:"100vh",
      overflow:"hidden",
      background:`
        radial-gradient(circle at 18% 8%, rgba(239,35,60,0.18), transparent 28%),
        radial-gradient(circle at 78% 24%, rgba(56,189,248,0.13), transparent 30%),
        linear-gradient(135deg, #05070D 0%, #07111F 48%, #0A0F18 100%)
      `,
      fontFamily:"Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      fontSize:13,
      color:T.textPrimary
    }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width:compact?"100%":238,
        height:compact?88:"auto",
        flexShrink:0,
        background:"rgba(5,7,13,0.92)",
        borderRight:compact?"none":`1px solid ${T.border}`,
        borderBottom:compact?`1px solid ${T.border}`:"none",
        display:"flex",
        flexDirection:compact?"row":"column",
        alignItems:compact?"center":"stretch",
        overflow:"hidden",
        boxShadow:compact?"0 14px 38px rgba(0,0,0,0.22)":"18px 0 60px rgba(0,0,0,0.28)"
      }}>
        {/* Logo */}
        <div style={{padding:compact?"12px 12px":"18px 16px 14px", borderBottom:compact?"none":`1px solid rgba(255,255,255,0.07)`, flexShrink:0}}>
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <div style={{width:36,height:36,borderRadius:8,background:"linear-gradient(135deg, rgba(239,35,60,0.28), rgba(56,189,248,0.18))",border:`1px solid ${T.borderMid}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 0 30px rgba(239,35,60,0.22)"}}>
              <span style={{fontSize:12,fontWeight:900,color:T.red,letterSpacing:"0.04em"}}>SP</span>
            </div>
            <div style={{display:compact && viewportW<430?"none":"block"}}>
              <div style={{fontSize:13,fontWeight:800,color:"#F8FAFC",letterSpacing:"0.02em"}}>Sentinel Prime</div>
              <div style={{fontSize:10,color:T.red,marginTop:1,fontFamily:"'Courier New',monospace"}}>WEB-OPS v2.1</div>
            </div>
          </div>
        </div>

        {/* Live pulse */}
        <div style={{padding:compact?"0 10px":"10px 16px", borderBottom:compact?"none":`1px solid rgba(255,255,255,0.05)`, display:compact && viewportW<560?"none":"flex", alignItems:"center", gap:8, flexShrink:0}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:T.green,display:"inline-block",flexShrink:0,boxShadow:`0 0 14px ${T.green}`}}/>
          <span style={{fontSize:11,color:T.textSecondary,fontFamily:"'Courier New',monospace"}}>{metrics.eps.toLocaleString()} events / sec</span>
        </div>

        {/* Nav */}
        <nav style={{padding:compact?"8px 8px":"10px 8px",flex:1,overflowY:compact?"hidden":"auto",overflowX:compact?"auto":"hidden",display:compact?"flex":"block",alignItems:"center",gap:6}}>
          {!compact && <div style={{fontSize:10,fontWeight:600,color:"#475569",letterSpacing:"0.08em",padding:"4px 10px 8px"}}>NAVIGATION</div>}
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{
              display:"flex", alignItems:"center", gap:10, width:"100%",
              padding:compact?"9px 12px":"9px 12px", borderRadius:7, marginBottom:compact?0:1,
              minWidth:compact?118:"auto",
              background: tab===n.id?"linear-gradient(90deg, rgba(239,35,60,0.20), rgba(56,189,248,0.08))":"transparent",
              border: tab===n.id?`1px solid ${T.border}`:"1px solid transparent",
              color: tab===n.id?T.sideActive:T.sideText,
              fontSize:13, fontWeight:tab===n.id?500:400, cursor:"pointer", textAlign:"left",
              transition:"all 0.15s",
            }}>
              <i className={`ti ${n.icon}`} style={{fontSize:16,width:18,flexShrink:0}} aria-hidden="true"/>
              {n.label}
              {n.id==="dashboard" && critN>0 && (
                <span style={{marginLeft:"auto",background:"rgba(220,53,69,0.25)",color:"#FCA5A5",fontSize:10,fontWeight:600,padding:"2px 6px",borderRadius:10}}>{critN}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom counters */}
        <div style={{display:compact?"none":"block",padding:"12px 12px", borderTop:`1px solid rgba(255,255,255,0.06)`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[
              {l:"Accuracy",  v:metrics.acc.toFixed(1)+"%"},
              {l:"Contained", v:String(contained)},
              {l:"Blocked",   v:String(metrics.blocked)},
              {l:"Twins",     v:String(metrics.twins)},
            ].map(s=>(
              <div key={s.l} style={{background:"rgba(255,255,255,0.045)",border:`1px solid ${T.border}`,borderRadius:7,padding:"8px 10px"}}>
                <div style={{fontSize:10,color:"#64748B",marginBottom:2}}>{s.l}</div>
                <div style={{fontSize:13,fontWeight:600,color:"#E2E8F0"}}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* ── TOPBAR ── */}
        <header style={{height:compact?52:58,background:"rgba(7,11,18,0.76)",backdropFilter:"blur(18px)",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",padding:compact?"0 12px":"0 20px",gap:12,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <i className={`ti ${NAV.find(n=>n.id===tab)?.icon||"ti-layout-dashboard"}`} style={{fontSize:16,color:T.red}} aria-hidden="true"/>
            <span style={{fontSize:14,fontWeight:600,color:T.textPrimary}}>{NAV.find(n=>n.id===tab)?.label}</span>
          </div>
          <div style={{flex:1}}/>
          {/* Alert pill */}
          <div style={{
            display:"flex",alignItems:"center",gap:7,
            padding:"5px 13px", borderRadius:20,
            background: pulse?T.redLight:"rgba(255,255,255,0.04)",
            border:`1px solid ${pulse?"#f5b7bb":T.border}`,
            fontSize:12, color:pulse?T.red:T.textSecondary,
            transition:"all 0.3s",
            maxWidth:compact?180:"none",
            whiteSpace:"nowrap",
            overflow:"hidden",
            textOverflow:"ellipsis",
          }}>
            <span style={{width:7,height:7,borderRadius:"50%",background:pulse?T.red:T.green,display:"inline-block",flexShrink:0,boxShadow:`0 0 14px ${pulse?T.red:T.green}`}}/>
            {pulse ? "New alert incoming" : `${critN} critical · ${highN} high · ${medN} medium`}
          </div>
          {/* Avatar */}
          <div style={{width:32,height:32,borderRadius:"50%",background:T.blueLight,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",border:`1px solid ${T.borderMid}`}}>
            <i className="ti ti-user" style={{fontSize:15,color:T.blue}} aria-hidden="true"/>
          </div>
        </header>

        {/* ── PAGE CONTENT ── */}
        <div style={{flex:1,overflow:"auto",padding:compact?12:20,position:"relative"}}>

          {/* ════════════════ DASHBOARD ════════════════ */}
          {tab==="dashboard" && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>

              {/* Command hero */}
              <div style={{display:"grid",gridTemplateColumns:heroCols,gap:14,alignItems:"stretch"}}>
                <Card style={{overflow:"hidden",position:"relative",minHeight:320}}>
                  <div style={{
                    position:"absolute",
                    inset:0,
                    opacity:0.7,
                    background:`
                      linear-gradient(90deg, rgba(239,35,60,0.18) 1px, transparent 1px),
                      linear-gradient(0deg, rgba(56,189,248,0.10) 1px, transparent 1px)
                    `,
                    backgroundSize:"34px 34px"
                  }}/>
                  <div style={{position:"relative",padding:compact?"18px 16px":"22px 24px",height:"100%",display:"flex",flexDirection:"column",justifyContent:"space-between",gap:18}}>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:13}}>
                        <Badge label="LIVE SECURITY WEB" color={T.red} bg={T.redLight}/>
                        <Badge label="HACKER MODE" color={T.green} bg={T.greenLight}/>
                      </div>
                      <div style={{fontSize:compact?24:30,fontWeight:900,lineHeight:1.08,color:T.textPrimary,letterSpacing:0,maxWidth:560}}>
                        Web-sense command center for active threat hunting
                      </div>
                      <div style={{fontSize:13,color:T.textSecondary,lineHeight:1.7,marginTop:10,maxWidth:620}}>
                        A dense SOC cockpit with live alerts, behavioral twins, attack-chain simulation, and relationship mapping across users, devices, IOCs, and cloud edges.
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:compact?"repeat(2,1fr)":"repeat(4,1fr)",gap:10}}>
                      {[
                        {l:"Risk velocity",v:"+21%",c:T.red},
                        {l:"C2 routes",v:"8",c:T.amber},
                        {l:"Protected nodes",v:"847",c:T.blue},
                        {l:"Contain SLA",v:"23s",c:T.green},
                      ].map(s=>(
                        <div key={s.l} style={{padding:"12px",border:`1px solid ${s.c}33`,background:"rgba(5,7,13,0.56)",borderRadius:7}}>
                          <div style={{fontSize:10,color:T.textMuted,marginBottom:5}}>{s.l}</div>
                          <div style={{fontSize:22,fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
                <WebThreatMap alerts={alerts}/>
              </div>

              {/* Metric cards */}
              <div style={{display:"grid",gridTemplateColumns:metricCols,gap:12}}>
                <MetricCard icon="ti-alert-triangle" label="Organization Risk"   value="8.4 / 10"              sub="↑ +2.1 from baseline" subColor={T.red}   iconBg={T.redLight}  iconColor={T.red}  />
                <MetricCard icon="ti-bell"           label="Critical Alerts"     value={String(critN)}         sub={`${highN} high, ${medN} medium`}         iconBg={T.amberLight} iconColor={T.amber}/>
                <MetricCard icon="ti-users"          label="Twins Monitored"     value={String(metrics.twins)} sub="3 anomalies active"   subColor={T.amber} iconBg={T.blueLight} iconColor={T.blue} />
                <MetricCard icon="ti-cpu"            label="AI Accuracy"         value={metrics.acc.toFixed(2)+"%"} sub="7-model ensemble"                  iconBg={T.greenLight} iconColor={T.green}/>
              </div>

              {/* Analytics charts */}
              <div style={{display:"grid",gridTemplateColumns:metricCols,gap:12}}>
                <AnalyticsChart title="Event throughput" sub="Last 48 minutes" data={[38,44,41,52,49,58,63,61,68,72,70,79]} color={T.blue} value={(metrics.eps/1000).toFixed(1)} suffix="K/s"/>
                <AnalyticsChart title="Risk pressure" sub="Twin drift index" data={[22,24,27,31,37,42,51,56,62,71,77,84]} color={T.red} value="8.4" suffix="/10"/>
                <AnalyticsChart title="Containment" sub="Automation success" data={[68,72,76,74,81,84,86,88,91,93,94,96]} color={T.green} value="96" suffix="%"/>
                <AnalyticsChart title="False positives" sub="Suppression trend" data={[48,43,39,34,32,28,25,22,19,15,12,8]} color={T.amber} value="7.8" suffix="%"/>
              </div>

              {/* Attack chain + alert feed */}
              <div style={{display:"grid",gridTemplateColumns:splitCols,gap:14}}>

                {/* Attack chain */}
                <Card>
                  <CardHeader
                    title="Live attack chain"
                    sub="APT29 · john.doe → WS-FINANCE-01"
                    right={
                      <Btn onClick={runSim} disabled={simRun} variant={simRun?"default":"danger"}>
                        <i className={`ti ${simRun?"ti-loader":"ti-player-play"}`} style={{fontSize:13}} aria-hidden="true"/>
                        {simRun?"Simulating…":"Simulate attack"}
                      </Btn>
                    }
                  />
                  <div style={{padding:"14px 16px"}}>
                    <div style={{overflowX:"auto",marginBottom:14}}>
                      <ChainViz step={chainStep}/>
                    </div>
                    <div style={{maxHeight:160,overflowY:"auto",display:"flex",flexDirection:"column",gap:0}}>
                      {agentLog.length===0 ? (
                        <div style={{padding:"28px 0",textAlign:"center",color:T.textMuted}}>
                          <i className="ti ti-player-play" style={{fontSize:22,display:"block",marginBottom:6}} aria-hidden="true"/>
                          <div style={{fontSize:12}}>Press "Simulate attack" to run the APT29 scenario</div>
                        </div>
                      ) : agentLog.map((l,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"flex-start",gap:9,padding:"7px 0",borderBottom:`1px solid ${T.border}`}}>
                          <AgentTag name={l.agent}/>
                          <span style={{fontSize:12,color:T.textPrimary,lineHeight:1.5,flex:1}}>{l.msg}</span>
                          <span style={{fontSize:10,color:T.textMuted,flexShrink:0,marginTop:1}}>{l.t.toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                {/* Alert feed */}
                <Card>
                  <CardHeader
                    title="Alert feed"
                    sub={`Live · updating every 2.4s`}
                    right={
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{width:7,height:7,borderRadius:"50%",background:pulse?T.red:"#34D399",display:"inline-block"}}/>
                        <span style={{fontSize:11,color:T.textMuted}}>{pulse?"New alert":"Live"}</span>
                      </div>
                    }
                  />
                  <div style={{maxHeight:278,overflowY:"auto"}}>
                    {alerts.slice(0,12).map(a=>(
                      <div key={a.id}
                        onClick={()=>setSelAlert(a.id===selAlert?.id?null:a)}
                        style={{
                          padding:"10px 16px",cursor:"pointer",
                          background:selAlert?.id===a.id?T.surfaceAlt:T.surface,
                          borderBottom:`1px solid ${T.border}`,
                          transition:"background 0.15s",
                        }}>
                        <div style={{display:"flex",alignItems:"center",gap:9}}>
                          <SevBadge sev={a.sev}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:500,color:T.textPrimary,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {a.user} — {a.tech.name}
                            </div>
                            <div style={{fontSize:11,color:T.textMuted}}>{a.device}</div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>{f1(a.score)}</div>
                            <div style={{fontSize:10,color:T.textMuted}}>{a.time.toLocaleTimeString()}</div>
                          </div>
                        </div>
                        {selAlert?.id===a.id && (
                          <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
                              <div>
                                <div style={{fontSize:10,color:T.textMuted,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.05em"}}>MITRE</div>
                                <div style={{fontSize:12,fontWeight:600,color:T.blue,fontFamily:"monospace"}}>{a.tech.id}</div>
                                <div style={{fontSize:11,color:T.textSecondary}}>{a.tech.tactic}</div>
                              </div>
                              <div>
                                <div style={{fontSize:10,color:T.textMuted,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.05em"}}>Actor</div>
                                <div style={{fontSize:12,fontWeight:500,color:a.actor?T.red:T.textMuted}}>{a.actor||"Unknown"}</div>
                                <div style={{fontSize:11,color:T.textSecondary}}>Conf: {(a.conf*100).toFixed(0)}%</div>
                              </div>
                              <div>
                                <div style={{fontSize:10,color:T.textMuted,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.05em"}}>Phase</div>
                                <div style={{fontSize:11,color:T.textPrimary}}>{a.phase}</div>
                                <div style={{fontSize:11,color:T.textMuted}}>Δ {f1(a.delta*10)}/10</div>
                              </div>
                            </div>
                            <div style={{display:"flex",gap:7}}>
                              <Btn onClick={()=>{setContained(c=>c+1);setSelAlert(null);}} variant="danger">
                                <i className="ti ti-bolt" style={{fontSize:12}} aria-hidden="true"/>Auto-contain
                              </Btn>
                              <Btn onClick={()=>setTab("copilot")}>
                                <i className="ti ti-message-chatbot" style={{fontSize:12}} aria-hidden="true"/>Investigate ↗
                              </Btn>
                              <Btn onClick={()=>setSelAlert(null)} variant="ghost">Dismiss</Btn>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Performance comparison */}
              <Card>
                <CardHeader title="Performance vs. industry baseline"/>
                <div style={{display:"grid",gridTemplateColumns:compact?"1fr":mid?"repeat(2,1fr)":"repeat(4,1fr)",gap:0}}>
                  {[
                    {metric:"Mean time to detect",    industry:"197 days",   sentinel:"4.3 min",  label:"99.9% faster"},
                    {metric:"False positive rate",     industry:"45% ignored",sentinel:"< 8%",     label:"73% reduction"},
                    {metric:"Alert triage time",       industry:"45 min",    sentinel:"3 min",    label:"93% faster"},
                    {metric:"Autonomous containment",  industry:"Hours",     sentinel:"23 sec",   label:"Fully automated"},
                  ].map((m,i)=>(
                    <div key={m.metric} style={{padding:"16px 20px",borderRight:i<3?`1px solid ${T.border}`:"none"}}>
                      <div style={{fontSize:11,color:T.textMuted,marginBottom:10}}>{m.metric}</div>
                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        <div style={{fontSize:12,color:T.textMuted,textDecoration:"line-through"}}>{m.industry}</div>
                        <div style={{fontSize:20,fontWeight:700,color:T.green}}>{m.sentinel}</div>
                        <div>
                          <span style={{fontSize:11,background:T.greenLight,color:T.green,padding:"2px 8px",borderRadius:4,fontWeight:500}}>{m.label}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ════════════════ TWIN ENGINE ════════════════ */}
          {tab==="twins" && (
            <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:14,alignItems:"start"}}>
              {/* List */}
              <Card>
                <CardHeader title="Entity twins" sub={`${TWIN_LIST.length} monitored`}/>
                <div style={{padding:"8px"}}>
                  {TWIN_LIST.map(u=>(
                    <button key={u.id} onClick={()=>setTwinSel(u)} style={{
                      display:"flex",alignItems:"center",gap:10,width:"100%",
                      padding:"9px 10px",borderRadius:7,marginBottom:2,
                      background:twinSel?.id===u.id?T.blueLight:"transparent",
                      border:`1px solid ${twinSel?.id===u.id?T.blue:"transparent"}`,
                      cursor:"pointer",textAlign:"left",
                    }}>
                      <div style={{width:32,height:32,borderRadius:"50%",background:u.anomaly?T.redLight:T.surfaceAlt,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${u.anomaly?"#f5b7bb":T.border}`}}>
                        <i className="ti ti-user" style={{fontSize:14,color:u.anomaly?T.red:T.textSecondary}} aria-hidden="true"/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:500,color:u.anomaly?T.red:T.textPrimary,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.id}</div>
                        <div style={{fontSize:10,color:T.textMuted}}>{u.dept}</div>
                      </div>
                      <div style={{flexShrink:0,textAlign:"right"}}>
                        <div style={{fontSize:13,fontWeight:700,color:u.risk>6?T.red:u.risk>4?T.amber:T.green}}>{f1(u.risk)}</div>
                        {u.anomaly&&<div style={{fontSize:9,color:T.red,marginTop:1}}>anomaly</div>}
                      </div>
                    </button>
                  ))}
                </div>
              </Card>

              {/* Detail */}
              {twinSel && (
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <Card>
                    <div style={{padding:"18px 20px"}}>
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:18}}>
                        <div style={{display:"flex",gap:14,alignItems:"center"}}>
                          <div style={{width:48,height:48,borderRadius:"50%",background:twinSel.anomaly?T.redLight:T.blueLight,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${twinSel.anomaly?"#f5b7bb":T.borderMid}`}}>
                            <i className="ti ti-user" style={{fontSize:22,color:twinSel.anomaly?T.red:T.blue}} aria-hidden="true"/>
                          </div>
                          <div>
                            <div style={{fontSize:16,fontWeight:700,color:twinSel.anomaly?T.red:T.textPrimary}}>{twinSel.id}</div>
                            <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{twinSel.dept} · Digital twin · 90-day baseline</div>
                            {twinSel.anomaly&&<Badge label="Anomaly detected" color={T.red} bg={T.redLight} style={{marginTop:6}}/>}
                          </div>
                        </div>
                        <div style={{textAlign:"right",background:T.surfaceAlt,borderRadius:8,padding:"10px 14px",border:`1px solid ${T.border}`}}>
                          <div style={{fontSize:28,fontWeight:700,color:twinSel.risk>6?T.red:T.green,lineHeight:1}}>{f1(twinSel.risk)}<span style={{fontSize:13,color:T.textMuted,fontWeight:400}}> / 10</span></div>
                          <div style={{fontSize:11,color:T.textMuted,marginTop:3}}>Risk score</div>
                        </div>
                      </div>

                      {/* 48h chart */}
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:11,color:T.textMuted,fontWeight:500,marginBottom:8}}>48-hour behavioral deviation history</div>
                        <div style={{background:T.surfaceAlt,borderRadius:8,padding:"12px 14px",border:`1px solid ${T.border}`}}>
                          <svg width="100%" height="72" viewBox="0 0 560 72" preserveAspectRatio="none">
                            {/* normal zone band */}
                            <rect x="0" y="50" width="560" height="18" fill={twinSel.anomaly?"#FEF3C7":"#E8F5EE"} opacity="0.7"/>
                            <line x1="0" y1="50" x2="560" y2="50" stroke={twinSel.anomaly?"#fcd34d":"#6EE7B7"} strokeWidth="0.5" strokeDasharray="4,3"/>
                            <text x="4" y="47" fontSize="9" fill={twinSel.anomaly?T.amber:T.green} fontFamily="system-ui">Normal zone</text>
                            {(()=>{
                              const d=twinSel.hist;
                              const pts=d.map((v,i)=>`${(i/(d.length-1))*560},${4+(1-v)*64}`).join(" ");
                              const col=twinSel.anomaly?T.red:T.blue;
                              const lx=560, ly=4+(1-d[d.length-1])*64;
                              return (<>
                                <polyline points={pts} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                                <circle cx={lx} cy={ly} r="4" fill={col} stroke={T.surface} strokeWidth="1.5"/>
                              </>);
                            })()}
                          </svg>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.textMuted,marginTop:4}}>
                            <span>48h ago</span><span>24h ago</span><span>Now</span>
                          </div>
                        </div>
                      </div>

                      {/* Dimension bars */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 20px"}}>
                        {twinSel.dims.map(d=>{
                          const col=d.v>0.7&&twinSel.anomaly?T.red:d.v>0.55?T.amber:T.blue;
                          return (
                            <div key={d.label}>
                              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                                <span style={{fontSize:11,color:T.textSecondary}}>{d.label}</span>
                                <span style={{fontSize:11,fontWeight:600,color:col}}>{(d.v*100).toFixed(0)}%</span>
                              </div>
                              <ProgressBar value={d.v} max={1} color={col} height={5}/>
                            </div>
                          );
                        })}
                      </div>

                      {twinSel.anomaly&&(
                        <div style={{marginTop:16,background:T.redLight,border:`1px solid #f5b7bb`,borderRadius:8,padding:"12px 14px"}}>
                          <div style={{fontSize:12,fontWeight:600,color:T.red,marginBottom:6,display:"flex",alignItems:"center",gap:7}}>
                            <i className="ti ti-alert-triangle" style={{fontSize:14}} aria-hidden="true"/>
                            Behavioral anomaly — twin delta 0.94
                          </div>
                          <div style={{fontSize:12,color:"#7F1D1D",lineHeight:1.65}}>
                            Login at 02:47 AM — 340% outside 90-day window. 14 new devices in 6 minutes (baseline: 1.2/week). 91.4% match to APT29 lateral movement signature. Predicted blast radius: 23 systems within 2 hours.
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* ════════════════ AI MODELS ════════════════ */}
          {tab==="models" && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {/* Hero */}
              <Card>
                <div style={{padding:"20px 22px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:18}}>
                    <div>
                      <div style={{fontSize:15,fontWeight:700,color:T.textPrimary}}>AI Ensemble Engine</div>
                      <div style={{fontSize:12,color:T.textMuted,marginTop:3}}>7-model stacking architecture · SHAP explainability · &lt;10ms inference</div>
                    </div>
                    <Btn onClick={runInfer} disabled={inferRun}>
                      <i className={`ti ${inferRun?"ti-loader":"ti-refresh"}`} style={{fontSize:13}} aria-hidden="true"/>
                      {inferRun?"Scoring…":"Run inference"}
                    </Btn>
                  </div>
                  <div style={{display:"flex",alignItems:"baseline",gap:20,flexWrap:"wrap"}}>
                    <div>
                      <div style={{fontSize:44,fontWeight:800,color:T.green,lineHeight:1}}>{metrics.acc.toFixed(2)}<span style={{fontSize:22}}>%</span></div>
                      <div style={{fontSize:11,color:T.textMuted,marginTop:4}}>Ensemble accuracy</div>
                    </div>
                    <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                      {[{l:"Precision",v:"99.2%"},{l:"Recall",v:"99.6%"},{l:"F1",v:"0.994"},{l:"FP Rate",v:"7.8%"}].map(s=>(
                        <div key={s.l} style={{background:T.surfaceAlt,borderRadius:8,padding:"10px 14px",border:`1px solid ${T.border}`}}>
                          <div style={{fontSize:10,color:T.textMuted,marginBottom:3}}>{s.l}</div>
                          <div style={{fontSize:16,fontWeight:700,color:T.textPrimary}}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Model grid */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
                {modelRows.map(m=>{
                  const tagColor={Supervised:T.blue,Transformer:T.purple,"Deep Learning":T.teal,Unsupervised:T.amber,Meta:T.red}[m.tag]||T.slate;
                  const tagBg={Supervised:T.blueLight,Transformer:T.purpleLight,"Deep Learning":T.tealLight,Unsupervised:T.amberLight,Meta:T.redLight}[m.tag]||T.slateLight;
                  return (
                    <Card key={m.name}>
                      <div style={{padding:"16px 16px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>{m.name}</div>
                            <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{m.role}</div>
                          </div>
                          <Badge label={m.tag} color={tagColor} bg={tagBg}/>
                        </div>
                        <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:8}}>
                          <span style={{fontSize:22,fontWeight:700,color:T.green}}>{f2(m.acc)}</span>
                          <span style={{fontSize:12,color:T.textMuted}}>% accuracy</span>
                        </div>
                        <ProgressBar value={m.acc-96} max={4} color={T.green} height={4}/>
                        {inferRun&&(
                          <div style={{marginTop:8,height:2,background:T.border,borderRadius:1,overflow:"hidden"}}>
                            <div style={{height:"100%",background:T.blue,borderRadius:1,animation:"inferSlide 0.7s ease-in-out infinite alternate",width:"60%"}}/>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Confusion table */}
              <Card>
                <CardHeader title="Confusion matrix" sub="100,000-event simulation"/>
                <div style={{padding:"16px 20px"}}>
                  <div style={{display:"inline-grid",gridTemplateColumns:"110px 110px 110px 120px",gap:4}}>
                    {[
                      {t:"",bg:T.surface,tc:T.textMuted,fw:400},
                      {t:"Pred: Benign",bg:T.surfaceAlt,tc:T.textSecondary,fw:500},
                      {t:"Pred: Threat",bg:T.surfaceAlt,tc:T.textSecondary,fw:500},
                      {t:"",bg:T.surface,tc:T.textMuted,fw:400},
                      {t:"Actual: Benign",bg:T.surfaceAlt,tc:T.textSecondary,fw:500},
                      {t:"78,210 ✓",bg:T.greenLight,tc:T.green,fw:600},
                      {t:"6,270 ✗",bg:T.redLight,tc:T.red,fw:600},
                      {t:"FPR 7.4%",bg:T.surface,tc:T.amber,fw:500},
                      {t:"Actual: Threat",bg:T.surfaceAlt,tc:T.textSecondary,fw:500},
                      {t:"134 ✗",bg:T.amberLight,tc:T.amber,fw:600},
                      {t:"15,386 ✓",bg:T.greenLight,tc:T.green,fw:600},
                      {t:"FNR 0.86%",bg:T.surface,tc:T.red,fw:500},
                    ].map((c,i)=>(
                      <div key={i} style={{padding:"10px 12px",borderRadius:6,background:c.bg,border:`1px solid ${T.border}`,fontSize:12,fontWeight:c.fw,color:c.tc,textAlign:"center"}}>{c.t}</div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ════════════════ THREAT INTEL ════════════════ */}
          {tab==="intel" && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {/* Campaigns */}
              <Card>
                <CardHeader title="Active campaigns" sub={`${CAMPAIGNS.length} tracked`}/>
                <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:8}}>
                  {CAMPAIGNS.map(c=>{
                    const confColor=c.conf>85?T.red:c.conf>70?T.amber:T.green;
                    return (
                      <div key={c.id} style={{padding:"14px 16px",borderRadius:8,background:T.surfaceAlt,border:`1px solid ${T.border}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:600,color:T.textPrimary,fontFamily:"'Courier New',monospace"}}>{c.id}</div>
                            <div style={{fontSize:11,color:T.textMuted,marginTop:3}}>
                              Actor: <strong style={{color:T.textPrimary,fontWeight:500}}>{c.actor}</strong>
                              &nbsp;·&nbsp; Stage: <strong style={{color:T.textPrimary,fontWeight:500}}>{c.stage}</strong>
                              &nbsp;·&nbsp; Active {c.days} day{c.days!==1?"s":""}
                            </div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:18,fontWeight:700,color:confColor}}>{c.conf}%</div>
                            <div style={{fontSize:10,color:T.textMuted}}>attribution</div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                          {c.ttps.map(t=>(
                            <span key={t} style={{fontSize:10,padding:"2px 8px",background:T.blueLight,color:T.blue,borderRadius:4,fontFamily:"monospace",fontWeight:500}}>{t}</span>
                          ))}
                        </div>
                        <div style={{display:"flex",gap:18,fontSize:11,color:T.textSecondary}}>
                          <span>Systems affected: <strong style={{color:c.victims>0?T.red:T.green,fontWeight:600}}>{c.victims}</strong></span>
                          <ProgressBar value={c.conf} max={100} color={confColor} height={3}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* MITRE heatmap */}
              <Card>
                <CardHeader title="MITRE ATT&CK coverage" sub="8 techniques · auto-mapped"/>
                <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                  {TECHNIQUES.map(t=>{
                    const heat=rand(0.3,1);
                    const bg=heat>0.75?T.redLight:heat>0.5?T.amberLight:T.blueLight;
                    const fg=heat>0.75?T.red:heat>0.5?T.amber:T.blue;
                    return (
                      <div key={t.id} style={{padding:"12px 12px",borderRadius:8,background:bg,border:`1px solid ${T.border}`}}>
                        <div style={{fontSize:10,fontWeight:600,color:fg,fontFamily:"monospace",marginBottom:3}}>{t.id}</div>
                        <div style={{fontSize:12,fontWeight:500,color:T.textPrimary,marginBottom:2}}>{t.name}</div>
                        <div style={{fontSize:10,color:T.textMuted,marginBottom:7}}>{t.tactic}</div>
                        <ProgressBar value={heat} max={1} color={fg} height={4}/>
                        <div style={{fontSize:11,fontWeight:600,color:fg,marginTop:4}}>{(heat*100).toFixed(0)}% hit rate</div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* IOC table */}
              <Card>
                <CardHeader title="Indicators of compromise" sub={`${IOCS.length} active IOCs`}/>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead>
                      <tr style={{background:T.surfaceAlt}}>
                        {["Type","Indicator","Threat Actor","Confidence","Status"].map(h=>(
                          <th key={h} style={{padding:"9px 16px",textAlign:"left",fontSize:11,color:T.textMuted,fontWeight:500,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {IOCS.map((ioc,i)=>(
                        <tr key={i} style={{borderBottom:`1px solid ${T.border}`,transition:"background 0.1s"}}>
                          <td style={{padding:"11px 16px"}}>
                            <Badge label={ioc.type} color={T.blue} bg={T.blueLight}/>
                          </td>
                          <td style={{padding:"11px 16px",fontFamily:"'Courier New',monospace",color:T.textPrimary,fontSize:11}}>{ioc.val}</td>
                          <td style={{padding:"11px 16px",color:T.textSecondary}}>{ioc.actor}</td>
                          <td style={{padding:"11px 16px",fontWeight:600,color:T.green}}>{ioc.conf}%</td>
                          <td style={{padding:"11px 16px"}}><StatusBadge s={ioc.status}/></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ════════════════ AI COPILOT ════════════════ */}
          {tab==="copilot" && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 270px",gap:14,alignItems:"start"}}>
              {/* Chat */}
              <Card style={{display:"flex",flexDirection:"column",height:"calc(100vh - 120px)"}}>
                {/* Chat header */}
                <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:T.blueLight,border:`1px solid ${T.borderMid}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <i className="ti ti-robot" style={{fontSize:18,color:T.blue}} aria-hidden="true"/>
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>Sentinel AI Analyst</div>
                    <div style={{fontSize:11,color:T.green,display:"flex",alignItems:"center",gap:5,marginTop:1}}>
                      <span style={{width:6,height:6,borderRadius:"50%",background:T.green,display:"inline-block"}}/>
                      Online · GPT-4 + Security fine-tune
                    </div>
                  </div>
                  <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                    <Badge label={`${metrics.acc.toFixed(1)}% accuracy`} color={T.green} bg={T.greenLight}/>
                  </div>
                </div>

                {/* Messages area */}
                <div ref={chatRef} style={{flex:1,overflowY:"auto",padding:"16px 18px",display:"flex",flexDirection:"column",gap:14}}>
                  {cpHistory.map((m,i)=>(
                    <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",flexDirection:m.role==="user"?"row-reverse":"row"}}>
                      {m.role==="assistant"&&(
                        <div style={{width:30,height:30,borderRadius:"50%",background:T.blueLight,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${T.borderMid}`}}>
                          <i className="ti ti-robot" style={{fontSize:14,color:T.blue}} aria-hidden="true"/>
                        </div>
                      )}
                      {m.role==="user"&&(
                        <div style={{width:30,height:30,borderRadius:"50%",background:T.surfaceAlt,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${T.border}`}}>
                          <i className="ti ti-user" style={{fontSize:14,color:T.textSecondary}} aria-hidden="true"/>
                        </div>
                      )}
                      <div style={{
                        maxWidth:"76%",padding:"10px 14px",borderRadius:10,
                        background:m.role==="user"?T.blueLight:T.surfaceAlt,
                        border:`1px solid ${m.role==="user"?T.borderMid:T.border}`,
                        fontSize:12,lineHeight:1.7,
                        color:m.role==="user"?T.blue:T.textPrimary,
                        fontFamily:m.role==="assistant"?"'Courier New',Courier,monospace":"inherit",
                        whiteSpace:"pre-wrap",
                      }}>{m.text}</div>
                    </div>
                  ))}
                  {cpLoading&&(
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <div style={{width:30,height:30,borderRadius:"50%",background:T.blueLight,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${T.borderMid}`}}>
                        <i className="ti ti-robot" style={{fontSize:14,color:T.blue}} aria-hidden="true"/>
                      </div>
                      <div style={{padding:"10px 14px",background:T.surfaceAlt,border:`1px solid ${T.border}`,borderRadius:10,fontSize:12,color:T.textMuted}}>
                        Analyzing threat context…
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick commands */}
                <div style={{padding:"0 18px 8px",display:"flex",gap:6,flexShrink:0}}>
                  {[{cmd:"summarize",icon:"ti-report"},{cmd:"hunt",icon:"ti-target"},{cmd:"report",icon:"ti-file-description"}].map(({cmd,icon})=>(
                    <button key={cmd} onClick={()=>setCpInput(cmd)} style={{
                      display:"inline-flex",alignItems:"center",gap:5,
                      padding:"5px 11px",fontSize:11,fontWeight:500,
                      background:T.surfaceAlt,border:`1px solid ${T.border}`,
                      color:T.textSecondary,borderRadius:6,cursor:"pointer",
                    }}>
                      <i className={`ti ${icon}`} style={{fontSize:12}} aria-hidden="true"/>{cmd}
                    </button>
                  ))}
                </div>

                {/* Input */}
                <div style={{padding:"10px 14px",borderTop:`1px solid ${T.border}`,display:"flex",gap:8,flexShrink:0}}>
                  <input
                    value={cpInput}
                    onChange={e=>setCpInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&sendCopilot()}
                    placeholder="Type 'summarize', 'hunt', 'report', or any security question…"
                    style={{
                      flex:1,padding:"9px 13px",background:T.surfaceAlt,
                      border:`1px solid ${T.borderMid}`,borderRadius:8,
                      fontSize:12,color:T.textPrimary,outline:"none",
                    }}
                  />
                  <Btn onClick={sendCopilot} variant="primary" style={{padding:"9px 18px"}}>
                    <i className="ti ti-send" style={{fontSize:13}} aria-hidden="true"/>Send
                  </Btn>
                </div>
              </Card>

              {/* Info panel */}
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <Card>
                  <CardHeader title="Capabilities"/>
                  <div style={{padding:"8px 14px"}}>
                    {[
                      {icon:"ti-search",label:"Alert explanation",desc:"SHAP-powered XAI analysis"},
                      {icon:"ti-chart-dots",label:"Threat summary",desc:"Multi-source intelligence"},
                      {icon:"ti-target",label:"Hunt generation",desc:"Autonomous hypothesis engine"},
                      {icon:"ti-file-description",label:"Incident reports",desc:"P1/P2 auto-generated"},
                      {icon:"ti-shield-check",label:"Remediation",desc:"Playbook & runbook gen"},
                      {icon:"ti-crystal-ball",label:"Attack prediction",desc:"Next TTP forecasting"},
                    ].map(c=>(
                      <div key={c.label} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"9px 4px",borderBottom:`1px solid ${T.border}`}}>
                        <div style={{width:28,height:28,borderRadius:6,background:T.blueLight,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <i className={`ti ${c.icon}`} style={{fontSize:14,color:T.blue}} aria-hidden="true"/>
                        </div>
                        <div>
                          <div style={{fontSize:12,fontWeight:500,color:T.textPrimary}}>{c.label}</div>
                          <div style={{fontSize:11,color:T.textMuted}}>{c.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Session stats"/>
                  <div style={{padding:"8px 16px"}}>
                    {[
                      {l:"Analyses run",v:"847"},
                      {l:"Reports generated",v:"23"},
                      {l:"Avg response time",v:"1.2s"},
                      {l:"Model accuracy",v:metrics.acc.toFixed(2)+"%"},
                    ].map(s=>(
                      <div key={s.l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.border}`,fontSize:12}}>
                        <span style={{color:T.textSecondary}}>{s.l}</span>
                        <span style={{fontWeight:600,color:T.textPrimary}}>{s.v}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

        </div>
      </div>

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{overflow:hidden;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:${T.bg};}
        ::-webkit-scrollbar-thumb{background:${T.borderMid};border-radius:3px;}
        ::-webkit-scrollbar-thumb:hover{background:#9CA3AF;}
        button:hover{opacity:0.88;}
        @keyframes inferSlide{from{width:20%}to{width:85%}}
      `}</style>
    </div>
  );
}
