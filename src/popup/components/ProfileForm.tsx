import React, { useState } from "react";
import { UserProfile } from '../../types/index';

// ── Props ─────────────────────────────────────────────────────────────────
interface ProfileFormProps {
  initialProfile?: UserProfile;
  onSave?: (profile: UserProfile) => void;
  onAnalyze?: () => void;
  geocodeError?: string | null;
}

const DEFAULT_PROFILE: UserProfile = {
  mode: "drives",
  workLat: 0,
  workLon: 0,
  remoteFrequency: "hybrid",
  hasKids: false,
  hasPet: false,
  mobility: "none",
  ageRange: "20s30s",
  taxSensitive: false,
};

// ── Sub-components ────────────────────────────────────────────────────────

interface TileOption<T extends string> {
  value: T;
  label: string;
  emoji: string;
}

function TileGroup<T extends string>({
  value,
  onChange,
  options,
  small,
}: {
  value: T;
  onChange: (v: T) => void;
  options: TileOption<T>[];
  small?: boolean;
}) {
  return (
    <div style={s.tileGrid}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          style={{
            ...s.tile,
            ...(value === opt.value ? s.tileActive : {}),
            ...(small ? s.tileSmall : {}),
          }}
        >
          <span style={{ fontSize: small ? 34 : 42, lineHeight: 1 }}>{opt.emoji}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function PillToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{ ...s.pill, ...(checked ? s.pillOn : {}) }}
    >
      <span style={{ ...s.pillKnob, ...(checked ? s.pillKnobOn : {}) }} />
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{title}</div>
      {children}
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={s.toggleRowItem}>
      <span style={s.itemIcon}>{icon}</span>
      <span style={s.itemLabel}>{label}</span>
      <PillToggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ProfileForm({
  initialProfile,
  onSave,
  onAnalyze,
  geocodeError = null,
}: ProfileFormProps) {
  const [profile, setProfile] = useState<UserProfile>(initialProfile ?? DEFAULT_PROFILE);
  const [workInput, setWorkInput] = useState("");
  const [geocodeState, setGeocodeState] = useState<"idle" | "loading" | "resolved" | "error">("idle");
  const [savedConfirm, setSavedConfirm] = useState(false);
  const [analyzeHint, setAnalyzeHint] = useState(false);

  const set = <K extends keyof UserProfile>(key: K, val: UserProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: val }));

  const handleWorkBlur = async () => {
    if (!workInput.trim()) return;
    setGeocodeState("loading");
    const result = await new Promise<{ lat: number; lon: number } | null>((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GEOCODE_WORK_LOCATION', payload: workInput.trim() },
        (response) => {
          if (chrome.runtime.lastError || !response || response.error) {
            resolve(null);
          } else {
            resolve({ lat: response.lat, lon: response.lon });
          }
        }
      );
    });
    if (result) {
      set("workLat", result.lat);
      set("workLon", result.lon);
      setGeocodeState("resolved");
    } else {
      setGeocodeState("error");
    }
  };

  const locationResolved = profile.workLat !== 0 && profile.workLon !== 0;

  function handleSave() {
    onSave?.(profile);
    setSavedConfirm(true);
    setTimeout(() => setSavedConfirm(false), 2000);
  }

  function handleAnalyze() {
    if (!locationResolved) {
      setAnalyzeHint(true);
      setTimeout(() => setAnalyzeHint(false), 3000);
      return;
    }
    chrome.runtime.sendMessage({ type: 'TRIGGER_ANALYSIS', payload: profile });
    console.log('[CivicEstate] switching to Results view');
    onAnalyze?.();
  }

  return (
    <div style={s.root}>
      <h1 style={s.pageTitle}>Create Your Profile</h1>
      <p style={s.pageSub}>Tell us about yourself to get personalized recommendations</p>

      <div style={s.shell}>

        <Card title="How do you commute?">
          <TileGroup
            value={profile.mode}
            onChange={(v) => set("mode", v)}
            options={[
              { value: "drives", label: "Drives", emoji: "🚗" },
              { value: "transit", label: "Transit", emoji: "🚌" },
              { value: "walk", label: "Walks", emoji: "🚶" },
            ]}
          />
        </Card>

        <Card title="Where do you work?">
          <input
            type="text"
            placeholder="e.g., San Francisco, CA"
            value={workInput}
            onChange={(e) => {
              setWorkInput(e.target.value);
              setGeocodeState("idle");
              set("workLat", 0);
              set("workLon", 0);
            }}
            onBlur={handleWorkBlur}
            style={{
              ...s.workInput,
              ...(geocodeState === "resolved" ? s.workInputResolved : {}),
              ...(geocodeState === "error" ? s.workInputError : {}),
            }}
            aria-label="Work location"
          />
          {geocodeState === "loading" && <div style={s.geocodeHint}>Resolving location…</div>}
          {geocodeState === "resolved" && (
            <div style={s.geocodeOk}>✓ {workInput} · coordinates resolved</div>
          )}
          {(geocodeState === "error" || geocodeError) && (
            <div style={s.geocodeErr}>{geocodeError ?? "Couldn't resolve — try being more specific"}</div>
          )}
        </Card>

        <Card title="What's your work setup?">
          <TileGroup
            value={profile.remoteFrequency}
            onChange={(v) => set("remoteFrequency", v)}
            options={[
              { value: "remote", label: "Fully Remote", emoji: "🏠" },
              { value: "hybrid", label: "Hybrid", emoji: "📅" },
              { value: "office", label: "In-Office", emoji: "🏢" },
            ]}
          />
        </Card>

        <Card title="Personal Details">
          <div style={s.toggleList}>
            <ToggleRow icon="👶" label="Do you have kids?" checked={profile.hasKids} onChange={(v) => set("hasKids", v)} />
            <ToggleRow icon="🐶" label="Do you have pets?" checked={profile.hasPet} onChange={(v) => set("hasPet", v)} />
            <ToggleRow icon="💰" label="Are you tax sensitive?" checked={profile.taxSensitive} onChange={(v) => set("taxSensitive", v)} />
          </div>
        </Card>

        <Card title="Mobility needs">
          <TileGroup
            small
            value={profile.mobility}
            onChange={(v) => set("mobility", v)}
            options={[
              { value: "none", label: "None", emoji: "🧍" },
              { value: "wheelchair", label: "Wheelchair", emoji: "♿" },
              { value: "elderly", label: "Elderly", emoji: "🦯" },
            ]}
          />
        </Card>

        <Card title="Age range">
          <select
            style={s.ageSelect}
            value={profile.ageRange}
            onChange={(e) => set("ageRange", e.target.value as UserProfile["ageRange"])}
            aria-label="Age range"
          >
            <option value="20s30s">20s–30s</option>
            <option value="40s50s">40s–50s</option>
            <option value="60s">60s+</option>
          </select>
        </Card>

        <button
          onClick={handleSave}
          style={s.saveBtn}
          aria-label="Save profile"
        >
          {savedConfirm ? "Profile saved ✓" : "Save Profile"}
        </button>

        {analyzeHint && (
          <div style={s.analyzeHint}>Enter and confirm a work location first</div>
        )}

        <button
          onClick={handleAnalyze}
          style={{ ...s.analyzeBtn, ...(!locationResolved ? s.analyzeBtnDisabled : {}) }}
          aria-label="Analyze listings"
        >
          Analyze Listings
        </button>

      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const AMBER = "#e8a020";
const AMBER_BG = "#fef8eb";

const s: Record<string, React.CSSProperties> = {
  root: {
    background: "#f5f0e8",
    fontFamily: "'Nunito', system-ui, sans-serif",
    color: "#2d2a24",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "32px 16px 48px",
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: 800,
    letterSpacing: "-0.5px",
    marginBottom: 8,
    textAlign: "center",
  },
  pageSub: {
    fontSize: 15,
    color: "#7a7268",
    marginBottom: 32,
    textAlign: "center",
  },
  shell: {
    width: "100%",
    maxWidth: 640,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    padding: "22px 22px 26px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.055)",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1a1714",
    marginBottom: 16,
  },
  tileGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  },
  tile: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "20px 8px 16px",
    background: "#fff",
    border: "2px solid #ede8df",
    borderRadius: 14,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    color: "#2d2a24",
    fontFamily: "inherit",
    transition: "all 0.15s",
  },
  tileActive: {
    border: `2px solid ${AMBER}`,
    background: AMBER_BG,
  },
  tileSmall: {
    padding: "16px 8px 14px",
  },
  workInput: {
    width: "100%",
    padding: "13px 15px",
    background: "#f5f2ec",
    border: "2px solid transparent",
    borderRadius: 12,
    fontSize: 15,
    fontFamily: "inherit",
    color: "#2d2a24",
    outline: "none",
  },
  workInputResolved: { borderColor: "#60b460", background: "#f5fff5" },
  workInputError: { borderColor: "#e05050" },
  geocodeOk: { fontSize: 12, color: "#4a9e4a", marginTop: 6, fontWeight: 700 },
  geocodeErr: { fontSize: 12, color: "#c04040", marginTop: 6, fontWeight: 600 },
  geocodeHint: { fontSize: 12, color: "#9a9488", marginTop: 6 },
  toggleList: { display: "flex", flexDirection: "column", gap: 10 },
  toggleRowItem: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "#f7f4ee",
    borderRadius: 14,
    padding: "13px 16px",
  },
  itemIcon: { fontSize: 26, width: 38, textAlign: "center", flexShrink: 0 },
  itemLabel: { flex: 1, fontSize: 15, fontWeight: 600 },
  pill: {
    width: 50,
    height: 28,
    borderRadius: 14,
    border: "none",
    cursor: "pointer",
    position: "relative",
    background: "#d0cac0",
    flexShrink: 0,
    padding: 0,
    transition: "background 0.2s",
  },
  pillOn: { background: AMBER },
  pillKnob: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
    transition: "left 0.2s",
  },
  pillKnobOn: { left: 26 },
  ageSelect: {
    width: "100%",
    padding: "13px 16px",
    background: "#f5f2ec",
    border: "2px solid transparent",
    borderRadius: 12,
    fontSize: 15,
    fontFamily: "inherit",
    fontWeight: 600,
    color: "#2d2a24",
    outline: "none",
    appearance: "none" as any,
    cursor: "pointer",
  },
  saveBtn: {
    width: "100%",
    padding: 18,
    borderRadius: 16,
    border: "none",
    background: "linear-gradient(140deg, #f5a623, #e8861a)",
    color: "#fff",
    fontSize: 17,
    fontWeight: 800,
    fontFamily: "inherit",
    cursor: "pointer",
    boxShadow: "0 6px 24px rgba(232,140,26,0.38)",
    marginTop: 4,
  },
  analyzeBtn: {
    width: "100%",
    padding: 18,
    borderRadius: 16,
    border: "none",
    background: "linear-gradient(140deg, #3a8f5c, #2a7048)",
    color: "#fff",
    fontSize: 17,
    fontWeight: 800,
    fontFamily: "inherit",
    cursor: "pointer",
    boxShadow: "0 6px 24px rgba(42,112,72,0.35)",
    marginTop: 4,
  },
  analyzeBtnDisabled: {
    background: "#d4cfc6",
    boxShadow: "none",
    cursor: "not-allowed",
  },
  analyzeHint: {
    fontSize: 13,
    color: "#c04040",
    fontWeight: 600,
    textAlign: "center" as const,
    marginTop: 6,
  },
};
