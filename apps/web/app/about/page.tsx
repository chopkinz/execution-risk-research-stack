"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export default function AboutPage() {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" fontWeight={600} gutterBottom>
          About
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Research and risk-aware trading infrastructure. How we build and what we stand for.
        </Typography>
      </Box>

      <Card variant="outlined">
        <CardHeader title="Profile" subheader="What we build" />
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="body2">
              Meridian Terminal is built for serious research: clear risk limits, execution-aware simulation, and
              reproducible results you can inspect anywhere.
            </Typography>
            <Typography variant="body2">
              The engine runs strategies and risk checks; the app gives you clear views of markets and results.
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              <Chip label="Execution-aware" color="primary" size="small" variant="outlined" />
              <Chip label="Deterministic pipelines" size="small" variant="outlined" />
              <Chip label="Risk controls" size="small" variant="outlined" />
              <Chip label="Reproducibility" size="small" variant="outlined" />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardHeader title="Links" subheader="Profile and documents" />
        <CardContent>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Button
              href="https://github.com/chopkinz"
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              size="medium"
              sx={{ minHeight: 44, flex: { xs: "1 1 100%", sm: "0 0 auto" } }}
            >
              GitHub
            </Button>
            <Button
              href="https://www.linkedin.com/in/chase-hopkins4"
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              size="medium"
              sx={{ minHeight: 44, flex: { xs: "1 1 100%", sm: "0 0 auto" } }}
            >
              LinkedIn
            </Button>
            <Button href="/resume.pdf" variant="contained" size="medium" sx={{ minHeight: 44, flex: { xs: "1 1 100%", sm: "0 0 auto" } }}>
              Resume
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
