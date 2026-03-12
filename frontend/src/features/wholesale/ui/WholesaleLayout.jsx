import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Link as RouterLink, useLocation } from "react-router-dom";

import { brandConfig } from "../../../shared/config/brandConfig";

const NAV_ITEMS = [
  { label: "Обзор", to: "/wholesale" },
  { label: "Заказы", to: "/wholesale/orders" },
  { label: "Профиль", to: "/wholesale/profile" },
];

export default function WholesaleLayout({ title, subtitle, children, action = null, ...rest }) {
  const location = useLocation();

  return (
    <Stack spacing={2} {...rest}>
      <Paper
        sx={{
          p: { xs: 1.7, md: 2.5 },
          borderRadius: 2,
          color: "#fff",
          border: "1px solid rgba(148, 163, 184, 0.18)",
          background: `
            radial-gradient(circle at top right, ${alpha(brandConfig.accent, 0.32)} 0%, transparent 28%),
            linear-gradient(135deg, ${brandConfig.accent} 0%, #102247 42%, #060d1c 100%)
          `,
          boxShadow: "0 28px 60px rgba(2, 6, 23, 0.34)",
          overflow: "hidden",
          position: "relative",
          "&::after": {
            content: '""',
            position: "absolute",
            inset: "auto -8% -45% auto",
            width: 240,
            height: 240,
            borderRadius: "50%",
            background: alpha("#fff", 0.08),
            filter: "blur(10px)",
            pointerEvents: "none",
          },
        }}
      >
        <Stack spacing={1.2}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              label={`${brandConfig.name} Партнёрский кабинет`}
              size="small"
              sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "#fff" }}
            />
            <Chip
              label={`Линия партнёров: ${brandConfig.supportTelegram}`}
              size="small"
              sx={{ bgcolor: "rgba(255,255,255,0.12)", color: "#fff" }}
            />
          </Stack>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Stack spacing={0.45}>
              <Typography variant="h2">{title}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.92, maxWidth: 760 }}>
                {subtitle}
              </Typography>
            </Stack>
            {action}
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {NAV_ITEMS.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Button
                  key={item.to}
                  component={RouterLink}
                  to={item.to}
                  size="small"
                  variant={active ? "contained" : "outlined"}
                  color="inherit"
                  endIcon={active ? <ArrowForwardRoundedIcon /> : null}
                  sx={{
                    borderColor: "rgba(255,255,255,0.22)",
                    color: "#fff",
                    bgcolor: active ? "rgba(255,255,255,0.16)" : "transparent",
                    "&:hover": {
                      borderColor: "rgba(255,255,255,0.4)",
                      bgcolor: "rgba(255,255,255,0.1)",
                    },
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>
        </Stack>
      </Paper>
      {children}
    </Stack>
  );
}
