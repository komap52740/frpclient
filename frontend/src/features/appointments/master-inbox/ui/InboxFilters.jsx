import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Chip, InputAdornment, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";

const RISK_OPTIONS = [
  { value: "all", label: "Любой риск" },
  { value: "critical", label: "Критический" },
  { value: "high", label: "Высокий" },
  { value: "medium", label: "Средний" },
  { value: "low", label: "Низкий" },
];

const SORT_OPTIONS = [
  { value: "priority", label: "Приоритет" },
  { value: "updated", label: "Последнее обновление" },
  { value: "risk", label: "Риск клиента" },
];

export default function InboxFilters({
  searchQuery,
  setSearchQuery,
  riskLevel,
  setRiskLevel,
  sortBy,
  setSortBy,
  urgentOnly,
  setUrgentOnly,
  wholesaleOnly,
  setWholesaleOnly,
  unreadOnly,
  setUnreadOnly,
}) {
  return (
    <Paper sx={{ p: 1.4, borderRadius: 2 }}>
      <Stack spacing={1}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1}>
          <TextField
            fullWidth
            size="small"
            label="Поиск"
            placeholder="Модель, клиент, сообщение"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            size="small"
            label="Риск"
            value={riskLevel}
            onChange={(event) => setRiskLevel(event.target.value)}
            sx={{ minWidth: { xs: "100%", sm: 190 } }}
          >
            {RISK_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Сортировка"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            sx={{ minWidth: { xs: "100%", sm: 220 } }}
          >
            {SORT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Быстрые фильтры:
          </Typography>
          <Chip
            clickable
            label="Срочные"
            color={urgentOnly ? "warning" : "default"}
            variant={urgentOnly ? "filled" : "outlined"}
            onClick={() => setUrgentOnly((prev) => !prev)}
          />
          <Chip
            clickable
            label="B2B"
            color={wholesaleOnly ? "primary" : "default"}
            variant={wholesaleOnly ? "filled" : "outlined"}
            onClick={() => setWholesaleOnly((prev) => !prev)}
          />
          <Chip
            clickable
            label="Непрочитанные"
            color={unreadOnly ? "secondary" : "default"}
            variant={unreadOnly ? "filled" : "outlined"}
            onClick={() => setUnreadOnly((prev) => !prev)}
          />
        </Stack>
      </Stack>
    </Paper>
  );
}
