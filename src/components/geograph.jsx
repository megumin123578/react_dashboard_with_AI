// GeographyChart.jsx
import { useMemo, useState } from "react";
import { useTheme } from "@mui/material/styles";
import {
  Box,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  TableContainer,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableFooter,
} from "@mui/material";
import { ResponsiveChoropleth } from "@nivo/geo";
import { geoFeatures } from "../data/mockGeoFeatures";
import { tokens } from "../theme";
import { geography as rawData } from "../data/Geography";

// ===== Helpers =====
const n = (v) => Number(v) || 0;
const formatSeconds = (s) => {
  const sec = Math.max(0, Math.floor(n(s)));
  const m = Math.floor(sec / 60);
  const r = String(sec % 60).padStart(2, "0");
  return `${m}:${r}`;
};
const formatNumber = (v) => n(v).toLocaleString();
const percentStr = (p) => `${n(p).toFixed(2)}%`;

// ===== Metric config =====
const METRICS = {
  views: {
    key: "views",
    label: "Views",
    valueOf: (d) => n(d.views ?? d.value),
    fmt: (v) => formatNumber(v),
    isAverage: false,
  },
  estimatedMinutesWatched: {
    key: "estimatedMinutesWatched",
    label: "Estimated Minutes Watched",
    valueOf: (d) => n(d.estimatedMinutesWatched),
    fmt: (v) => formatNumber(v),
    isAverage: false,
  },
  averageViewDuration: {
    key: "averageViewDuration",
    label: "Avg View Duration (sec)",
    valueOf: (d) => n(d.averageViewDuration),
    fmt: (v) => formatSeconds(v),
    isAverage: true,
  },
  averageViewPercentage: {
    key: "averageViewPercentage",
    label: "Avg View %",
    valueOf: (d) => n(d.averageViewPercentage),
    fmt: (v) => `${n(v).toFixed(2)}%`,
    isAverage: true,
  },
  engagedViews: {
    key: "engagedViews",
    label: "Engaged Views",
    valueOf: (d) => n(d.engagedViews),
    fmt: (v) => formatNumber(v),
    isAverage: false,
  },
};

const METRIC_OPTIONS = [
  { value: "views", label: METRICS.views.label },
  { value: "estimatedMinutesWatched", label: METRICS.estimatedMinutesWatched.label },
  { value: "averageViewDuration", label: METRICS.averageViewDuration.label },
  { value: "averageViewPercentage", label: METRICS.averageViewPercentage.label },
  { value: "engagedViews", label: METRICS.engagedViews.label },
];

const GeographyChart = ({ isDashboard = false }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  // ===== chọn metric cho MAP =====
  const [metric, setMetric] = useState("views");
  const mconf = METRICS[metric];

  // ===== Tạo bộ chuyển ID: ISO2 -> feature.id(ISO3) + map id->name =====
  const resolvers = useMemo(() => {
    const iso2ToFeatureId = new Map();
    const idToName = new Map();

    for (const f of geoFeatures?.features || []) {
      const featureId = String(f?.id ?? f?.properties?.iso_a3 ?? "");
      const iso2 = f?.properties?.iso_a2
        ? String(f.properties.iso_a2).toUpperCase()
        : "";
      const name = f?.properties?.name || featureId;

      if (featureId) idToName.set(featureId, name);
      if (iso2) iso2ToFeatureId.set(iso2, featureId);
    }

    // Fallback cho khi geoFeatures không có iso_a2
    const fallbackIso2to3 = {
      ID: "IDN",
      IN: "IND",
      PH: "PHL",
      UZ: "UZB",
      US: "USA",
      GB: "GBR",
      VN: "VNM",
      TH: "THA",
      // cần thêm thì bổ sung ở đây
    };

    const resolveId = (id) => {
      if (!id) return "";
      const s = String(id).toUpperCase();
      return iso2ToFeatureId.get(s) || fallbackIso2to3[s] || s;
    };

    const nameOf = (fid) => idToName.get(fid) || String(fid || "");
    return { resolveId, nameOf };
  }, []);

  // ===== Chuẩn hoá data: id ISO2 -> id ISO3 =====
  const data = useMemo(() => {
    const src = Array.isArray(rawData) ? rawData : [];
    return src.map((d) => {
      const fid = resolvers.resolveId(d.id);
      return { ...d, id: fid, label: resolvers.nameOf(fid) };
    });
  }, [resolvers]);

  // ===== dữ liệu cho MAP theo metric đang chọn =====
  const mapData = useMemo(() => {
    return data.map((d) => ({
      id: d.id, // đã là ISO3
      value: mconf.valueOf(d),
    }));
  }, [data, mconf]);

  // Tổng + domain cho MAP
  const { mapTotal, domainMax } = useMemo(() => {
    const vals = mapData.map((d) => n(d.value));
    const total = vals.reduce((s, v) => s + v, 0);
    const maxV = Math.max(1, ...vals, 1);
    const domainMax = metric === "averageViewPercentage" ? 100 : maxV;
    return { mapTotal: total, domainMax };
  }, [mapData, metric]);

  // ===== Tooltip custom cho MAP =====
  const MapTooltip = ({ feature }) => {
    const id =
      feature?.id ?? feature?.feature?.id ?? feature?.data?.id ?? "";
    const name =
      feature?.properties?.name ??
      feature?.feature?.properties?.name ??
      feature?.data?.label ??
      String(id || "");
    const val =
      feature?.value ??
      feature?.data?.value ??
      0;

    let pctLine = null;
    if (!mconf.isAverage && mapTotal > 0) {
      const pct = (n(val) / mapTotal) * 100;
      pctLine = <div>%: {percentStr(pct)}</div>;
    }

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
        <div style={{ marginBottom: 4 }}>{name}</div>
        <div>{mconf.label}: {mconf.fmt(val)}</div>
        {pctLine}
      </Box>
    );
  };

  // ===== BẢNG: totals + rows (hiển thị TẤT CẢ metric, thêm % ) =====
  const { totals, rows } = useMemo(() => {
    const rawRows = data.map((d) => ({
      id: d.id,
      label: d.label || d.id,
      views: n(d.views ?? d.value),
      estimatedMinutesWatched: n(d.estimatedMinutesWatched),
      averageViewDuration: n(d.averageViewDuration),
      averageViewPercentage: n(d.averageViewPercentage), // <-- Thêm %
      engagedViews: n(d.engagedViews),
      sortValue: METRICS[metric].valueOf(d),
    }));

    const tViews = rawRows.reduce((s, r) => s + r.views, 0);
    const tEmw = rawRows.reduce((s, r) => s + r.estimatedMinutesWatched, 0);
    const tEng = rawRows.reduce((s, r) => s + r.engagedViews, 0);

    const wAvgDur =
      tViews > 0
        ? rawRows.reduce((s, r) => s + r.averageViewDuration * r.views, 0) / tViews
        : 0;

    // Trung bình trọng số cho Avg View %
    const wAvgPct =
      tViews > 0
        ? rawRows.reduce((s, r) => s + r.averageViewPercentage * r.views, 0) / tViews
        : 0;

    const rows = rawRows
      .map((r) => ({
        ...r,
        viewsPct: tViews > 0 ? (r.views / tViews) * 100 : 0,
        emwPct: tEmw > 0 ? (r.estimatedMinutesWatched / tEmw) * 100 : 0,
        engagedPct: tEng > 0 ? (r.engagedViews / tEng) * 100 : 0,
        // thanh progress cho Avg View % dùng chính % (0..100)
        avgPctBar: Math.max(0, Math.min(100, r.averageViewPercentage)),
      }))
      .sort((a, b) => b.sortValue - a.sortValue);

    return {
      totals: {
        views: tViews,
        estimatedMinutesWatched: tEmw,
        averageViewDuration: wAvgDur,
        averageViewPercentage: wAvgPct, // <-- Tổng theo weighted average
        engagedViews: tEng,
      },
      rows,
    };
  }, [data, metric]);

  // Thay toàn bộ MetricCell cũ:
  const MetricCell = ({ value, pct, formatter }) => {
    const hasPct = Number.isFinite(pct);
    const clamped = hasPct ? Math.max(0, Math.min(100, pct)) : 0;

    return (
      <Box sx={{ position: "relative", minWidth: 160, px: 1, py: 0.5 }}>
        {/* Nền & thanh tiến độ: chỉ hiện khi có pct */}
        {hasPct && (
          <>
            <Box
              sx={{
                position: "absolute",
                inset: 6,
                borderRadius: 1,
                bgcolor:
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(0,0,0,0.03)",
              }}
            />
            <Box
              sx={{
                position: "absolute",
                left: 6,
                right: `${100 - clamped}%`,
                top: 6,
                bottom: 6,
                borderRadius: 1,
                bgcolor: "success.main",
                opacity: 0.35,
                transition: "right 220ms ease",
              }}
            />
          </>
        )}

        <Box
          sx={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: hasPct ? "space-between" : "flex-end", // <-- quan trọng
            width: "100%",
            fontVariantNumeric: "tabular-nums",
            gap: 1,
            textAlign: hasPct ? "left" : "right",
          }}
        >
          {hasPct && (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {percentStr(clamped)}
            </Typography>
          )}
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {formatter(value)}
          </Typography>
        </Box>
      </Box>
    );
  };



  return (
    <Stack spacing={1.5}>
      {/* Bộ chọn metric cho MAP */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ px: 1 }}>
        <FormControl size="small" sx={{ minWidth: 260 }}>
          <InputLabel id="metric-select-label">Metric (for Map)</InputLabel>
          <Select
            labelId="metric-select-label"
            id="metric-select"
            value={metric}
            label="Metric (for Map)"
            onChange={(e) => setMetric(e.target.value)}
          >
            {METRIC_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          Bảng hiển thị toàn bộ metric
        </Typography>
      </Stack>

      {/* ===== MAP ===== */}
      <Box sx={{ height: isDashboard ? 360 : 520 }}>
        <ResponsiveChoropleth
          data={mapData}
          features={geoFeatures.features}
          label="properties.name"
          valueFormat={(v) =>
            metric === "averageViewPercentage"
              ? `${n(v).toFixed(2)}%`
              : metric === "averageViewDuration"
                ? formatSeconds(v)
                : formatNumber(v)
          }
          tooltip={MapTooltip}
          theme={{
            axis: {
              domain: { line: { stroke: colors.grey[100] } },
              legend: { text: { fill: colors.grey[100] } },
              ticks: {
                line: { stroke: colors.grey[100], strokeWidth: 1 },
                text: { fill: colors.grey[100] },
              },
            },
            legends: { text: { fill: colors.grey[100] } },
            background: "transparent",
          }}
          margin={{ top: 0, right: 0, bottom: 36, left: 0 }}
          domain={[0, domainMax]}
          unknownColor={theme.palette.mode === "dark" ? "#555" : "#e0e0e0"}
          projectionScale={isDashboard ? 40 : 150}
          projectionTranslation={isDashboard ? [0.49, 0.6] : [0.5, 0.5]}
          projectionRotation={[0, 0, 0]}
          borderWidth={1.2}
          borderColor={
            theme.palette.mode === "dark" ? "rgba(255,255,255,0.85)" : "#ffffff"
          }
          legends={
            !isDashboard
              ? [
                {
                  anchor: "bottom-left",
                  direction: "column",
                  justify: false,
                  translateX: 12,
                  translateY: -12,
                  itemsSpacing: 4,
                  itemWidth: 120,
                  itemHeight: 20,
                  itemDirection: "left-to-right",
                  itemTextColor: colors.grey[100],
                  itemOpacity: 0.9,
                  symbolSize: 14,
                  effects: [
                    {
                      on: "hover",
                      style: { itemTextColor: "#ffffff", itemOpacity: 1 },
                    },
                  ],
                },
              ]
              : undefined
          }
        />
      </Box>

      {/* ===== TABLE ===== */}
      <TableContainer
        component={Paper}
        elevation={0}
        // TableContainer sx={{ ... }}
        sx={{
          mt: 2,
          bgcolor: theme.palette.mode === "dark" ? "rgba(12,12,20,0.92)" : "#fff",
          border: `1px solid ${theme.palette.mode === "dark" ? "#22314f" : "#e3e9f6"}`,
          borderRadius: 12,
          overflow: "auto",
          boxShadow: theme.palette.mode === "dark"
            ? "0 6px 24px rgba(0,0,0,0.45)"
            : "0 8px 20px rgba(13, 63, 138, 0.06)",
        }}

      >
        <Table size="small" stickyHeader sx={{ minWidth: 1140 }}>
          <TableHead>
            <TableRow
              sx={{
                // Trong TableHead > TableRow sx={{ "& th": { ... } }}
                "& th": {
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  fontSize: 12,
                  bgcolor: theme.palette.mode === "dark" ? "#0f1b2d" : "#eaf2ff", // đổi nền
                  color: theme.palette.mode === "dark" ? "#e6f1ff" : "#0f1b2d",   // thêm màu chữ
                  borderBottom: `1px solid ${theme.palette.mode === "dark" ? "#1d2a44" : "#cdd8f3"}`,
                },

              }}
            >
              <TableCell sx={{ minWidth: 220 }}>Quốc gia</TableCell>
              <TableCell align="right" sx={{ minWidth: 170 }}>
                Views
              </TableCell>
              <TableCell align="right" sx={{ minWidth: 200 }}>
                Estimated Minutes
              </TableCell>
              <TableCell align="right" sx={{ minWidth: 170 }}>
                Avg View Duration
              </TableCell>
              {/* NEW: Avg View % */}
              <TableCell align="right" sx={{ minWidth: 170 }}>
                Avg View %
              </TableCell>
              <TableCell align="right" sx={{ minWidth: 200 }}>
                Engaged Views
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.id}
                hover
                sx={{
                  "&:nth-of-type(odd)": {
                    bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#f9fbff",
                  },
                  "&:hover": {
                    bgcolor: theme.palette.mode === "dark" ? "rgba(46, 89, 144, 0.22)" : "rgba(46, 89, 144, 0.08)",
                  },
                  transition: "background-color 160ms ease",
                }}
              >
                <TableCell sx={{ fontWeight: 600 }}>{r.label}</TableCell>

                <TableCell align="right" sx={{ p: 0, pr: 1.5 }}>
                  <MetricCell
                    value={r.views}
                    pct={totals.views ? (r.views / totals.views) * 100 : 0}
                    formatter={formatNumber}
                  />
                </TableCell>

                <TableCell align="right" sx={{ p: 0, pr: 1.5 }}>
                  <MetricCell
                    value={r.estimatedMinutesWatched}
                    pct={
                      totals.estimatedMinutesWatched
                        ? (r.estimatedMinutesWatched /
                          totals.estimatedMinutesWatched) *
                        100
                        : 0
                    }
                    formatter={formatNumber}
                  />
                </TableCell>

                <TableCell
                  align="right"
                  sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
                  title={`${r.averageViewDuration} sec`}
                >
                  {formatSeconds(r.averageViewDuration)}
                </TableCell>

                {/*: Avg View % per row */}
                <TableCell align="right" sx={{ p: 0, pr: 1.5 }}>
                  <MetricCell
                    value={r.averageViewPercentage}
                    formatter={percentStr}
                  />
                </TableCell>

                <TableCell align="right" sx={{ p: 0, pr: 1.5 }}>
                  <MetricCell
                    value={r.engagedViews}
                    pct={
                      totals.engagedViews
                        ? (r.engagedViews / totals.engagedViews) * 100
                        : 0
                    }
                    formatter={formatNumber}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>

          <TableFooter>
            <TableRow
              sx={{
                position: "sticky",
                bottom: 0,
                zIndex: 1,
                backdropFilter: "saturate(180%) blur(6px)",
                bgcolor: theme.palette.mode === "dark" ? "rgba(9,20,38,0.92)" : "rgba(245,249,255,0.92)",
                "& td": {
                  borderTop: "1px solid",
                  borderColor: theme.palette.mode === "dark" ? "#233454" : "#cdd8f3",
                  color: theme.palette.mode === "dark" ? "#e6f1ff" : "#0f1b2d",
                },
              }}
            >
              <TableCell sx={{ fontWeight: 800 }}>Tổng</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>
                {formatNumber(totals.views)}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>
                {formatNumber(totals.estimatedMinutesWatched)}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>
                {formatSeconds(totals.averageViewDuration)}
              </TableCell>
              {/* NEW: Tổng Avg View % (weighted average) */}
              <TableCell align="right" sx={{ fontWeight: 800 }}>
                {percentStr(totals.averageViewPercentage)}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>
                {formatNumber(totals.engagedViews)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </Stack>
  );
};

export default GeographyChart;
