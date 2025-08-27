import { Box } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { tokens } from "../../theme";
import { DailyData } from "../../data/Daily"; // import dữ liệu bạn vừa export
import Header from "../../components/Header";
import { useTheme } from "@mui/material";

const Daily = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const columns = [
    { field: "day", headerName: "Day", flex: 1 },
    { field: "views", headerName: "Views", type: "number", flex: 1 },
    {
      field: "estimatedMinutesWatched",
      headerName: "Minutes Watched",
      type: "number",
      flex: 1,
    },
    {
      field: "averageViewDuration",
      headerName: "Avg. Duration",
      type: "number",
      flex: 1,
    },
    {
      field: "averageViewPercentage",
      headerName: "Avg. View %",
      type: "number",
      flex: 1,
    },
    { field: "engagedViews", headerName: "Engaged", type: "number", flex: 1 },
    {
      field: "subscribersGained",
      headerName: "Subs Gained",
      type: "number",
      flex: 1,
    },
    {
      field: "subscribersLost",
      headerName: "Subs Lost",
      type: "number",
      flex: 1,
    },
    {
      field: "likes",
      headerName: "Likes",
      flex: 1,
      align: "right",       
      headerAlign: "right",
      renderCell: (params) => (
        <span style={{ color: params.value < 0 ? "red" : "limegreen" }}>
          {params.value}
        </span>
    ),
    },
    
    { field: "shares", headerName: "Shares", type: "number", flex: 1 },
    { field: "comments", headerName: "Comments", type: "number", flex: 1 },
  ];

  const rows = DailyData.map((row, index) => ({ id: index + 1, ...row }));

  return (
    <Box m="20px">
      <Header title="DAILY ANALYTICS" subtitle="YouTube Daily Data" />
      <Box
        m="40px 0 0 0"
        height="75vh"
        sx={{
          "& .MuiDataGrid-root": {
            border: "none",
            color: colors.grey[100],   //màu chữ toàn bộ bảng
          },
          "& .MuiDataGrid-cell": {
            borderBottom: "none",
          },
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: colors.blueAccent[700],
            borderBottom: "none",
            color: colors.greenAccent[400],   //màu chữ header
            fontWeight: "bold",
            fontSize: "16px",  
          },
          "& .MuiDataGrid-virtualScroller": {
            backgroundColor: colors.primary[400],
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: "none",
            backgroundColor: colors.blueAccent[700],
          },
        }}
      >

        <DataGrid rows={rows} columns={columns} />
      </Box>
    </Box>
  );
};

export default Daily;
