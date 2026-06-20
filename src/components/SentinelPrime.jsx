import { useState, useEffect, useCallback, useRef } from "react";
import { T, TECHNIQUES, CHAIN, MODELS, CAMPAIGNS, IOCS, COPILOT_ANSWERS } from "../data/projectData.js";
import { SEED_ALERTS } from "../data/alerts.js";
import { TWIN_LIST } from "../data/twins.js";
import { rand, randInt, pick, f1, f2, pct, mkAlert } from "../utils/helpers.js";

// ─── Reusable components ──────────────────────────────────────────────────────
const Badge = ({label, color=T.blue, bg=T.blueLight}) => (
  <span style={{
    display:"inline-block", padding:"2px 9px", borderRadius:4,
    fontSize:11, fontWeight:500, background:bg, color, whiteSpace:"nowrap",
    letterSpacing:"0.01em",
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
    <div style={{background:T.bg, borderRadius:99, height, width:"100%", overflow:"hidden"}}>
      <div style={{width:`${Math.min(100,(value/max)*100)}%`, height:"100%", background:color, borderRadius:99, transition:"width 0.5s ease"}}/>
    </div>
  );
}

function Card({children, style={}}) {
  return (
    <div style={{background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, ...style}}>
      {children}
    </div>
  );
}

function CardHeader({title, sub, right}) {
  return (
    <div style={{padding:"14px 18px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
      <div>
        <div style={{fontSize:13, fontWeight:600, color:T.textPrimary}}>{title}</div>
        {sub && <div style={{fontSize:11, color:T.textMuted, marginTop:2}}>{sub}</div>}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

function MetricCard({icon, label, value, sub, subColor=T.textMuted, iconBg, iconColor}) {
  return (
    <Card>
      <div style={{padding:"16px 18px"}}>
        <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10}}>
          <div style={{width:36, height:36, borderRadius:8, background:iconBg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
            <i className={`ti ${icon}`} style={{fontSize:18, color:iconColor}} aria-hidden="true"/>
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
    default: {bg:T.surface, border:`1px solid ${T.borderMid}`, color:T.textPrimary},
    primary: {bg:T.blue, border:`1px solid ${T.blue}`, color:"#fff"},
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
      transition:"all 0.15s", ...style,
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
  const chatRef = useRef(null);

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
    <div style={{display:"flex", height:"100vh", overflow:"hidden", background:T.bg, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", fontSize:13, color:T.textPrimary}}>

      {/* ── SIDEBAR ── */}
      <aside style={{width:220, flexShrink:0, background:T.sidebar, display:"flex", flexDirection:"column", overflow:"hidden"}}>
        {/* Logo */}
        <div style={{padding:"18px 16px 14px", borderBottom:`1px solid rgba(255,255,255,0.07)`}}>
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <div style={{width:32,height:32,borderRadius:8,background:"rgba(59,125,216,0.25)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <i className="ti ti-shield-lock" style={{fontSize:17,color:"#7BB3F0"}} aria-hidden="true"/>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#F1F5F9",letterSpacing:"0.01em"}}>Sentinel Prime</div>
              <div style={{fontSize:10,color:"#64748B",marginTop:1}}>CATE v2.1</div>
            </div>
          </div>
        </div>

        {/* Live pulse */}
        <div style={{padding:"10px 16px", borderBottom:`1px solid rgba(255,255,255,0.05)`, display:"flex", alignItems:"center", gap:8}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:"#34D399",display:"inline-block",flexShrink:0}}/>
          <span style={{fontSize:11,color:"#64748B"}}>{metrics.eps.toLocaleString()} events / sec</span>
        </div>

        {/* Nav */}
        <nav style={{padding:"10px 8px",flex:1,overflowY:"auto"}}>
          <div style={{fontSize:10,fontWeight:600,color:"#475569",letterSpacing:"0.08em",padding:"4px 10px 8px"}}>NAVIGATION</div>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{
              display:"flex", alignItems:"center", gap:10, width:"100%",
              padding:"9px 12px", borderRadius:7, marginBottom:1,
              background: tab===n.id?"rgba(59,125,216,0.18)":"transparent",
              border: "none",
              color: tab===n.id?"#93C5FD":T.sideText,
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
        <div style={{padding:"12px 12px", borderTop:`1px solid rgba(255,255,255,0.06)`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[
              {l:"Accuracy",  v:metrics.acc.toFixed(1)+"%"},
              {l:"Contained", v:String(contained)},
              {l:"Blocked",   v:String(metrics.blocked)},
              {l:"Twins",     v:String(metrics.twins)},
            ].map(s=>(
              <div key={s.l} style={{background:"rgba(255,255,255,0.05)",borderRadius:7,padding:"8px 10px"}}>
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
        <header style={{height:54,background:T.surface,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",padding:"0 20px",gap:12,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <i className={`ti ${NAV.find(n=>n.id===tab)?.icon||"ti-layout-dashboard"}`} style={{fontSize:16,color:T.textMuted}} aria-hidden="true"/>
            <span style={{fontSize:14,fontWeight:600,color:T.textPrimary}}>{NAV.find(n=>n.id===tab)?.label}</span>
          </div>
          <div style={{flex:1}}/>
          {/* Alert pill */}
          <div style={{
            display:"flex",alignItems:"center",gap:7,
            padding:"5px 13px", borderRadius:20,
            background: pulse?T.redLight:T.surfaceAlt,
            border:`1px solid ${pulse?"#f5b7bb":T.border}`,
            fontSize:12, color:pulse?T.red:T.textSecondary,
            transition:"all 0.3s",
          }}>
            <span style={{width:7,height:7,borderRadius:"50%",background:pulse?T.red:"#34D399",display:"inline-block",flexShrink:0}}/>
            {pulse ? "New alert incoming" : `${critN} critical · ${highN} high · ${medN} medium`}
          </div>
          {/* Avatar */}
          <div style={{width:32,height:32,borderRadius:"50%",background:T.blueLight,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",border:`1px solid ${T.border}`}}>
            <i className="ti ti-user" style={{fontSize:15,color:T.blue}} aria-hidden="true"/>
          </div>
        </header>

        {/* ── PAGE CONTENT ── */}
        <div style={{flex:1,overflow:"auto",padding:20}}>

          {/* ════════════════ DASHBOARD ════════════════ */}
          {tab==="dashboard" && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>

              {/* Metric cards */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                <MetricCard icon="ti-alert-triangle" label="Organization Risk"   value="8.4 / 10"              sub="↑ +2.1 from baseline" subColor={T.red}   iconBg={T.redLight}  iconColor={T.red}  />
                <MetricCard icon="ti-bell"           label="Critical Alerts"     value={String(critN)}         sub={`${highN} high, ${medN} medium`}         iconBg={T.amberLight} iconColor={T.amber}/>
                <MetricCard icon="ti-users"          label="Twins Monitored"     value={String(metrics.twins)} sub="3 anomalies active"   subColor={T.amber} iconBg={T.blueLight} iconColor={T.blue} />
                <MetricCard icon="ti-cpu"            label="AI Accuracy"         value={metrics.acc.toFixed(2)+"%"} sub="7-model ensemble"                  iconBg={T.greenLight} iconColor={T.green}/>
              </div>

              {/* Attack chain + alert feed */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>

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
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:0}}>
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
