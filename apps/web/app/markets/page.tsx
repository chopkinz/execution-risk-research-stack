import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { MarketsDashboard } from "../../components/markets-dashboard";

export default function MarketsPage() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box>
        <Typography variant="h4" fontWeight={600} gutterBottom>
          Markets
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Charts and data for review and research.
        </Typography>
      </Box>
      <MarketsDashboard />
    </Box>
  );
}
