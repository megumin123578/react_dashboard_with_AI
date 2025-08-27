import { Box } from '@mui/material'
import Header from '../../components/Header'
import PieChart from '../../components/TrafficSource'

const Pie = () => {
  return (
    <Box m="20px">
      <Header title="Traffic Source" subtitle="Views By Traffic Source" />
      <Box height="75vh">
        <PieChart />
      </Box>
    </Box>
  );
};

export default Pie;