import { Alert, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { Memory, Refresh } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { apiFetch } from "../services/apiFetch";
import type { AdminMemoryMetrics } from "../types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

export function AdminMemoryPanel() {
  const [data, setData] = useState<AdminMemoryMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch("/api/admin/memory");
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Admin role required for memory metrics.");
        }
        throw new Error("Failed to load memory metrics.");
      }

      const payload = (await response.json()) as AdminMemoryMetrics;
      setData(payload);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load memory metrics.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Paper sx={{ p: 2, mb: 3, borderRadius: 4, border: "1px solid #d8e1e8" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Memory fontSize="small" />
          <Typography variant="h6">Admin Memory</Typography>
          {data && <Chip size="small" variant="outlined" label={`PID ${data.process.pid}`} />}
        </Stack>

        <Button
          variant="text"
          startIcon={<Refresh />}
          disabled={loading}
          onClick={() => {
            void load();
          }}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!error && !data && loading && (
        <Typography variant="body2" color="text.secondary">Loading memory metrics...</Typography>
      )}

      {data && (
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap flexWrap="wrap">
            <Chip label={`RSS ${formatBytes(data.process.rssBytes)}`} />
            <Chip label={`Heap used ${formatBytes(data.process.heapUsedBytes)}`} />
            <Chip label={`Heap total ${formatBytes(data.process.heapTotalBytes)}`} />
            <Chip label={`Cache ${data.cache.entries} entries`} />
            <Chip label={`Cache size ${formatBytes(data.cache.approximateBytes)}`} />
            <Chip label={`Uptime ${data.process.uptimeSeconds}s`} />
          </Stack>

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, bgcolor: "#f7fafc" }}>
            <Typography variant="subtitle2" gutterBottom>Cache</Typography>
            <Typography variant="body2">File: {data.cache.filePath}</Typography>
            <Typography variant="body2">Expired entries pending cleanup: {data.cache.expiredEntries}</Typography>
            <Typography variant="body2">Loaded from disk: {data.cache.loadedFromDiskAt ?? "not yet"}</Typography>
            <Typography variant="body2">Last save: {data.cache.lastSaveAt ?? "not yet"}</Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, bgcolor: "#f7fafc" }}>
            <Typography variant="subtitle2" gutterBottom>Auth Context</Typography>
            <Typography variant="body2">User: {data.user.email ?? data.user.sub}</Typography>
            <Typography variant="body2">Roles: {data.user.roles.join(", ") || "none"}</Typography>
            <Typography variant="body2">Generated: {new Date(data.generatedAt).toLocaleString()}</Typography>
          </Paper>
        </Stack>
      )}
    </Paper>
  );
}