src/components/pie/
├─ helpers.js              // n, pad2, toYMD, formatNumber, formatSeconds, getRangeForPeriod
├─ metrics.js              // METRICS, METRIC_OPTIONS
├─ dataLoader.js           // require.context, computeChannelsOneLevel, loadTrafficSourceByChannelAndKey, CHANNEL_OPTIONS, PERIOD_TO_KEY
├─ useTrafficSource.js     // hook fetchRange + loadPeriodFromFile + state (tsData, loading, errorMsg)
├─ PieChart.jsx            // component chính: layout + bộ chọn + gọi sub-components
├─ PieSection.jsx          // chỉ phần <ResponsivePie /> + Tooltip + CenterLabel props-in
├─ TableSection.jsx        // chỉ phần bảng + tính totals/rows (memo)
