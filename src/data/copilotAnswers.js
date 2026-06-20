export const COPILOT_ANSWERS = {
  summarize:`INC-2024-0847 — P1 Critical

Entity: john.doe  |  Device: WS-FINANCE-01
Twin delta: 0.94  |  Status: Contained

Timeline:
  02:47  Phishing macro executed (T1566)
  02:51  Credential dump initiated (T1003)
  03:02  RDP lateral movement to 14 hosts
  03:08  Detected by Twin Delta Engine

Attribution: APT29 (Cozy Bear) — 91.4% confidence
Current phase: Lateral Movement (T1021.001)
Predicted next: Data staging → DNS exfiltration ≤2h

Automated response:
  ✓ WS-FINANCE-01 isolated via CrowdStrike
  ✓ Session revoked via Okta
  ✓ 185.220.0.0/16 blocked via Palo Alto
  ✓ MTTD 4.3 min · MTTR 23 sec`,

  hunt:`Hunt HYP-2024-041 — Lateral Movement via Valid Accounts

Scope criteria:
  · Users with >5 new device logins in 6h
  · RDP sessions outside 08:00–20:00 window
  · Accounts accessing >10 hosts per minute

Anomalous entities (3):
  john.doe    delta 0.94   ● Critical
  admin.corp  delta 0.71   ● Medium
  ops.svc     delta 0.58   ● Low

Recommended KQL:
  SecurityEvent
  | where Account in ("john.doe", "admin.corp")
  | where LogonType == 10
  | where TimeGenerated > ago(6h)
  | summarize LoginCount=count()
      by Account, Computer
  | where LoginCount > 5`,

  report:`INCIDENT REPORT — INC-2024-0847

Classification : P1 Critical — Contained
MTTD           : 4.3 minutes
MTTR           : 23 seconds (automated)
Analyst        : Sentinel AI + SOC Tier 1

Summary:
Sentinel Prime detected a sophisticated APT intrusion
matching APT29 behavioral TTPs. The Behavioral Digital
Twin Engine identified credential anomaly 4.3 min post-
access vs. industry average of 197 days.

Scope:
  Systems affected : 3 workstations
  Data at risk     : Finance folder
  Exfiltrated      : None — contained pre-exfil

Response actions:
  ✓ Device isolated (CrowdStrike EDR)
  ✓ User session revoked (Okta)
  ✓ C2 range blocked (Palo Alto NGFW)
  ✓ Evidence preserved (MinIO)

Recommendation: Rotate domain credentials, patch
CVE-2024-21413 on all unpatched endpoints.`,
};
