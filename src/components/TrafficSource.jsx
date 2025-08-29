// src/components/PieChart.jsx
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useTheme } from "@mui/material/styles";
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

import { ResponsivePie } from "@nivo/pie";
import { ResponsiveLine } from "@nivo/line";
import { ResponsiveBar } from "@nivo/bar";

import {
  n,
  formatNumber,
  formatSeconds,
  METRICS,
  METRIC_OPTIONS,
  PERIOD_OPTIONS,
  PERIOD_TO_KEY,
  getRangeForPeriod,
  CHANNEL_OPTIONS,
  loadTrafficSourceByChannelAndKey,
} from "./trafficModule";
import { API_BASE } from "../config";

const PieChart = () => {
  const theme = useTheme();
  
  // ==== Controls ====
  const [chartType, setChartType] = useState("pie"); // "pie" | "line" | "bar"
  const [metric, setMetric] = useState("views");
  const [period, setPeriod] = useState("last28");
  const [interval, setInterval] = useState("daily"); // "daily" | "weekly" | "monthly" | "yearly"
  const [channel, setChannel] = useState(
    CHANNEL_OPTIONS.length ? CHANNEL_OPTIONS[0].value : ""
  );

  // Custom range
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ==== Data states ====
  const mconf = METRICS[metric];
  const [tsData, setTsData] = useState([]); // dữ liệu theo SOURCE cho Pie + cho TABLE
  const [tsSeries, setTsSeries] = useState([]); // timeseries raw cho Line/Bar: [{bucket, source, ...}]

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ====== PIE (local file / fallback API) ======
  const fetchRange = useCallback(
    async (start, end) => {
      setLoading(true);
      setErrorMsg("");
      try {
        const resp = await fetch(`${API_BASE}/api/traffic_source/range`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start, end, channelRoot: channel }),
        });
        if (!resp.ok) {
          const t = await resp.text();
          throw new Error(t || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        
        if (Array.isArray(data)) setTsData(data);
        else if (Array.isArray(data.items)) setTsData(data.items);
        else {
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
          `Không đọc file local cho channel="${channel}", period="${periodValue}". Fallback API.`,
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

  // ====== LINE/BAR (Postgres timeseries) ======
  const fetchTimeseries = useCallback(
    async (start, end, intervalValue) => {
      setLoading(true);
      setErrorMsg("");
      try {
        const resp = await fetch(`${API_BASE}/api/traffic_source/timeseries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start,
            end,
            channelRoot: channel,
            interval: intervalValue,
          }),
        });
        if (!resp.ok) {
          const t = await resp.text();
          throw new Error(t || `HTTP ${resp.status}`);
        }
        const data = await resp.json(); // [{bucket, source, views, ...}]
        console.log("timeseries resp:", data);
        setTsSeries(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setTsSeries([]);
        setErrorMsg(e?.message || "Lỗi tải timeseries.");
      } finally {
        setLoading(false);
      }
    },
    [channel]
  );

  // ====== Auto load khi đổi chart/period/channel/interval ======
  useEffect(() => {
    if (chartType === "pie") {
      // Pie: dùng logic cũ
      if (period === "custom") {
        setTsData([]);
        return;
      }
      loadPeriodFromFile(period);
      return;
    }

    // Line/Bar: gọi Postgres timeseries
    // Lấy range từ preset hoặc custom
    const { start, end } =
      period === "custom"
        ? { start: startDate, end: endDate }
        : getRangeForPeriod(period, new Date());

    if (period === "custom") {
      // Chưa chọn đủ ngày -> chờ user nhấn Apply
      if (!start || !end) return;
    }

    if (!start || !end) {
      setErrorMsg("Hãy chọn thời gian hợp lệ.");
      return;
    }
    fetchTimeseries(start, end, interval);
  }, [
    chartType,
    period,
    channel,
    interval,
    startDate,
    endDate,
    loadPeriodFromFile,
    fetchTimeseries,
  ]);

  // ====== PIE data ======
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

  // ====== Tooltip cho Pie ======
  const PieTooltip = ({ datum }) => {
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
          border: `1px solid ${
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.12)"
              : "rgba(0,0,0,0.08)"
          }`,
        }}
      >
        <div style={{ marginBottom: 4 }}>{datum.label}</div>
        <div>
          {METRICS[metric].label}: {fmt}
        </div>
        <div>%: {pct}%</div>
      </Box>
    );
  };

  // ====== Center label cho Pie ======
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

  // ====== TABLE data (dùng chung cho cả 3 chart) ======
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

    const sortedRows = rawRows
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
      rows: sortedRows,
    };
  }, [tsData, metric]);

  // ====== Từ tsSeries -> dữ liệu cho Line/Bar + cập nhật tsData để TABLE dùng ======

  // Line series: [{ id: source, data: [{x: 'YYYY-MM-DD', y: number}, ...] }]
  const lineSeries = useMemo(() => {
    if (chartType !== "line") return [];
    const bySource = new Map();
    for (const it of tsSeries) {
      const key = it.source || "Unknown";
      const yVal = METRICS[metric].valueOf(it);
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key).push({ x: String(it.bucket), y: n(yVal) });
    }
    for (const arr of bySource.values()) {
      arr.sort((a, b) => new Date(a.x) - new Date(b.x));
    }
    return Array.from(bySource.entries()).map(([id, data]) => ({ id, data }));
  }, [chartType, tsSeries, metric]);

  // Bar: data & keys
  const barPrep = useMemo(() => {
    if (chartType !== "bar") return { data: [], keys: [] };
    const buckets = new Map(); // bucket -> Map(source -> value)
    const sources = new Set();

    for (const it of tsSeries) {
      const b = String(it.bucket);
      const s = it.source || "Unknown";
      const yVal = n(METRICS[metric].valueOf(it));
      sources.add(s);
      if (!buckets.has(b)) buckets.set(b, new Map());
      buckets.get(b).set(s, (buckets.get(b).get(s) || 0) + yVal);
    }

    const sortedBuckets = Array.from(buckets.keys()).sort(
      (a, b) => new Date(a) - new Date(b)
    );
    const keys = Array.from(sources.values()).sort();
    const data = sortedBuckets.map((b) => {
      const row = { bucket: b };
      for (const k of keys) row[k] = buckets.get(b).get(k) || 0;
      return row;
    });
    return { data, keys };
  }, [chartType, tsSeries, metric]);

  // Khi ở Line/Bar: gộp tsSeries theo source -> setTsData để TABLE dùng chung
  useEffect(() => {
    if (chartType === "pie") return; // Pie đã có tsData riêng
    const perSource = new Map();
    for (const it of tsSeries) {
      const s = it.source || "Unknown";
      const cur = perSource.get(s) || {
        id: s,
        label: s,
        views: 0,
        estimatedMinutesWatched: 0,
        averageViewDuration_num: 0, // sum(avg * views)
        averageViewPercentage_num: 0,
        engagedViews: 0,
        views_for_avg: 0,
      };
      const v = n(it.views);
      cur.views += v;
      cur.estimatedMinutesWatched += n(it.estimatedMinutesWatched);
      cur.engagedViews += n(it.engagedViews);
      cur.averageViewDuration_num += n(it.averageViewDuration) * v;
      cur.averageViewPercentage_num += n(it.averageViewPercentage) * v;
      cur.views_for_avg += v;
      perSource.set(s, cur);
    }

    const rowsTot = [];
    for (const r of perSource.values()) {
      rowsTot.push({
        id: r.id,
        label: r.label,
        views: r.views,
        estimatedMinutesWatched: r.estimatedMinutesWatched,
        averageViewDuration:
          r.views_for_avg > 0 ? r.averageViewDuration_num / r.views_for_avg : 0,
        averageViewPercentage:
          r.views_for_avg > 0
            ? r.averageViewPercentage_num / r.views_for_avg
            : 0,
        engagedViews: r.engagedViews,
      });
    }
    setTsData(rowsTot);
  }, [chartType, tsSeries]);

  // ====== UI ======
  return (
    <Stack spacing={1.5}>
      {/* Controls */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={2}
        sx={{ px: 1, flexWrap: "wrap", rowGap: 1.25 }}
      >
        {/* Chart type */}
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="chart-type-label">Chart</InputLabel>
          <Select
            labelId="chart-type-label"
            value={chartType}
            label="Chart"
            onChange={(e) => setChartType(e.target.value)}
          >
            <MenuItem value="pie">Pie</MenuItem>
            <MenuItem value="line">Line</MenuItem>
            <MenuItem value="bar">Bar</MenuItem>
          </Select>
        </FormControl>

        {/* Interval cho Line/Bar */}
        {chartType !== "pie" && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="interval-select-label">Interval</InputLabel>
            <Select
              labelId="interval-select-label"
              value={interval}
              label="Interval"
              onChange={(e) => setInterval(e.target.value)}
            >
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="yearly">Yearly</MenuItem>
            </Select>
          </FormControl>
        )}

        {/* Metric */}
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="metric-select-label">Metric</InputLabel>
          <Select
            labelId="metric-select-label"
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

        {/* Period */}
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="period-select-label">Period</InputLabel>
          <Select
            labelId="period-select-label"
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

        {/* Custom range (khi Period = custom) */}
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
                // Pie: dùng API /range; Line/Bar: dùng /timeseries
                if (chartType === "pie") {
                  fetchRange(startDate, endDate);
                } else {
                  fetchTimeseries(startDate, endDate, interval);
                }
              }}
              disabled={loading}
            >
              {loading ? "Loading..." : "Apply"}
            </Button>
          </Stack>
        )}

        {/* Channel */}
        <FormControl size="small" sx={{ minWidth: 260, ml: "auto" }}>
          <InputLabel id="channel-select-label">Channel</InputLabel>
          <Select
            labelId="channel-select-label"
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

        {errorMsg && (
          <Typography variant="body2" color="error">
            {errorMsg}
          </Typography>
        )}
      </Stack>

      {/* CHART AREA */}
      <Box sx={{ height: 420 }}>
        {chartType === "pie" && (
          <ResponsivePie
            data={pieData}
            colors={{ scheme: "set3" }}
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
            tooltip={PieTooltip}
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
        )}

        {chartType === "line" && (
          <ResponsiveLine
            data={lineSeries}
            margin={{ top: 30, right: 24, bottom: 60, left: 60 }}
            xScale={{ type: "point" }} // nếu muốn time: chuyển sang type:'time'
            yScale={{ type: "linear", stacked: false }}
            axisBottom={{ tickRotation: -30 }}
            pointSize={6}
            useMesh
            legends={[
              {
                anchor: "bottom",
                direction: "row",
                translateY: 48,
                itemWidth: 120,
                itemHeight: 14,
                symbolSize: 10,
                symbolShape: "circle",
              },
            ]}
            tooltip={({ point }) => (
              <Box
                sx={{
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  boxShadow: 3,
                  bgcolor:
                    theme.palette.mode === "dark"
                      ? "rgba(0,0,0,0.75)"
                      : "rgba(255,255,255,0.95)",
                }}
              >
                <div>
                  <b>{point.serieId}</b>
                </div>
                <div>
                  {String(point.data.xFormatted)} —{" "}
                  {metric === "averageViewPercentage"
                    ? `${n(point.data.yFormatted).toFixed(2)}%`
                    : metric === "averageViewDuration"
                    ? formatSeconds(point.data.yFormatted)
                    : formatNumber(point.data.yFormatted)}
                </div>
              </Box>
            )}
          />
        )}

        {chartType === "bar" && (
          <ResponsiveBar
            data={barPrep.data}
            keys={barPrep.keys}
            indexBy="bucket"
            margin={{ top: 30, right: 24, bottom: 60, left: 60 }}
            padding={0.2}
            valueScale={{ type: "linear" }}
            indexScale={{ type: "band", round: true }}
            axisBottom={{ tickRotation: -30 }}
            labelSkipWidth={12}
            labelSkipHeight={12}
            legends={[
              {
                anchor: "bottom",
                direction: "row",
                translateY: 48,
                itemWidth: 120,
                itemHeight: 14,
                symbolSize: 10,
                symbolShape: "circle",
              },
            ]}
            tooltip={({ id, value, indexValue }) => (
              <Box
                sx={{
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  boxShadow: 3,
                  bgcolor:
                    theme.palette.mode === "dark"
                      ? "rgba(0,0,0,0.75)"
                      : "rgba(255,255,255,0.95)",
                }}
              >
                <div>
                  <b>{String(id)}</b>
                </div>
                <div>{String(indexValue)}</div>
                <div>
                  {metric === "averageViewPercentage"
                    ? `${n(value).toFixed(2)}%`
                    : metric === "averageViewDuration"
                    ? formatSeconds(value)
                    : formatNumber(value)}
                </div>
              </Box>
            )}
          />
        )}
      </Box>

      {/* TABLE */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          mt: 1,
          border: `1px solid ${
            theme.palette.mode === "dark"
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
