export const T = {
  bg:        "#F5F6F8",
  surface:   "#FFFFFF",
  surfaceAlt:"#F9FAFB",
  sidebar:   "#1C2333",
  sideText:  "#A8B4C8",
  sideActive:"#FFFFFF",
  sideHover: "#2A3347",
  border:    "#E4E7EC",
  borderMid: "#D0D5DD",
  textPrimary:   "#1A1F2E",
  textSecondary: "#6B7280",
  textMuted:     "#9CA3AF",
  blue:      "#3B7DD8",
  blueLight: "#EBF2FD",
  teal:      "#2A9D8F",
  tealLight: "#E6F5F4",
  amber:     "#D97706",
  amberLight:"#FEF3C7",
  red:       "#DC3545",
  redLight:  "#FDECEA",
  green:     "#2E7D52",
  greenLight:"#E8F5EE",
  purple:    "#6554AF",
  purpleLight:"#EEE9FB",
  slate:     "#475569",
  slateLight:"#F1F4F8",
  accent:    "#3B7DD8",
};

export const TECHNIQUES = [
  { id:"T1566", name:"Phishing",           tactic:"Initial Access"     },
  { id:"T1078", name:"Valid Accounts",     tactic:"Persistence"        },
  { id:"T1021", name:"Remote Services",    tactic:"Lateral Movement"   },
  { id:"T1003", name:"Credential Dumping", tactic:"Credential Access"  },
  { id:"T1041", name:"Exfiltration/C2",    tactic:"Exfiltration"       },
  { id:"T1059", name:"Command Scripting",  tactic:"Execution"          },
  { id:"T1055", name:"Process Injection",  tactic:"Defense Evasion"    },
  { id:"T1486", name:"Data Encryption",    tactic:"Impact"             },
];

export const ACTORS  = ["APT29","APT28","Lazarus Group","Carbanak","FIN7","DarkSide","Conti","REvil"];
export const USERS   = ["john.doe","sarah.smith","admin.corp","dev.lead","cfo.user","hr.manager","ops.svc","db.admin"];
export const DEVICES = ["WS-FINANCE-01","SRV-DC-PROD","LAPTOP-DEV-07","WS-HR-03","SRV-DB-02","SRV-AD-01","LAPTOP-EXEC-CEO","WS-OPS-02"];
export const DEPTS   = ["Finance","Engineering","HR","Executive","IT Ops","Security","Legal","Sales"];
export const CHAIN   = ["Recon","Initial Access","Execution","Persistence","Priv. Esc.","Lateral Move","Exfiltration","Impact"];

export const SEED_ALERTS = [];

export const TWIN_LIST = [];

export const MODELS = [
  {name:"XGBoost",         acc:99.12,role:"Tabular IOC classification",       tag:"Supervised"  },
  {name:"LightGBM",        acc:98.87,role:"Real-time event scoring",           tag:"Supervised"  },
  {name:"CatBoost",        acc:99.01,role:"Categorical feature encoding",      tag:"Supervised"  },
  {name:"BERT-Sec",        acc:99.23,role:"Log sequence semantics",            tag:"Transformer" },
  {name:"Autoencoder",     acc:98.56,role:"Twin reconstruction anomaly",       tag:"Deep Learning"},
  {name:"Isolation Forest",acc:97.99,role:"Zero-day pattern detection",        tag:"Unsupervised" },
  {name:"Meta-Learner",    acc:99.61,role:"Stacking ensemble fusion",          tag:"Meta"        },
];

export const CAMPAIGNS = [
  {id:"COZY-BEAR-2024-03", actor:"APT29", conf:91.4, stage:"Lateral Movement", ttps:["T1566","T1078","T1021","T1003"], victims:3, days:4},
  {id:"FIN7-RETAIL-Q4",    actor:"FIN7",  conf:78.2, stage:"Initial Access",    ttps:["T1566","T1059","T1204"],         victims:1, days:1},
  {id:"LAZARUS-SUPPLY-01", actor:"Lazarus",conf:65.1,stage:"Reconnaissance",    ttps:["T1595","T1589"],                 victims:0, days:0},
];

export const IOCS = [
  {type:"IP",     val:"185.220.101.47",           actor:"APT29",   conf:96, status:"Blocked"    },
  {type:"Domain", val:"cdn-updates.ru-secure.com",actor:"APT29",   conf:91, status:"Blocked"    },
  {type:"Hash",   val:"3d4b2a1c9f8e7a6b…",        actor:"FIN7",    conf:88, status:"Quarantined"},
  {type:"IP",     val:"91.234.99.182",             actor:"Lazarus", conf:72, status:"Monitoring" },
  {type:"URL",    val:"https://evil-cdn.tk/drop",  actor:"Unknown", conf:65, status:"Monitoring" },
];
