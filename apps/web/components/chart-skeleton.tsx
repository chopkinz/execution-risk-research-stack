"use client";

import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";

type ChartSkeletonProps = {
  height?: number;
};

export function ChartSkeleton({ height = 480 }: ChartSkeletonProps) {
  const chartHeight = Math.max(200, height - 64);
  return (
    <Box sx={{ width: "100%", height, p: 2.5, display: "flex", flexDirection: "column", alignItems: "stretch" }}>
      <Skeleton variant="text" width="40%" height={24} sx={{ mb: 2, borderRadius: 0 }} />
      <Skeleton
        variant="rectangular"
        width="100%"
        height={chartHeight}
        sx={{ flex: 1, borderRadius: 1, bgcolor: "action.hover" }}
      />
      <Box sx={{ display: "flex", gap: 1.5, mt: 2, justifyContent: "flex-end" }}>
        <Skeleton variant="rounded" width={64} height={32} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rounded" width={64} height={32} sx={{ borderRadius: 1 }} />
      </Box>
    </Box>
  );
}
