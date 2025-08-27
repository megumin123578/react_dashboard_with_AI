// PieChart.jsx
import { useTheme } from "@mui/material/styles";
import { ResponsivePie } from "@nivo/pie";
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Box,
  Stack,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from "@mui/material";

/* =========================
   Helpers
========================= */
const n = (v) => (isNaN(+v) ? 0 : +v);
const pad2 = (x) => String(x).padStart(2, "0");
const toYMD = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const formatNumber = (v) =>
  n(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
const formatSeconds = (sec) => {
  const s = Math.floor(n(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m ${r}s`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
};

/* =========================
   Metrics
========================= */
const METRICS = {
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

const METRIC_OPTIONS = [
  { value: "views", label: METRICS.views.label },
  {
    value: "estimatedMinutesWatched",
    label: METRICS.estimatedMinutesWatched.label,
  },
  { value: "averageViewDuration", label: METRICS.averageViewDuration.label },
  {
    value: "averageViewPercentage",
    label: METRICS.averageViewPercentage.label,
  },
  { value: "engagedViews", label: METRICS.engagedViews.label },
];

/* =========================
   Period options (UI)
========================= */
const PERIOD_OPTIONS = [
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
const PERIOD_TO_KEY = {
  last7: "7d",
  last28: "28d",
  last90: "90d",
  last365: "365d",
  lifetime: "lifetime",
  "y-2025": "2025",
  "y-2024": "2024",
};



const _context = require.context(
  "../data",
  true,
  /(^\.\/)?channels\/.*\/traffic_source\/TrafficSource\..*\.(js|ts)$/
);

// Lưu loader theo path
const MODULE_LOADERS = {};
_context.keys().forEach((k) => {
  MODULE_LOADERS[k] = () => Promise.resolve(_context(k));
});

// Lấy danh sách "kênh" = thư mục gốc chứa traffic_source (1 tầng)
function computeChannelsOneLevel() {
  const set = new Set();
  for (const rawKey of _context.keys()) {
    const key = rawKey.replace(/^\.\//, "");
    // Bắt: channels/<channelRoot>/traffic_source/TrafficSource.<key>.*
    const m = key.match(
      /^channels\/([^/]+)\/traffic_source\/TrafficSource\./
    );
    if (m && m[1]) set.add(m[1]); 
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}



// CHỌN 1 TRONG 2 TUỲ THEO CẤU TRÚC CỦA BẠN:
const CHANNEL_ROOTS = computeChannelsOneLevel(); 

const CHANNEL_OPTIONS = CHANNEL_ROOTS.map((root) => ({
  value: root,
  label: root.replace(/\//g, " › "),
}));


async function loadTrafficSourceByChannelAndKey(channelRoot, key) {
  const channelDir = `channels/${channelRoot}/traffic_source`;
  const endings = [
    `${channelDir}/TrafficSource.${key}.js`,
    `${channelDir}/TrafficSource.${key}.ts`,
  ];

  for (const [path, loader] of Object.entries(MODULE_LOADERS)) {
    const normalized = path.replace(/^\.\//, "");
    if (endings.some((suf) => normalized.endsWith(suf))) {
      const mod = await loader();
      const arr = Array.isArray(mod?.default)
        ? mod.default
        : Array.isArray(mod?.traffic_source)
          ? mod.traffic_source
          : [];
      return arr;
    }
  }
  throw new Error(
    `Không tìm thấy TrafficSource.${key}.* trong /src/data/${channelDir}`
  );
}

/* =========================
   Date range từ period
========================= */
function getRangeForPeriod(periodValue, now = new Date()) {
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

/* =========================
   Component
========================= */
const PieChart = () => {
  const theme = useTheme();

  const [metric, setMetric] = useState("views");
  const [period, setPeriod] = useState("last28");

  // Channel: mặc định chọn channel đầu tiên (nếu có)
  const [channel, setChannel] = useState(
    CHANNEL_OPTIONS.length ? CHANNEL_OPTIONS[0].value : ""
  );

  const mconf = METRICS[metric];
  const [tsData, setTsData] = useState([]); // data cho Pie + Table
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Custom range
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // --- Backend fetch (custom hoặc fallback) ---
  const fetchRange = useCallback(
    async (start, end) => {
      setLoading(true);
      setErrorMsg("");
      try {
        const resp = await fetch("/api/traffic_source/range", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Nếu backend cần channel để lọc, gửi kèm:
          body: JSON.stringify({ start, end, channelRoot: channel }),
        });
        if (!resp.ok) {
          const t = await resp.text();
          throw new Error(t || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        if (Array.isArray(data)) {
          setTsData(data);
        } else if (Array.isArray(data.items)) {
          setTsData(data.items);
        } else {
          setTsData([]);
          setErrorMsg("Dữ liệu trả về không đúng định dạng mảng.");
        }
      } catch (e) {
        console.error(e);
        setTsData([]);
        setErrorMsg(e?.message || "Lỗi tải dữ liệu.");
      } finally {
        setLoading(false);
      }
    },
    [channel]
  );

  // --- Load từ file local theo channel + period ---
  const loadPeriodFromFile = useCallback(
    async (periodValue) => {
      if (!channel) {
        setTsData([]);
        setErrorMsg("Không có channel nào trong /src/data/channels.");
        return;
      }
      setLoading(true);
      setErrorMsg("");
      try {
        const key = PERIOD_TO_KEY[periodValue];
        if (!key) throw new Error("Không có key hợp lệ cho period này.");

        const arr = await loadTrafficSourceByChannelAndKey(channel, key);
        setTsData(arr);
      } catch (e) {
        console.warn(
          `Không đọc được file local cho channel="${channel}", period="${periodValue}". Fallback API.`,
          e
        );
        const { start, end } = getRangeForPeriod(periodValue, new Date());
        await fetchRange(start, end);
      } finally {
        setLoading(false);
      }
    },
    [channel, fetchRange]
  );

  // Reload khi channel hoặc period đổi (trừ custom)
  useEffect(() => {
    if (period === "custom") {
      setTsData([]); // chờ user chọn range & Apply
      return;
    }
    loadPeriodFromFile(period);
  }, [period, channel, loadPeriodFromFile]);

  /* =========================
     PIE DATA
  ========================= */
  const pieData = useMemo(() => {
    const src = Array.isArray(tsData) ? tsData : [];
    return src.map((d, i) => {
      const id = d.id ?? d.label ?? d.insightTrafficSourceType ?? `item-${i}`;
      const label = d.label ?? d.insightTrafficSourceType ?? `item-${i}`;
      const value = mconf.valueOf(d);
      return { id, label, value };
    });
  }, [tsData, mconf]);

  const pieTotal = useMemo(
    () => pieData.reduce((s, d) => s + n(d.value), 0),
    [pieData]
  );

  /* =========================
     Tooltip
  ========================= */
  const Tooltip = ({ datum }) => {
    const pct =
      pieTotal > 0 ? ((datum.value / pieTotal) * 100).toFixed(1) : "0.0";
    const fmt =
      metric === "averageViewPercentage"
        ? `${n(datum.value).toFixed(2)}%`
        : metric === "averageViewDuration"
          ? formatSeconds(datum.value)
          : formatNumber(datum.value);

    return (
      <Box
        sx={{
          px: 1.25,
          py: 0.75,
          borderRadius: 1,
          boxShadow: 3,
          fontSize: 13,
          fontWeight: 600,
          color:
            theme.palette.mode === "dark"
              ? theme.palette.grey[100]
              : theme.palette.grey[900],
          bgcolor:
            theme.palette.mode === "dark"
              ? "rgba(0,0,0,0.75)"
              : "rgba(255,255,255,0.95)",
          border: `1px solid ${theme.palette.mode === "dark"
            ? "rgba(255,255,255,0.12)"
            : "rgba(0,0,0,0.08)"
            }`,
        }}
      >
        <div style={{ marginBottom: 4 }}>{datum.label}</div>
        <div>{METRICS[metric].label}: {fmt}</div>
        <div>%: {pct}%</div>
      </Box>
    );
  };

  /* =========================
     Center Label
  ========================= */
  const CenterLabel = ({ centerX, centerY }) => (
    <g transform={`translate(${centerX}, ${centerY})`}>
      <text
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: 12,
          fill:
            theme.palette.mode === "dark"
              ? theme.palette.grey[300]
              : theme.palette.grey[700],
          fontWeight: 600,
        }}
        y={-8}
      >
        {METRICS[metric].label}
      </text>
      <text
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: 16,
          fill:
            theme.palette.mode === "dark"
              ? theme.palette.grey[100]
              : theme.palette.grey[900],
          fontWeight: 800,
        }}
        y={12}
      >
        {metric === "averageViewPercentage"
          ? `${pieTotal.toFixed(2)}`
          : metric === "averageViewDuration"
            ? formatSeconds(pieTotal)
            : formatNumber(pieTotal)}
      </text>
    </g>
  );

  /* =========================
     TABLE DATA
  ========================= */
  const { totals, rows } = useMemo(() => {
    const src = Array.isArray(tsData) ? tsData : [];

    const rawRows = src.map((d, i) => {
      const id = d.id ?? d.label ?? d.insightTrafficSourceType ?? `item-${i}`;
      const label = d.label ?? d.insightTrafficSourceType ?? `item-${i}`;
      const views = n(d.views);
      const emw = n(d.estimatedMinutesWatched);
      const avgDur = n(d.averageViewDuration);
      const avgPct = n(d.averageViewPercentage);
      const engaged = n(d.engagedViews);
      return {
        id,
        label,
        views,
        estimatedMinutesWatched: emw,
        averageViewDuration: avgDur,
        averageViewPercentage: avgPct,
        engagedViews: engaged,
        sortValue: METRICS[metric].valueOf(d),
      };
    });

    const tViews = rawRows.reduce((s, r) => s + r.views, 0);
    const tEmw = rawRows.reduce((s, r) => s + r.estimatedMinutesWatched, 0);
    const tEng = rawRows.reduce((s, r) => s + r.engagedViews, 0);

    const wAvgDur =
      tViews > 0
        ? rawRows.reduce((s, r) => s + r.averageViewDuration * r.views, 0) /
        tViews
        : 0;
    const wAvgPct =
      tViews > 0
        ? rawRows.reduce((s, r) => s + r.averageViewPercentage * r.views, 0) /
        tViews
        : 0;

    const rows = rawRows
      .map((r) => ({
        ...r,
        viewsPct: tViews > 0 ? (r.views / tViews) * 100 : 0,
        emwPct: tEmw > 0 ? (r.estimatedMinutesWatched / tEmw) * 100 : 0,
        engagedPct: tEng > 0 ? (r.engagedViews / tEng) * 100 : 0,
      }))
      .sort((a, b) => b.sortValue - a.sortValue);

    return {
      totals: {
        views: tViews,
        estimatedMinutesWatched: tEmw,
        averageViewDuration: wAvgDur,
        averageViewPercentage: wAvgPct,
        engagedViews: tEng,
      },
      rows,
    };
  }, [tsData, metric]);

  /* =========================
     Render
  ========================= */
  return (
    <Stack spacing={1.5}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={2}
        sx={{ px: 1, flexWrap: "wrap", rowGap: 1.25 }}
      >
        {/* Metric selector */}
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="metric-select-label">Metric</InputLabel>
          <Select
            labelId="metric-select-label"
            id="metric-select"
            value={metric}
            label="Metric"
            onChange={(e) => setMetric(e.target.value)}
          >
            {METRIC_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Period selector */}
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="period-select-label">Period</InputLabel>
          <Select
            labelId="period-select-label"
            id="period-select"
            value={period}
            label="Period"
            onChange={(e) => setPeriod(e.target.value)}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Custom date range */}
        {period === "custom" && (
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box>
              <Typography variant="caption" sx={{ display: "block", mb: 0.5 }}>
                Start date
              </Typography>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ display: "block", mb: 0.5 }}>
                End date
              </Typography>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Box>
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                if (!startDate || !endDate) {
                  setErrorMsg("Hãy chọn đủ Start date và End date.");
                  return;
                }
                if (new Date(startDate) > new Date(endDate)) {
                  setErrorMsg("Start date phải <= End date.");
                  return;
                }
                fetchRange(startDate, endDate);
              }}
              disabled={loading}
            >
              {loading ? "Loading..." : "Apply"}
            </Button>
          </Stack>
        )}

        {/* Channel selector (đẩy sang phải) */}
        <FormControl size="small" sx={{ minWidth: 260, ml: "auto" }}>
          <InputLabel id="channel-select-label">Channel</InputLabel>
          <Select
            labelId="channel-select-label"
            id="channel-select"
            value={channel}
            label="Channel"
            onChange={(e) => setChannel(e.target.value)}
          >
            {CHANNEL_OPTIONS.length === 0 ? (
              <MenuItem value="" disabled>
                (Không tìm thấy channel nào)
              </MenuItem>
            ) : (
              CHANNEL_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>

        {/* Error message */}
        {errorMsg && (
          <Typography variant="body2" color="error">
            {errorMsg}
          </Typography>
        )}
      </Stack>


      {/* PIE */}
      <Box sx={{ height: 420 }}>
        <ResponsivePie
          data={pieData}
          colors={{ scheme: "set2" }}
          borderWidth={1}
          borderColor={{ from: "color", modifiers: [["darker", 0.2]] }}
          margin={{ top: 30, right: 24, bottom: 60, left: 24 }}
          innerRadius={0.55}
          padAngle={0.7}
          cornerRadius={3}
          activeOuterRadiusOffset={8}
          valueFormat={(v) =>
            metric === "averageViewPercentage"
              ? `${n(v).toFixed(2)}%`
              : metric === "averageViewDuration"
                ? formatSeconds(v)
                : formatNumber(v)
          }
          sortByValue
          enableArcLinkLabels
          arcLinkLabelsSkipAngle={8}
          arcLinkLabelsTextColor={
            theme.palette.mode === "dark" ? "#eee" : "#111"
          }
          arcLinkLabelsThickness={2}
          arcLinkLabelsColor={{ from: "color" }}
          enableArcLabels
          arcLabelsRadiusOffset={0.42}
          arcLabelsSkipAngle={10}
          arcLabelsComponent={() => (
            <text
              textAnchor="middle"
              dominantBaseline="central"
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                fill:
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.92)"
                    : "rgba(0,0,0,0.82)",
                paintOrder: "stroke",
                strokeWidth: 3,
                stroke:
                  theme.palette.mode === "dark"
                    ? "rgba(0,0,0,0.45)"
                    : "rgba(255,255,255,0.9)",
              }}
            />
          )}
          tooltip={Tooltip}
          theme={{
            background: "transparent",
            textColor: theme.palette.mode === "dark" ? "#eee" : "#111",
          }}
          motionConfig="gentle"
          legends={[
            {
              anchor: "bottom",
              direction: "row",
              translateY: 40,
              itemWidth: 130,
              itemHeight: 18,
              itemsSpacing: 8,
              symbolSize: 12,
              symbolShape: "circle",
              itemTextColor: theme.palette.mode === "dark" ? "#eee" : "#111",
            },
          ]}
          layers={["arcs", "arcLabels", "arcLinkLabels", "legends", CenterLabel]}
        />
      </Box>

      {/* TABLE */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          mt: 1,
          border: `1px solid ${theme.palette.mode === "dark"
            ? "rgba(255,255,255,0.12)"
            : "rgba(0,0,0,0.08)"
            }`,
          borderRadius: 1.5,
          overflowX: "auto",
        }}
      >
        <Table size="small" stickyHeader sx={{ minWidth: 980 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Source</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Views
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Estimated Minutes
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Avg View Duration
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Engaged Views
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{r.label}</TableCell>
                <TableCell align="right">{formatNumber(r.views)}</TableCell>
                <TableCell align="right">
                  {formatNumber(r.estimatedMinutesWatched)}
                </TableCell>
                <TableCell align="right">
                  {formatSeconds(r.averageViewDuration)}
                </TableCell>
                <TableCell align="right">
                  {formatNumber(r.engagedViews)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Tổng</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {formatNumber(totals.views)}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {formatNumber(totals.estimatedMinutesWatched)}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {formatSeconds(totals.averageViewDuration)}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {formatNumber(totals.engagedViews)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
};

export default PieChart;
