

// ===== Helpers =====
export const n = (v) => (isNaN(+v) ? 0 : +v);
export const pad2 = (x) => String(x).padStart(2, "0");
export const toYMD = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const formatNumber = (v) =>
  n(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
export const formatSeconds = (sec) => {
  const s = Math.floor(n(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m ${r}s`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
};

// ===== Metrics =====
export const METRICS = {
  views: { label: "Views", valueOf: (d) => n(d.views) },
  estimatedMinutesWatched: {
    label: "Estimated Minutes",
    valueOf: (d) => n(d.estimatedMinutesWatched),
  },
  averageViewDuration: {
    label: "Avg View Duration (s)",
    valueOf: (d) => n(d.averageViewDuration),
  },
  averageViewPercentage: {
    label: "Avg View %",
    valueOf: (d) => n(d.averageViewPercentage),
  },
  engagedViews: { label: "Engaged Views", valueOf: (d) => n(d.engagedViews) },
};

export const METRIC_OPTIONS = [
  { value: "views", label: METRICS.views.label },
  { value: "estimatedMinutesWatched", label: METRICS.estimatedMinutesWatched.label },
  { value: "averageViewDuration", label: METRICS.averageViewDuration.label },
  { value: "averageViewPercentage", label: METRICS.averageViewPercentage.label },
  { value: "engagedViews", label: METRICS.engagedViews.label },
];

// ===== Periods =====
export const PERIOD_OPTIONS = [
  { value: "last7", label: "Last 7 days" },
  { value: "last28", label: "Last 28 days" },
  { value: "last90", label: "Last 90 days" },
  { value: "last365", label: "Last 365 days" },
  { value: "lifetime", label: "Lifetime" },
  { value: "y-2025", label: "2025" },
  { value: "y-2024", label: "2024" },
  { value: "custom", label: "Custom (date range)" },
];

// UI period -> key trong tên file TrafficSource.<key>.(js|ts)
export const PERIOD_TO_KEY = {
  last7: "7d",
  last28: "28d",
  last90: "90d",
  last365: "365d",
  lifetime: "lifetime",
  "y-2025": "2025",
  "y-2024": "2024",
};

export function getRangeForPeriod(periodValue, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneDay = 24 * 60 * 60 * 1000;
  const rangeDays = (days) => {
    const end = today;
    const start = new Date(end.getTime() - (days - 1) * oneDay);
    return { start: toYMD(start), end: toYMD(end) };
  };

  if (periodValue === "last7") return rangeDays(7);
  if (periodValue === "last28") return rangeDays(28);
  if (periodValue === "last90") return rangeDays(90);
  if (periodValue === "last365") return rangeDays(365);
  if (periodValue === "lifetime") return { start: null, end: null };
  if (periodValue.startsWith("y-")) {
    const y = Number(periodValue.split("-")[1]);
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
  if (periodValue === "custom") return { start: null, end: null };
  return { start: null, end: null };
}

// ===== Data loader (hỗ trợ cả Vite & Webpack) =====
// Mặc định dữ liệu ở: /src/data/channels/<channel>/traffic_source/TrafficSource.<key>.{js,ts}
let __entries = [];

/* Vite (khuyên dùng khi dùng Vite) */
try {
  if (typeof import.meta !== "undefined" && import.meta.glob) {
    const mods = import.meta.glob(
      "/src/data/channels/**/traffic_source/TrafficSource.*.{js,ts}",
      { eager: true }
    );
    __entries = Object.entries(mods).map(([abs, mod]) => ({ path: abs, mod }));
  }
} catch { /* ignore */ }

/* Webpack fallback (CRA) */
if (!__entries.length) {
  try {
    // Điều chỉnh đường dẫn nếu module này KHÔNG ở src/lib: dùng "../data" thay vì "../../data"
    const ctx = require.context(
      "../data",
      true,
      /^\.\/channels\/.*\/traffic_source\/TrafficSource\..*\.(js|ts)$/
    );
    __entries = ctx.keys().map((rel) => ({
      // Chuẩn hóa về dạng giống Vite để regex đồng nhất
      path: "/src/data/" + rel.replace(/^\.\//, ""),
      mod: ctx(rel),
    }));
  } catch { /* ignore */ }
}

export function computeChannels() {
  const set = new Set();
  const re = /\/channels\/([^/]+)\/traffic_source\/TrafficSource\./;
  for (const e of __entries) {
    const m = e.path.match(re);
    if (m && m[1]) set.add(m[1]);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export const CHANNEL_OPTIONS = computeChannels().map((root) => ({
  value: root,
  label: root.replace(/\//g, " › "),
}));

export async function loadTrafficSourceByChannelAndKey(channelRoot, key) {
  const re = new RegExp(
    `/channels/${channelRoot}/traffic_source/TrafficSource\\.${key}\\.(js|ts)$`
  );
  const entry = __entries.find((e) => re.test(e.path));
  if (!entry) {
    throw new Error(
      `Không tìm thấy TrafficSource.${key}.* cho channel "${channelRoot}"`
    );
  }
  const mod = entry.mod;
  const arr = Array.isArray(mod?.default)
    ? mod.default
    : Array.isArray(mod?.traffic_source)
    ? mod.traffic_source
    : [];
  return arr;
}

