"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Download,
  FileText,
  Fingerprint,
  HeartPulse,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Microscope,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Users,
  X,
  Zap,
  Workflow,
  AlertTriangle,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";

type Row = Record<string, any>;
type View =
  | "Overview"
  | "Patients"
  | "Clinical cases"
  | "Agent workspace"
  | "Explainability"
  | "Uncertainty"
  | "Expert reviews"
  | "Reports"
  | "Audit trail"
  | "Settings";
const navigation: { label: View; icon: typeof Activity; group: string }[] = [
  { label: "Overview", icon: LayoutDashboard, group: "WORKSPACE" },
  { label: "Patients", icon: Users, group: "" },
  { label: "Clinical cases", icon: ClipboardList, group: "" },
  { label: "Agent workspace", icon: Workflow, group: "" },
  { label: "Explainability", icon: BrainCircuit, group: "INTELLIGENCE" },
  { label: "Uncertainty", icon: Activity, group: "" },
  { label: "Expert reviews", icon: ShieldCheck, group: "" },
  { label: "Reports", icon: FileText, group: "MANAGEMENT" },
  { label: "Audit trail", icon: Fingerprint, group: "" },
  { label: "Settings", icon: Settings, group: "" },
];
const agentNames = [
  "Patient Data",
  "Clinical Analysis",
  "Medical Knowledge",
  "Differential Insight",
  "Explainability",
  "Uncertainty Estimation",
  "Safety and Risk Review",
  "Expert Escalation",
  "Report Generation",
];
function Badge({
  children,
  tone = "teal",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={"badge " + tone}>
      <span />
      {children}
    </span>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <ClipboardList size={28} />
      <p>{text}</p>
    </div>
  );
}
function Card({
  title,
  subtitle,
  children,
  action,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={"card " + className}>
      {title && (
        <div className="card-header">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function Home() {
  const [token, setToken] = useState(""),
    [user, setUser] = useState<Row | null>(null),
    [view, setView] = useState<View>("Overview"),
    [landing, setLanding] = useState(true),
    [auth, setAuth] = useState(false),
    [register, setRegister] = useState(false);
  const [patients, setPatients] = useState<Row[]>([]),
    [cases, setCases] = useState<Row[]>([]),
    [escalations, setEscalations] = useState<Row[]>([]),
    [reports, setReports] = useState<Row[]>([]),
    [stats, setStats] = useState<Row>({}),
    [notifications, setNotifications] = useState<Row[]>([]),
    [users, setUsers] = useState<Row[]>([]),
    [logs, setLogs] = useState<Row[]>([]),
    [knowledge, setKnowledge] = useState<Row[]>([]),
    [health, setHealth] = useState<Row>({});
  const [selected, setSelected] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All cases"),
    [modal, setModal] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [mobile, setMobile] = useState(false),
    [notices, setNotices] = useState(false);
  const active = cases.find((c) => c.id === selected) || cases[0];
  const analysis = active?.analysis;
  const uncertainty = analysis?.uncertainty;
  const tell = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 4500);
  };
  async function api(
    path: string,
    method = "GET",
    body?: unknown,
    override?: string,
  ) {
    const response = await fetch("/api" + path, {
      method,
      headers: {
        ...(!(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        Authorization: "Bearer " + (override || token),
      },
      ...(body
        ? { body: body instanceof FormData ? body : JSON.stringify(body) }
        : {}),
    });
    if (!response.ok) {
      const e = await response
        .json()
        .catch(() => ({ detail: "Request failed" }));
      throw new Error(
        typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail),
      );
    }
    return response.json();
  }
  async function refresh(t = token) {
    setLoading(true);
    try {
      const [p, c, e, r, s, n, u, k, h] = await Promise.all([
        api("/patients", "GET", undefined, t),
        api("/cases", "GET", undefined, t),
        api("/escalations", "GET", undefined, t),
        api("/reports", "GET", undefined, t),
        api("/analytics/dashboard", "GET", undefined, t),
        api("/notifications", "GET", undefined, t),
        api("/users", "GET", undefined, t),
        api("/knowledge", "GET", undefined, t),
        api("/health", "GET", undefined, t),
      ]);
      setPatients(p);
      setCases(c);
      setEscalations(e);
      setReports(r);
      setStats(s);
      setNotifications(n);
      setUsers(u);
      setKnowledge(k);
      setHealth(h);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const t = sessionStorage.getItem("clinix-token");
    if (t) {
      setToken(t);
      fetch("/api/auth/me", { headers: { Authorization: "Bearer " + t } })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((u) => {
          setUser(u);
          setLanding(false);
          refresh(t);
        })
        .catch(() => sessionStorage.removeItem("clinix-token"));
    }
  }, []);
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => refresh(token), 45000);
    return () => clearInterval(timer);
  }, [token]);
  useEffect(() => {
    if (view === "Audit trail" && token) {
      api("/audit-logs")
        .then(setLogs)
        .catch((e) => setError(e.message));
    }
  }, [view, token]);
  async function signIn(role?: string, event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    const data = event
      ? Object.fromEntries(new FormData(event.currentTarget))
      : {};
    try {
      const response = await api(
        register && !role ? "/auth/register" : "/auth/login",
        "POST",
        role
          ? { email: role + "@clinixai.demo", password: "ClinixDemo!2026" }
          : data,
      );
      setToken(response.access_token);
      setUser(response.user);
      sessionStorage.setItem("clinix-token", response.access_token);
      setLanding(false);
      setAuth(false);
      await refresh(response.access_token);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submitPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    await action(async () => {
      await api("/patients", "POST", { ...form, age: Number(form.age) });
      setModal("");
      await refresh();
      tell("Patient registered successfully");
    });
  }
  async function submitCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = Object.fromEntries(new FormData(event.currentTarget));
    await action(async () => {
      const c = await api("/cases", "POST", {
        patient_id: f.patient_id,
        symptoms: f.symptoms,
        duration: f.duration,
        notes: f.notes,
        consent: f.consent === "on",
        vitals: Object.fromEntries(
          ["heart_rate", "systolic", "spo2", "temperature"].map((k) => [
            k,
            f[k] ? Number(f[k]) : null,
          ]),
        ),
      });
      setSelected(c.id);
      setModal("");
      setView("Agent workspace");
      await refresh();
      tell("Case created. Ready to run analysis.");
    });
  }
  async function runAnalysis() {
    if (!active) return;
    await action(async () => {
      const c = await api("/cases/" + active.id + "/analyze", "POST");
      setSelected(c.id);
      await refresh();
      tell("Agent workflow completed. Findings are ready for human review.");
    });
  }
  async function generateReport(c = active) {
    if (!c) return;
    await action(async () => {
      const r = await api("/reports/generate", "POST", { case_id: c.id });
      await refresh();
      setView("Reports");
      tell("Report generated. Download the PDF from report history.");
    });
  }
  async function download(r: Row) {
    await action(async () => {
      const response = await fetch("/api/reports/" + r.id + "/download", {
        headers: { Authorization: "Bearer " + token },
      });
      if (!response.ok) throw new Error("Download failed");
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "clinixai-" + r.id.slice(0, 8) + ".pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
  }
  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = Object.fromEntries(new FormData(event.currentTarget));
    await action(async () => {
      await api("/reviews", "POST", { case_id: active.id, ...f });
      setModal("");
      await refresh();
      tell("Human review decision saved with audit history.");
    });
  }
  function openCase(c: Row, target: View = "Agent workspace") {
    setSelected(c.id);
    setView(target);
    setSearch("");
  }
  const shown = cases.filter(
    (c) =>
      (c.patient_name + " " + c.symptoms + " " + c.id)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "All cases" || c.status === filter),
  );
  const casePicker = (
    <select
      aria-label="Select clinical case"
      value={active?.id || ""}
      onChange={(e) => setSelected(e.target.value)}
    >
      {cases.map((c) => (
        <option key={c.id} value={c.id}>
          {c.patient_name} · {c.id.slice(0, 8)}
        </option>
      ))}
    </select>
  );
  const caseTable = (rows: Row[]) => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Patient / Case ID</th>
            <th>Reported symptoms</th>
            <th>Uncertainty</th>
            <th>Review status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr
              key={c.id}
              onClick={() => openCase(c)}
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openCase(c)}
            >
              <td>
                <div className="person">
                  <span className={"avatar a" + (i % 4)}>
                    {c.patient_name
                      .split(" ")
                      .map((s: string) => s[0])
                      .join("")}
                  </span>
                  <div>
                    <strong>{c.patient_name}</strong>
                    <small>CX-{c.id.slice(0, 6).toUpperCase()}</small>
                  </div>
                </div>
              </td>
              <td>
                <span className="symptom">{c.symptoms}</span>
                <small>{c.duration || "Duration not recorded"}</small>
              </td>
              <td>
                {c.analysis ? (
                  <div className="score-cell">
                    <strong>
                      {c.analysis.uncertainty.uncertainty_score}
                      <em>/100</em>
                    </strong>
                    <div className="mini-track">
                      <i
                        style={{
                          width: c.analysis.uncertainty.uncertainty_score + "%",
                          background:
                            c.analysis.uncertainty.uncertainty_score > 50
                              ? "#e6a04b"
                              : "#16a58d",
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="muted">Not analyzed</span>
                )}
              </td>
              <td>
                <Badge
                  tone={
                    c.status === "Expert review"
                      ? "amber"
                      : c.status === "Draft"
                        ? "gray"
                        : "teal"
                  }
                >
                  {c.status}
                </Badge>
              </td>
              <td>
                <ChevronRight size={16} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty text="No cases match your search." />}
    </div>
  );

  if (landing && !user)
    return (
      <div className="landing">
        <nav className="landing-nav">
          <a className="brand" href="#">
            <span className="brand-mark">
              <Activity />
            </span>
            CLINIX<span>AI</span>
          </a>
          <div className="landing-links">
            <a href="#capabilities">Capabilities</a>
            <a href="#workflow">How it works</a>
            <a href="#trust">Safety & transparency</a>
          </div>
          <button
            className="primary"
            onClick={() => {
              setAuth(true);
              setLanding(false);
            }}
          >
            Open workspace <ArrowUpRight size={16} />
          </button>
        </nav>
        <main className="hero">
          <div className="eyebrow">
            <span /> CLINICAL INTELLIGENCE. HUMAN OVERSIGHT.
          </div>
          <h1>
            Clarity for every
            <br />
            clinical <span>decision.</span>
          </h1>
          <p>
            Connect the dots across patient data, evidence, and uncertainty.
            Nine specialized agents. Transparent insights. A clinician always in
            control.
          </p>
          <div className="hero-actions">
            <button
              className="primary large"
              disabled={busy}
              onClick={() => signIn("clinician")}
            >
              {busy ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <>
                  Explore live demo <ArrowRight size={18} />
                </>
              )}
            </button>
            <button
              className="secondary large"
              onClick={() => {
                setAuth(true);
                setLanding(false);
              }}
            >
              Sign in to workspace
            </button>
          </div>
          <div className="hero-meta">
            <ShieldCheck size={16} /> Synthetic data only <span>·</span> No paid
            AI keys required <span>·</span> Research demonstration
          </div>
          <div className="hero-preview">
            <div className="preview-side">
              <span className="brand-mark">
                <Activity />
              </span>
              <LayoutDashboard />
              <Users />
              <BrainCircuit />
              <ShieldCheck />
            </div>
            <div className="preview-main">
              <div className="preview-top">
                <div>
                  <span className="eyebrow">YOUR CLINICAL COMMAND CENTER</span>
                  <h2>Better context. Clearer decisions.</h2>
                </div>
                <Badge>9 specialized agents</Badge>
              </div>
              <div className="preview-grid">
                <div>
                  <span className="label">MULTI-AGENT ANALYSIS</span>
                  <h2>
                    Every insight,
                    <br />
                    open to inspection.
                  </h2>
                  <p>
                    Trace observations to their inputs, inspect retrieved
                    passages, and understand what remains uncertain.
                  </p>
                  <div className="preview-check">
                    <CheckCircle2 /> Evidence provenance
                  </div>
                  <div className="preview-check">
                    <CheckCircle2 /> Explainable uncertainty
                  </div>
                  <div className="preview-check">
                    <CheckCircle2 /> Mandatory safety routing
                  </div>
                </div>
                <div className="orbital">
                  <BrainCircuit size={65} />
                  <span className="orbit-tag one">
                    <ShieldCheck /> Safety review
                  </span>
                  <span className="orbit-tag two">
                    <BookOpen /> Knowledge retrieval
                  </span>
                  <span className="orbit-tag three">
                    <Stethoscope /> Human expertise
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>
        <section id="capabilities" className="landing-section">
          <span className="eyebrow">BUILT FOR THE COMPLETE PICTURE</span>
          <h2>Intelligence you can interrogate.</h2>
          <div className="feature-grid">
            {[
              [
                BrainCircuit,
                "Explain every observation",
                "Inspect the recorded inputs, agent contributions, contradictions, and limitations behind each result.",
              ],
              [
                Activity,
                "Make uncertainty visible",
                "See a transparent weighted score with missing-data and evidence-quality contributions.",
              ],
              [
                ShieldCheck,
                "Keep experts in the loop",
                "Route safety flags and uncertain cases to qualified reviewers, with a complete decision history.",
              ],
            ].map(([Icon, title, description]: any) => (
              <Card key={title}>
                <Icon size={28} />
                <h3>{title}</h3>
                <p>{description}</p>
              </Card>
            ))}
          </div>
        </section>
        <section id="workflow" className="landing-section workflow-section">
          <div>
            <span className="eyebrow">FROM CONTEXT TO REVIEW</span>
            <h2>
              A connected workflow.
              <br />A human final decision.
            </h2>
          </div>
          <div>
            {[
              "Register a synthetic patient and capture observations",
              "Run the nine-node deterministic agent graph",
              "Inspect evidence, explanations, and uncertainty",
              "Record expert review and export the report",
            ].map((s, i) => (
              <div className="workflow-step" key={s}>
                <b>0{i + 1}</b>
                <span>{s}</span>
                <Check size={16} />
              </div>
            ))}
          </div>
        </section>
        <section id="trust" className="trust">
          <ShieldCheck size={32} />
          <h2>Designed for research. Built around oversight.</h2>
          <p>
            CLINIXAI is an unvalidated educational demonstration. It does not
            diagnose, prescribe, or replace medical professionals. Use synthetic
            data only. Every generated insight requires qualified human review.
          </p>
          <button className="primary" onClick={() => signIn("clinician")}>
            Explore the workspace <ArrowRight size={16} />
          </button>
        </section>
        <footer>
          <span>CLINIXAI · Explainable clinical intelligence</span>
          <span>Research demonstration · 2026</span>
        </footer>
        {error && (
          <div className="toast error">
            {error}
            <button onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    );

  if (!user)
    return (
      <div className="auth-page">
        <div className="auth-art">
          <a
            className="brand"
            href="#"
            onClick={() => {
              setLanding(true);
              setAuth(false);
            }}
          >
            <span className="brand-mark">
              <Activity />
            </span>
            CLINIX<span>AI</span>
          </a>
          <div>
            <span className="eyebrow">
              HUMAN-CENTERED CLINICAL INTELLIGENCE
            </span>
            <h1>
              Insight with
              <br />
              accountability.
            </h1>
            <p>
              A connected workspace for explainable observations, transparent
              uncertainty, and expert oversight.
            </p>
            <ShieldCheck size={64} />
          </div>
          <small>Synthetic research demonstration · Not for clinical use</small>
        </div>
        <div className="auth-form">
          <h2>{register ? "Create your account" : "Welcome back"}</h2>
          <p>
            {register
              ? "Register as a clinician to begin."
              : "Sign in to your clinical workspace."}
          </p>
          <form onSubmit={(e) => signIn(undefined, e)}>
            {register && (
              <Field label="Full name">
                <input name="name" required minLength={2} autoComplete="name" />
              </Field>
            )}
            <Field label="Email address">
              <input name="email" type="email" required autoComplete="email" />
            </Field>
            <Field label="Password">
              <input
                name="password"
                type="password"
                required
                minLength={register ? 10 : 1}
                autoComplete={register ? "new-password" : "current-password"}
              />
            </Field>
            <button className="primary full" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={18} />
              ) : register ? (
                "Create account"
              ) : (
                "Sign in"
              )}
              <ArrowRight size={16} />
            </button>
          </form>
          <button
            className="text-button"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register
              ? "Already have an account? Sign in"
              : "New here? Create an account"}
          </button>
          <div className="divider">OR EXPLORE WITH A DEMO ACCOUNT</div>
          <div className="demo-roles">
            {["clinician", "expert", "admin"].map((r) => (
              <button
                className="secondary"
                disabled={busy}
                key={r}
                onClick={() => signIn(r)}
              >
                {r === "clinician" ? (
                  <Stethoscope size={17} />
                ) : r === "expert" ? (
                  <ShieldCheck size={17} />
                ) : (
                  <Settings size={17} />
                )}
                <span>
                  {r === "admin"
                    ? "Administrator"
                    : r === "expert"
                      ? "Expert reviewer"
                      : "Clinician"}
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
          <p className="fine-print">
            <LockKeyhole size={13} /> Demo accounts share synthetic data. Never
            enter real patient information.
          </p>
          {error && <div className="inline-error">{error}</div>}
        </div>
      </div>
    );

  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a className="brand" href="#" onClick={() => setView("Overview")}>
          <span className="brand-mark">
            <Activity size={22} />
          </span>
          CLINIX<span>AI</span>
        </a>
        <div className="workspace-label">
          <span className="workspace-icon">
            <Microscope size={17} />
          </span>
          <div>
            Clinical workspace<small>Research environment</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <nav>
          {navigation.map((n) => (
            <div key={n.label}>
              {n.group && <div className="nav-group">{n.group}</div>}
              <button
                className={"nav-item " + (view === n.label ? "active" : "")}
                onClick={() => {
                  setView(n.label);
                  setMobile(false);
                  setSearch("");
                }}
              >
                <n.icon size={18} />
                <span>{n.label}</span>
                {n.label === "Expert reviews" && stats.pending > 0 && (
                  <b>{stats.pending}</b>
                )}
                {n.label === "Agent workspace" && <span className="nav-dot" />}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <span>
              <Sparkles size={16} /> Research demo
            </span>
            <p>
              Transparent by design.
              <br />
              Human oversight, always.
            </p>
            <Badge>Local deterministic agents</Badge>
          </div>
          <button
            className="profile"
            onClick={() => {
              setToken("");
              setUser(null);
              setAuth(true);
              sessionStorage.removeItem("clinix-token");
            }}
          >
            <span className="avatar profile-avatar">
              {user.name
                .split(" ")
                .filter((s: string) => s !== "Dr.")
                .map((s: string) => s[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>
              <strong>{user.name}</strong>
              <small>
                {user.role === "expert"
                  ? "Expert reviewer"
                  : user.role === "admin"
                    ? "Administrator"
                    : "Clinician"}
              </small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu"
              onClick={() => setMobile(!mobile)}
              aria-label="Toggle menu"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{view}</strong>
          </div>
          <div className="top-actions">
            <span className="environment">
              <i /> Demo environment
            </span>
            <button
              className="icon-button"
              aria-label="Refresh data"
              onClick={() => refresh()}
            >
              <RefreshCw size={17} className={loading ? "spin" : ""} />
            </button>
            <button
              className="icon-button notifications-button"
              aria-label="Notifications"
              onClick={() => setNotices(!notices)}
            >
              <Bell size={19} />
              {notifications.some((n) => !n.read) && <i />}
            </button>
            <span className="top-avatar">
              {user.name.replace("Dr. ", "")[0]}
            </span>
          </div>
          {notices && (
            <div className="notifications-panel">
              <div className="card-header">
                <h3>Notifications</h3>
                <button
                  className="text-button"
                  onClick={() =>
                    action(async () => {
                      await api("/notifications/read", "POST");
                      await refresh();
                    })
                  }
                >
                  Mark all read
                </button>
              </div>
              {notifications.slice(0, 8).map((n) => (
                <button
                  className={"notice " + (!n.read ? "unread" : "")}
                  key={n.id}
                  onClick={() => {
                    setSelected(n.case_id);
                    setView("Agent workspace");
                    setNotices(false);
                  }}
                >
                  <Bell size={15} />
                  <span>
                    {n.message}
                    <small>{new Date(n.created_at).toLocaleString()}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">CLINICAL INTELLIGENCE PLATFORM</div>
              <h1>{view === "Overview" ? "Workspace overview" : view}</h1>
              <p>
                {view === "Overview"
                  ? `Welcome back, ${user.name}. Here’s your clinical workspace at a glance.`
                  : view === "Agent workspace"
                    ? "Follow the evidence. Inspect every agent contribution."
                    : view === "Expert reviews"
                      ? "Bring human judgment to the cases that need it most."
                      : view === "Uncertainty"
                        ? "Understand the limits of every generated observation."
                        : view === "Explainability"
                          ? "Trace observations to recorded facts and retrieved sources."
                          : "Manage your clinical research workflow with confidence."}
              </p>
            </div>
            <div className="heading-actions">
              {view === "Overview" && (
                <span className="date-label">
                  {new Date().toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
              {view === "Patients" ? (
                <button className="primary" onClick={() => setModal("patient")}>
                  <Plus size={17} /> Add patient
                </button>
              ) : (
                <button className="primary" onClick={() => setModal("case")}>
                  <Plus size={17} /> New clinical case
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="error-banner">
              <AlertTriangle size={18} />
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          <div className="research-notice">
            <ShieldCheck size={16} />
            <span>
              <strong>Research demonstration</strong> · Synthetic data and
              unvalidated rule-based outputs. All insights require qualified
              human review.
              {health.storage === "ephemeral-demo"
                ? " Data may reset between server instances."
                : ""}
            </span>
            <Badge tone="gray">DEMO MODE</Badge>
          </div>

          {view === "Overview" && (
            <>
              <div className="metrics-grid">
                {[
                  {
                    label: "Total clinical cases",
                    value: stats.cases || 0,
                    detail: `${stats.patients || 0} synthetic patients`,
                    icon: ClipboardList,
                    color: "teal",
                  },
                  {
                    label: "Analyses completed",
                    value: stats.analyzed || 0,
                    detail: `${stats.agent_executions || 0} agent executions`,
                    icon: BrainCircuit,
                    color: "blue",
                  },
                  {
                    label: "Pending expert reviews",
                    value: stats.pending || 0,
                    detail: "Awaiting human assessment",
                    icon: ShieldCheck,
                    color: "amber",
                  },
                  {
                    label: "High-uncertainty cases",
                    value: stats.high_uncertainty || 0,
                    detail: "Heuristic score above 50",
                    icon: Activity,
                    color: "purple",
                  },
                ].map((m) => (
                  <Card key={m.label} className="metric-card">
                    <div className="metric-label">
                      {m.label}
                      <span className={"metric-icon " + m.color}>
                        <m.icon size={19} />
                      </span>
                    </div>
                    <div className="metric-value">
                      {m.value}
                      <span className="metric-spark">
                        {m.color === "amber" ? (
                          <ShieldAlert size={34} />
                        ) : (
                          <Activity size={40} />
                        )}
                      </span>
                    </div>
                    <p>
                      <span className={"little-dot " + m.color} />
                      {m.detail}
                    </p>
                  </Card>
                ))}
              </div>
              <div className="overview-banner">
                <div className="banner-icon">
                  <Workflow size={28} />
                </div>
                <div>
                  <h3>Connected agents. Explainable outcomes.</h3>
                  <p>
                    Your nine-agent workflow brings patient context, evidence,
                    and safety into one view.
                  </p>
                </div>
                <button onClick={() => setView("Agent workspace")}>
                  Explore agent workspace <ArrowUpRight size={17} />
                </button>
                <div className="banner-decoration" />
              </div>
              <div className="chart-grid">
                <Card
                  title="Case uncertainty overview"
                  subtitle="Computed from analyzed cases in your workspace"
                  action={<Badge tone="gray">LIVE DATA</Badge>}
                >
                  <div className="chart-legend">
                    <span>
                      <i />
                      Uncertainty score
                    </span>
                    <small>Heuristic · 0–100</small>
                  </div>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={stats.trend || []}
                        margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="0%"
                              stopColor="#0fa48d"
                              stopOpacity={0.2}
                            />
                            <stop
                              offset="100%"
                              stopColor="#0fa48d"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          vertical={false}
                          stroke="#edf1f4"
                          strokeDasharray="4 4"
                        />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "#87939f" }}
                          dy={10}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "#87939f" }}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 10,
                            border: "1px solid #e6ecef",
                            fontSize: 12,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="uncertainty"
                          stroke="#0ca18b"
                          strokeWidth={2.5}
                          fill="url(#area)"
                          dot={{ r: 4, fill: "#fff", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-footer">
                    <Activity size={14} /> Scores measure uncertainty,
                    independently of clinical risk.
                  </div>
                </Card>
                <Card
                  title="Uncertainty distribution"
                  subtitle="How reliable is the available context?"
                >
                  <div className="distribution-total">
                    <strong>{stats.analyzed || 0}</strong>
                    <span>analyzed cases</span>
                    <Badge tone="teal">
                      {stats.average_uncertainty || 0} avg. score
                    </Badge>
                  </div>
                  <div className="distribution-bars">
                    {(stats.distribution || []).map((d: Row, i: number) => (
                      <div key={d.name}>
                        <div>
                          <span>
                            <i
                              style={{
                                background: [
                                  "#0fa58c",
                                  "#62bdd2",
                                  "#ecad56",
                                  "#be7896",
                                ][i],
                              }}
                            />
                            {d.name}
                          </span>
                          <strong>{d.value}</strong>
                        </div>
                        <div className="distribution-track">
                          <span
                            style={{
                              width:
                                (stats.analyzed
                                  ? (d.value / stats.analyzed) * 100
                                  : 0) + "%",
                              background: [
                                "#0fa58c",
                                "#62bdd2",
                                "#ecad56",
                                "#be7896",
                              ][i],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="chart-footer">
                    <CircleHelp size={14} /> Demonstration thresholds. Not
                    clinical cutoffs.
                  </div>
                </Card>
              </div>
              <div className="lower-grid">
                <Card
                  title="Recent clinical cases"
                  subtitle="Your latest patient assessments"
                  action={
                    <button
                      className="text-button"
                      onClick={() => setView("Clinical cases")}
                    >
                      View all cases <ArrowRight size={14} />
                    </button>
                  }
                >
                  {caseTable(cases.slice(0, 4))}
                </Card>
                <Card
                  title="Agent network"
                  subtitle="Deterministic local orchestration"
                  action={<span className="live-dot" />}
                >
                  <div className="agent-summary">
                    <span className="network-icon">
                      <BrainCircuit size={27} />
                    </span>
                    <div>
                      <strong>9 specialized agents</strong>
                      <small>LangGraph workflow ready</small>
                    </div>
                    <Badge>Active</Badge>
                  </div>
                  {[
                    { name: "Data & clinical context", count: 2, icon: Users },
                    {
                      name: "Evidence & explainability",
                      count: 3,
                      icon: BookOpen,
                    },
                    {
                      name: "Uncertainty & safety",
                      count: 2,
                      icon: ShieldCheck,
                    },
                    {
                      name: "Escalation & reporting",
                      count: 2,
                      icon: FileText,
                    },
                  ].map((a) => (
                    <div className="network-row" key={a.name}>
                      <a.icon size={17} />
                      <span>{a.name}</span>
                      <small>{a.count} agents</small>
                    </div>
                  ))}
                  <button
                    className="network-link"
                    onClick={() => setView("Agent workspace")}
                  >
                    Inspect workflow <ArrowUpRight size={15} />
                  </button>
                </Card>
              </div>
            </>
          )}

          {view === "Patients" && (
            <Card
              title="Patient directory"
              subtitle={`${patients.length} synthetic records`}
              action={
                <div className="search-box">
                  <Search size={16} />
                  <input
                    aria-label="Search patients"
                    placeholder="Search patients..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              }
            >
              <div className="patient-grid">
                {patients
                  .filter((p) =>
                    p.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((p, i) => (
                    <div className="patient-card" key={p.id}>
                      <div className="person">
                        <span className={"avatar a" + (i % 4)}>
                          {p.name
                            .split(" ")
                            .map((s: string) => s[0])
                            .join("")}
                        </span>
                        <div>
                          <h3>{p.name}</h3>
                          <small>
                            {p.age} years · {p.sex}
                          </small>
                        </div>
                        <Badge tone="gray">Synthetic</Badge>
                      </div>
                      <dl>
                        <dt>Medical history</dt>
                        <dd>{p.history || "Not recorded"}</dd>
                        <dt>Medications</dt>
                        <dd>{p.medications || "Not recorded"}</dd>
                        <dt>Allergies</dt>
                        <dd>{p.allergies || "Not recorded"}</dd>
                      </dl>
                      <div className="patient-actions">
                        <button
                          className="text-button"
                          onClick={() => {
                            const c = cases.find((c) => c.patient_id === p.id);
                            if (c) openCase(c);
                            else setModal("case");
                          }}
                        >
                          View cases <ArrowRight size={14} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={"Archive " + p.name}
                          onClick={() =>
                            action(async () => {
                              await api("/patients/" + p.id, "DELETE");
                              await refresh();
                              tell("Patient archived");
                            })
                          }
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
              {!patients.length && (
                <Empty text="Register a synthetic patient to get started." />
              )}
            </Card>
          )}

          {view === "Clinical cases" && (
            <Card
              title="Clinical case directory"
              subtitle="Capture, analyze, and track every assessment"
              action={
                <button className="secondary" onClick={() => setModal("case")}>
                  <Plus size={16} />
                  Create case
                </button>
              }
            >
              <div className="table-toolbar">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    aria-label="Search cases"
                    placeholder="Search name, symptoms, or case ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Filter case status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {[
                    "All cases",
                    "Draft",
                    "Expert review",
                    "Clinician review",
                    "Approved",
                    "Rejected",
                    "Completed",
                    "Additional Information Required",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              {caseTable(shown)}
            </Card>
          )}

          {view === "Agent workspace" && (
            <>
              <div className="case-toolbar">
                {casePicker}
                <div>
                  {active && (
                    <Badge tone={analysis ? "teal" : "gray"}>
                      {active.status}
                    </Badge>
                  )}
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !active ||
                      ["Completed", "Approved", "Rejected"].includes(
                        active?.status,
                      )
                    }
                    onClick={runAnalysis}
                  >
                    {busy ? (
                      <Loader2 size={16} className="spin" />
                    ) : (
                      <Zap size={16} />
                    )}{" "}
                    {analysis ? "Run analysis again" : "Run agent analysis"}
                  </button>
                </div>
              </div>
              {active ? (
                <>
                  <div className="workspace-grid">
                    <Card
                      title="Multi-agent workflow"
                      subtitle={
                        busy
                          ? "Running real server-side graph…"
                          : "Recorded execution trace · LangGraph"
                      }
                      action={
                        <Badge tone="gray">
                          {analysis?.executions.length || 0} / 9 executed
                        </Badge>
                      }
                    >
                      <div className="agent-timeline">
                        {agentNames.map((name, i) => {
                          const execution = analysis?.executions.find(
                            (e: Row) => e.agent === name,
                          );
                          return (
                            <div
                              className={
                                "agent-node " + (execution ? "done" : "")
                              }
                              key={name}
                            >
                              <span className="node-icon">
                                {execution ? (
                                  <Check size={16} />
                                ) : busy ? (
                                  <Loader2 size={15} className="spin" />
                                ) : (
                                  <span>{i + 1}</span>
                                )}
                              </span>
                              <div>
                                <strong>{name} Agent</strong>
                                <p>
                                  {execution
                                    ? `${execution.duration_ms} ms · ${new Date(execution.completed_at).toLocaleTimeString()}`
                                    : i === 7 &&
                                        analysis &&
                                        !analysis.escalation
                                      ? "Not required by router"
                                      : "Awaiting execution"}
                                </p>
                              </div>
                              {execution ? (
                                <Badge>Completed</Badge>
                              ) : (
                                <Badge tone="gray">
                                  {busy ? "Processing" : "Pending"}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                    <div className="stack">
                      <Card
                        title="Case context"
                        subtitle={"CX-" + active.id.slice(0, 8).toUpperCase()}
                      >
                        <div className="case-context">
                          <h2>{active.patient_name}</h2>
                          <label className="upload-area">
                            <FileText size={18} />
                            <strong>Attach clinical document</strong>
                            <span>PDF, DOCX or TXT · Synthetic information only · 5 MB</span>
                            <input type="file" accept=".pdf,.docx,.txt" disabled={busy || ['Completed','Approved','Rejected'].includes(active.status)} onChange={e=>{const file=e.target.files?.[0]; if(file){const body=new FormData();body.append('file',file);action(async()=>{await api('/cases/'+active.id+'/documents','POST',body);await refresh();tell('Clinical document attached. Run analysis to include its text.');});}e.target.value='';}} />
                          </label>
                          {(active.documents||[]).map((d:Row)=><p key={d.id} className="fine-print"><FileText size={12}/>{d.title} · attached patient input</p>)}
                          <p>{active.symptoms}</p>
                          <small>
                            Duration: {active.duration || "Not recorded"}
                          </small>
                          <div className="vital-grid">
                            {Object.entries(active.vitals || {}).map(
                              ([key, value]) => (
                                <div key={key}>
                                  <span>{key.replace("_", " ")}</span>
                                  <strong>
                                    {value === null ? "—" : String(value)}
                                    <small>
                                      {key === "spo2"
                                        ? "%"
                                        : key === "temperature"
                                          ? "°C"
                                          : key === "systolic"
                                            ? "mmHg"
                                            : "bpm"}
                                    </small>
                                  </strong>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      </Card>
                      {analysis && (
                        <Card title="Safety & review routing">
                          <div className="panel-pad">
                            {analysis.safety.length ? (
                              analysis.safety.map((s: string) => (
                                <div key={s} className="safety-alert">
                                  <ShieldAlert size={18} />
                                  <span>{s}</span>
                                </div>
                              ))
                            ) : (
                              <div className="success-note">
                                <ShieldCheck size={18} />
                                No configured safety warning triggered. This
                                does not exclude risk.
                              </div>
                            )}
                            <p className="muted">{analysis.report.status}</p>
                            <div className="button-row">
                              <button
                                className="secondary"
                                onClick={() => setView("Explainability")}
                              >
                                Inspect explanations <ArrowRight size={15} />
                              </button>
                              <button
                                className="secondary"
                                onClick={() => setView("Expert reviews")}
                              >
                                Expert review
                              </button>
                            </div>
                          </div>
                        </Card>
                      )}
                    </div>
                  </div>
                  {analysis && (
                    <Card
                      title="Clinical observations"
                      subtitle="Unverified decision support · no diagnosis or treatment recommendation"
                    >
                      <div className="observation-grid">
                        {analysis.observations.map((o: Row, i: number) => (
                          <div key={i} className="observation">
                            <span className="observation-icon">
                              <Activity size={20} />
                            </span>
                            <h3>{o.factor}</h3>
                            <p>{o.finding}</p>
                            <small>{o.type}</small>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </>
              ) : (
                <Empty text="Create a clinical case to run the agent workflow." />
              )}
            </>
          )}

          {(view === "Explainability" || view === "Uncertainty") && (
            <>
              <div className="case-toolbar">
                {casePicker}
                <button
                  className="secondary"
                  onClick={() => setView("Agent workspace")}
                >
                  View agent workspace <ArrowUpRight size={16} />
                </button>
              </div>
              {analysis ? (
                view === "Explainability" ? (
                  <>
                    <div className="explanation-intro">
                      <span className="explanation-icon">
                        <BrainCircuit size={28} />
                      </span>
                      <div>
                        <h2>Why did the system flag this case?</h2>
                        <p>
                          Recorded inputs, rule interpretations, and retrieved
                          passages are shown separately.
                        </p>
                      </div>
                      <Badge tone="gray">Traceable outputs</Badge>
                    </div>
                    <div className="chart-grid">
                      <Card
                        title="Observation rationale"
                        subtitle="Input attribution · no fabricated SHAP values"
                      >
                        <div className="panel-pad">
                          {analysis.explanations.map((e: Row, i: number) => (
                            <div className="explanation" key={i}>
                              <span>0{i + 1}</span>
                              <div>
                                <Badge tone="blue">{e.agent} Agent</Badge>
                                <h4>{e.statement}</h4>
                                <p>{e.basis}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                      <div className="stack">
                        <Card title="Missing & contradictory information">
                          <div className="panel-pad">
                            {analysis.contradictions.map((c: string) => (
                              <div className="safety-alert" key={c}>
                                <AlertTriangle size={17} />
                                {c}
                              </div>
                            ))}
                            {uncertainty.missing.map((m: string) => (
                              <div className="missing-row" key={m}>
                                <CircleHelp size={15} />
                                <span>
                                  {m.replaceAll("_", " ")} not recorded
                                </span>
                                <Badge tone="amber">Missing</Badge>
                              </div>
                            ))}
                            {!analysis.contradictions.length &&
                              !uncertainty.missing.length && (
                                <p className="muted">
                                  No configured contradiction or missing-field
                                  rule triggered.
                                </p>
                              )}
                          </div>
                        </Card>
                        <Card title="Clinical considerations">
                          <div className="panel-pad">
                            {analysis.considerations.map((c: Row) => (
                              <div key={c.title}>
                                <h4>{c.title}</h4>
                                <p>{c.limitations}</p>
                              </div>
                            ))}
                          </div>
                        </Card>
                      </div>
                    </div>
                    <Card
                      title="Retrieved evidence"
                      subtitle="Source passages with provenance · similarity is not clinical validation"
                    >
                      <div className="evidence-grid">
                        {analysis.evidence.map((e: Row, i: number) => (
                          <div className="evidence" key={i}>
                            <div>
                              <BookOpen size={18} />
                              <Badge tone={e.synthetic ? "amber" : "blue"}>
                                {e.synthetic
                                  ? "Synthetic teaching material"
                                  : "Uploaded reference"}
                              </Badge>
                            </div>
                            <h4>{e.title}</h4>
                            <p>“{e.passage}”</p>
                            <small>{e.source}</small>
                            <div className="evidence-footer">
                              {e.page ? "Page " + e.page : "Page unavailable"}
                              <span>Cosine similarity: {e.relevance}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {!analysis.evidence.length && (
                        <Empty text="No supporting passage was retrieved. Observations remain unsupported by reference material." />
                      )}
                    </Card>
                  </>
                ) : (
                  <>
                    <div className="uncertainty-layout">
                      <Card
                        title="Overall uncertainty"
                        subtitle="Transparent heuristic assessment"
                      >
                        <div className="gauge-wrap">
                          <div
                            className="gauge"
                            style={{
                              background: `conic-gradient(${uncertainty.uncertainty_score > 50 ? "#e2a154" : "#0eaa92"} ${uncertainty.uncertainty_score}%, #edf2f4 0)`,
                            }}
                          >
                            <div>
                              <strong>{uncertainty.uncertainty_score}</strong>
                              <span>OUT OF 100</span>
                            </div>
                          </div>
                          <Badge
                            tone={
                              uncertainty.uncertainty_score > 50
                                ? "amber"
                                : "teal"
                            }
                          >
                            {uncertainty.uncertainty_category} UNCERTAINTY
                          </Badge>
                          <p>
                            Higher scores mean less reliable context.
                            <br />
                            This is independent of clinical risk.
                          </p>
                        </div>
                      </Card>
                      <Card
                        title="What contributes to uncertainty?"
                        subtitle="Each component is a quality deficit, weighted consistently"
                      >
                        <div className="contribution-list">
                          {Object.entries(uncertainty.contributions).map(
                            ([key, value]) => (
                              <div key={key}>
                                <div>
                                  <strong>{key.replaceAll("_", " ")}</strong>
                                  <span>
                                    {String(value)} points{" "}
                                    <small>
                                      · {uncertainty.weights[key] * 100}% weight
                                    </small>
                                  </span>
                                </div>
                                <div className="contribution-track">
                                  <span
                                    style={{
                                      width:
                                        ((value as number) /
                                          (uncertainty.weights[key] * 100)) *
                                          100 +
                                        "%",
                                    }}
                                  />
                                </div>
                                <p>
                                  Quality: {uncertainty[key]}/100 · Contribution
                                  = (100 − quality) × weight
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                      </Card>
                    </div>
                    <div className="chart-grid">
                      <Card title="Reasons & recommended review">
                        <div className="panel-pad">
                          {uncertainty.reasons.map((r: string, i: number) => (
                            <div className="reason" key={r}>
                              <span>{i + 1}</span>
                              <p>{r}</p>
                            </div>
                          ))}
                          <div className="safety-alert">
                            <ShieldCheck size={20} />
                            <span>
                              {analysis.escalation
                                ? "Expert review is required before these observations can be finalized."
                                : "Clinician assessment is required before interpreting these observations."}
                            </span>
                          </div>
                        </div>
                      </Card>
                      <Card title="Methodology & limitations">
                        <div className="panel-pad">
                          <p>{uncertainty.method}</p>
                          <p>
                            0–25 lower · 26–50 moderate · 51–75 high · 76–100
                            very high. These are configurable demonstration
                            categories.
                          </p>
                          <p>
                            Calibration quality is set to zero because no
                            labeled clinical validation dataset has been used.
                            The resulting 20-point contribution is explicitly
                            retained.
                          </p>
                          <p>
                            Agent agreement measures configured consistency
                            checks, rather than independent model ensemble
                            disagreement.
                          </p>
                          <Badge tone="amber">
                            Not a calibrated probability
                          </Badge>
                        </div>
                      </Card>
                    </div>
                  </>
                )
              ) : (
                <Empty text="Run an analysis to see explanations and uncertainty." />
              )}
            </>
          )}

          {view === "Expert reviews" && (
            <>
              <div className="review-summary">
                <ShieldCheck size={25} />
                <div>
                  <h3>Human judgment is the final gate.</h3>
                  <p>
                    AI observations remain unverified until an authorized expert
                    records a decision. Switch to the Expert reviewer demo
                    account to submit a review.
                  </p>
                </div>
                <Badge tone="amber">{stats.pending || 0} pending</Badge>
              </div>
              <div className="review-layout">
                <Card title="Review queue" subtitle="Prioritized escalations">
                  <div className="review-queue">
                    {escalations.map((e) => (
                      <button
                        key={e.id}
                        className={
                          "queue-item " +
                          (active?.id === e.case_id ? "selected" : "")
                        }
                        onClick={() => setSelected(e.case_id)}
                      >
                        <div>
                          <span className="avatar a2">
                            {e.patient_name
                              .split(" ")
                              .map((s: string) => s[0])
                              .join("")}
                          </span>
                          <div>
                            <h4>{e.patient_name}</h4>
                            <small>
                              CX-{e.case_id.slice(0, 8).toUpperCase()}
                            </small>
                          </div>
                          <Badge
                            tone={e.priority === "Urgent" ? "red" : "amber"}
                          >
                            {e.priority}
                          </Badge>
                        </div>
                        <p>{e.reasons[0]}</p>
                        <div>
                          <Badge tone="gray">{e.status}</Badge>
                          <small>{e.score}/100 uncertainty</small>
                        </div>
                      </button>
                    ))}
                    {!escalations.length && (
                      <Empty text="No escalated cases." />
                    )}
                  </div>
                </Card>
                <div className="stack">
                  {active && analysis ? (
                    <>
                      <Card
                        title={active.patient_name}
                        subtitle={"CX-" + active.id.slice(0, 8).toUpperCase()}
                        action={<Badge tone="amber">{active.status}</Badge>}
                      >
                        <div className="panel-pad">
                          <p>
                            <strong>Reported symptoms:</strong>{" "}
                            {active.symptoms}
                          </p>
                          {analysis.safety.map((s: string) => (
                            <div className="safety-alert" key={s}>
                              <ShieldAlert size={18} />
                              {s}
                            </div>
                          ))}
                          <div className="review-facts">
                            <div>
                              <small>Uncertainty</small>
                              <strong>
                                {uncertainty.uncertainty_score}/100
                              </strong>
                            </div>
                            <div>
                              <small>Source passages</small>
                              <strong>{analysis.evidence.length}</strong>
                            </div>
                            <div>
                              <small>Contradictions</small>
                              <strong>{analysis.contradictions.length}</strong>
                            </div>
                          </div>
                          <div className="button-row">
                            <button
                              className="secondary"
                              onClick={() => setView("Explainability")}
                            >
                              Inspect evidence
                            </button>
                            <button
                              className="secondary"
                              onClick={() => setView("Uncertainty")}
                            >
                              Uncertainty details
                            </button>
                          </div>
                          <hr />
                          <Field label="Assign authorized expert">
                            <select
                              aria-label="Assign authorized expert"
                              disabled={user.role === "clinician" || busy}
                              value={
                                escalations.find((e) => e.case_id === active.id)
                                  ?.assigned_to || ""
                              }
                              onChange={(e) => {
                                const escalation = escalations.find(
                                  (es) => es.case_id === active.id,
                                );
                                if (escalation && e.target.value)
                                  action(async () => {
                                    await api(
                                      "/escalations/" +
                                        escalation.id +
                                        "/assign",
                                      "PUT",
                                      { reviewer_id: e.target.value },
                                    );
                                    await refresh();
                                    tell("Expert assigned");
                                  });
                              }}
                            >
                              <option value="">Choose reviewer</option>
                              {users
                                .filter((u) => u.role !== "clinician")
                                .map((u) => (
                                  <option value={u.id} key={u.id}>
                                    {u.name} · {u.role}
                                  </option>
                                ))}
                            </select>
                          </Field>
                          <button
                            className="primary full"
                            disabled={user.role === "clinician" || busy}
                            onClick={() => setModal("review")}
                          >
                            <ShieldCheck size={17} /> Record human review
                          </button>
                          {user.role === "clinician" && (
                            <p className="fine-print">
                              Your clinician role can request escalation. An
                              expert or administrator must record the review.
                            </p>
                          )}
                          <button
                            className="text-button"
                            onClick={() =>
                              action(async () => {
                                await api(
                                  "/cases/" + active.id + "/escalate",
                                  "POST",
                                );
                                await refresh();
                                tell("Expert review requested");
                              })
                            }
                          >
                            Request expert review for this case{" "}
                            <ArrowUpRight size={15} />
                          </button>
                        </div>
                      </Card>
                      {active.review && (
                        <Card title="Recorded human decision">
                          <div className="panel-pad">
                            <Badge>{active.review.decision}</Badge>
                            <h4>{active.review.reviewer_name}</h4>
                            <p>{active.review.notes}</p>
                            <small>
                              {new Date(
                                active.review.reviewed_at,
                              ).toLocaleString()}
                            </small>
                          </div>
                        </Card>
                      )}
                    </>
                  ) : (
                    <Empty text="Select an analyzed case to review." />
                  )}
                </div>
              </div>
            </>
          )}

          {view === "Reports" && (
            <>
              <Card
                title="Generate a decision-support report"
                subtitle="A dated snapshot of observations, evidence, uncertainty, and human review"
              >
                <div className="report-generator">
                  {casePicker}
                  <button
                    className="primary"
                    disabled={busy || !analysis}
                    onClick={() => generateReport()}
                  >
                    <FileText size={17} />
                    Generate report
                  </button>
                </div>
              </Card>
              <Card
                title="Report history"
                subtitle={`${reports.length} generated snapshots`}
              >
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Report</th>
                        <th>Patient</th>
                        <th>Generated</th>
                        <th>Review status</th>
                        <th>Export</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <div className="person">
                              <span className="file-icon">
                                <FileText size={20} />
                              </span>
                              <div>
                                <strong>Decision-support report</strong>
                                <small>{r.id.slice(0, 8)}</small>
                              </div>
                            </div>
                          </td>
                          <td>{r.patient_name}</td>
                          <td>{new Date(r.created_at).toLocaleString()}</td>
                          <td>
                            <Badge tone="gray">{r.status}</Badge>
                          </td>
                          <td>
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => download(r)}
                            >
                              <Download size={15} /> PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!reports.length && (
                    <Empty text="Generate your first report from an analyzed case." />
                  )}
                </div>
              </Card>
            </>
          )}

          {view === "Audit trail" && (
            <Card
              title="Activity & decision history"
              subtitle="Timestamped system actions and human-authored decisions"
              action={<Badge tone="gray">LATEST 100 EVENTS</Badge>}
            >
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Activity</th>
                      <th>Actor</th>
                      <th>Record reference</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <div className="audit-action">
                            <Fingerprint size={16} />
                            <strong>{l.action}</strong>
                          </div>
                        </td>
                        <td>{l.actor}</td>
                        <td>
                          <code>{l.target.slice(0, 14)}</code>
                        </td>
                        <td>{new Date(l.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {user.role === "clinician" && (
                  <Empty text="Audit access requires an expert or administrator account." />
                )}
              </div>
            </Card>
          )}

          {view === "Settings" && (
            <>
              <div className="chart-grid">
                <Card
                  title="System configuration"
                  subtitle="Runtime status and safety policy"
                >
                  <div className="settings-list">
                    {[
                      ["Environment", "Synthetic research demo"],
                      ["Agent runtime", "LangGraph · deterministic local"],
                      [
                        "Storage",
                        health.storage === "ephemeral-demo"
                          ? "Temporary serverless SQLite"
                          : "SQLAlchemy database",
                      ],
                      [
                        "Escalation threshold",
                        "Uncertainty above 50 / safety flags",
                      ],
                      ["Mandatory human review", "Enabled"],
                      ["Statistical calibration", "Unavailable · quality = 0"],
                      [
                        "Retention",
                        "Local until archived; deployment may reset",
                      ],
                    ].map(([key, value]) => (
                      <div key={key}>
                        <span>{key}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card
                  title="Knowledge base"
                  subtitle="PDF, DOCX, TXT · maximum 5 MB"
                >
                  <div className="panel-pad">
                    {knowledge.map((k) => (
                      <div className="knowledge-row" key={k.id}>
                        <BookOpen size={20} />
                        <div>
                          <strong>{k.title}</strong>
                          <small>
                            {k.chunks.length} indexed passages ·{" "}
                            {k.synthetic ? "Synthetic" : "Uploaded"}
                          </small>
                        </div>
                        {user.role === "admin" && (
                          <button
                            className="icon-button"
                            aria-label={"Remove " + k.title}
                            onClick={() =>
                              action(async () => {
                                await api("/knowledge/" + k.id, "DELETE");
                                await refresh();
                              })
                            }
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                    <label
                      className={
                        "upload-area " +
                        (user.role !== "admin" ? "disabled" : "")
                      }
                    >
                      <Plus size={22} />
                      <strong>Upload reference document</strong>
                      <span>
                        {user.role === "admin"
                          ? "Select PDF, DOCX, or TXT"
                          : "Administrator role required"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        disabled={user.role !== "admin" || busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const body = new FormData();
                            body.append("file", file);
                            action(async () => {
                              await api("/knowledge/upload", "POST", body);
                              await refresh();
                              tell("Document extracted and indexed");
                            });
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </Card>
              </div>
              <Card
                title="Workspace users"
                subtitle="Self-registration grants clinician access only"
              >
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <strong>{u.name}</strong>
                          </td>
                          <td>{u.email}</td>
                          <td>
                            <Badge tone="gray">{u.role}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <div className="privacy-box">
                <LockKeyhole size={22} />
                <div>
                  <h3>Privacy & deployment notice</h3>
                  <p>
                    Use synthetic data only. This demonstration is not approved
                    for clinical use. A real healthcare deployment requires
                    durable PostgreSQL, private identity controls, backup and
                    retention policies, independent security testing, clinical
                    validation, and applicable privacy and regulatory review.
                    Shared public demo credentials are disabled when
                    DEMO_MODE=false.
                  </p>
                </div>
              </div>
            </>
          )}
          <div className="workspace-footer">
            <span>
              <ShieldCheck size={13} /> Clinician-led. Evidence-aware.
              Transparent by design.
            </span>
            <span>CLINIXAI · Research v1.0</span>
          </div>
        </main>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => !busy && setModal("")}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "patient"
                ? "Register patient"
                : modal === "review"
                  ? "Record human review"
                  : "New clinical case"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">CLINIXAI WORKSPACE</span>
                <h2>
                  {modal === "patient"
                    ? "Register a patient"
                    : modal === "review"
                      ? "Record human review"
                      : "New clinical case"}
                </h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setModal("")}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>
            {modal === "patient" ? (
              <form onSubmit={submitPatient}>
                <div className="form-grid">
                  <Field label="Synthetic patient name">
                    <input
                      name="name"
                      required
                      minLength={2}
                      placeholder="e.g. Alex Taylor"
                    />
                  </Field>
                  <Field label="Age">
                    <input
                      name="age"
                      type="number"
                      min="0"
                      max="120"
                      required
                    />
                  </Field>
                  <Field label="Sex, where relevant">
                    <select name="sex">
                      <option>Not specified</option>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Intersex</option>
                    </select>
                  </Field>
                  <Field label="Known allergies">
                    <input
                      name="allergies"
                      placeholder="Record none if known"
                    />
                  </Field>
                </div>
                <Field label="Medical history">
                  <textarea name="history" rows={2} />
                </Field>
                <Field label="Current medications">
                  <textarea name="medications" rows={2} />
                </Field>
                <div className="safety-alert">
                  <ShieldCheck size={16} />
                  Use fictional patient details only.
                </div>
                <button className="primary full" disabled={busy}>
                  {busy ? (
                    <Loader2 className="spin" size={16} />
                  ) : (
                    <Plus size={16} />
                  )}
                  Register patient
                </button>
              </form>
            ) : modal === "review" ? (
              <form onSubmit={submitReview}>
                <p className="muted">
                  Your decision is stored with your identity and a timestamp.
                  Approval refers to review of observations, and does not
                  establish a diagnosis.
                </p>
                <Field label="Decision">
                  <select name="decision">
                    <option>Additional Information Required</option>
                    <option>Approved</option>
                    <option>Rejected</option>
                    <option>Completed</option>
                  </select>
                </Field>
                <Field label="Clinician-authored decision & rationale">
                  <textarea
                    name="notes"
                    required
                    minLength={10}
                    rows={6}
                    placeholder="Record your assessment, limitations, and any further information needed..."
                  />
                </Field>
                <button className="primary full" disabled={busy}>
                  <ShieldCheck size={17} />
                  Save human decision
                </button>
              </form>
            ) : (
              <form onSubmit={submitCase}>
                <Field label="Patient">
                  <select
                    name="patient_id"
                    required
                    defaultValue={active?.patient_id || ""}
                  >
                    <option value="" disabled>
                      Select a synthetic patient
                    </option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.age} years
                      </option>
                    ))}
                  </select>
                </Field>
                {!patients.length && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setModal("patient")}
                  >
                    Register a patient first
                  </button>
                )}
                <div className="form-grid">
                  <Field label="Reported symptoms">
                    <input
                      name="symptoms"
                      required
                      minLength={3}
                      placeholder="e.g. Cough and fatigue"
                    />
                  </Field>
                  <Field label="Symptom duration">
                    <input name="duration" placeholder="e.g. 3 days" />
                  </Field>
                </div>
                <span className="form-section">VITAL SIGNS</span>
                <div className="form-grid">
                  {[
                    ["heart_rate", "Heart rate (bpm)", "1", "300", "1"],
                    ["systolic", "Systolic pressure (mmHg)", "1", "300", "1"],
                    ["spo2", "Oxygen saturation (%)", "1", "100", "1"],
                    ["temperature", "Temperature (°C)", "25", "45", "0.1"],
                  ].map(([name, label, min, max, step]) => (
                    <Field key={name} label={label}>
                      <input
                        name={name}
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        placeholder="Not recorded"
                      />
                    </Field>
                  ))}
                </div>
                <Field label="Clinical notes / lab observations">
                  <textarea
                    name="notes"
                    rows={3}
                    placeholder="Record additional observations or discrepancies..."
                  />
                </Field>
                <label className="consent">
                  <input name="consent" type="checkbox" required />
                  <span>
                    I confirm this is synthetic data and consent to its use in
                    this research demonstration. Outputs require qualified human
                    review.
                  </span>
                </label>
                <button
                  className="primary full"
                  disabled={busy || !patients.length}
                >
                  {busy ? (
                    <Loader2 className="spin" size={16} />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                  Create case & open workspace
                </button>
              </form>
            )}
            {error && <div className="inline-error">{error}</div>}
          </div>
        </div>
      )}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={19} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
