import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import { AppBar, Button, Chip, IconButton, Stack, Toolbar, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";

import NotificationBell from "../../components/ui/NotificationBell";
import { accessibleFocusRingSx } from "../../shared/ui/focusStyles";
import { useThemeMode } from "../../theme/ThemeModeContext";

export default function ShellTopBar({
  route,
  quickAction,
  roleLabel,
  wholesaleBadge,
  onOpenDrawer,
  onLogout,
}) {
  const theme = useTheme();
  const { mode, toggleMode } = useThemeMode();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const controlSurfaceSx = useMemo(
    () => ({
      height: { xs: 36, md: 38 },
      borderRadius: 1.5,
      border: "1px solid",
      borderColor: (themeValue) => alpha(themeValue.palette.divider, 0.95),
      bgcolor: (themeValue) =>
        themeValue.palette.mode === "dark" ? alpha("#0b1322", 0.86) : alpha("#ffffff", 0.9),
      backdropFilter: "blur(6px)",
    }),
    []
  );
  const iconControlSx = useMemo(
    () => ({
      ...controlSurfaceSx,
      width: { xs: 36, md: 38 },
      minWidth: { xs: 36, md: 38 },
      p: 0,
      "& .MuiSvgIcon-root": { fontSize: 18 },
      ...accessibleFocusRingSx,
    }),
    [controlSurfaceSx]
  );
  const chipControlSx = useMemo(
    () => ({
      ...controlSurfaceSx,
      "& .MuiChip-label": {
        px: 1.2,
        fontSize: 13,
        fontWeight: 700,
      },
    }),
    [controlSurfaceSx]
  );

  return (
    <AppBar
      position="sticky"
      color="transparent"
      elevation={0}
      sx={{
        px: { xs: 0.4, md: 1 },
        pt: 0.4,
        backdropFilter: "blur(24px) saturate(160%)",
        backgroundColor: (themeValue) =>
          themeValue.palette.mode === "dark"
            ? "rgba(8, 14, 24, 0.72)"
            : "rgba(245, 249, 255, 0.72)",
      }}
    >
      <Toolbar
        sx={{
          minHeight: { xs: 62, md: 70 },
          px: { xs: 0.8, md: 1.1 },
          gap: 1,
          borderRadius: 2,
          border: "1px solid",
          borderColor: (themeValue) => alpha(themeValue.palette.divider, 0.95),
          bgcolor: (themeValue) =>
            themeValue.palette.mode === "dark"
              ? "rgba(5, 11, 22, 0.82)"
              : "rgba(249, 252, 255, 0.86)",
        }}
      >
        <IconButton
          color="inherit"
          onClick={onOpenDrawer}
          aria-label="Открыть навигацию"
          sx={iconControlSx}
        >
          <MenuRoundedIcon />
        </IconButton>

        <Stack sx={{ flexGrow: 1, minWidth: 0 }} spacing={0.2}>
          <Stack direction="row" spacing={0.8} alignItems="center">
            <Chip
              size="small"
              icon={<RocketLaunchRoundedIcon sx={{ fontSize: 14 }} />}
              label="FRP"
              sx={{
                height: 24,
                bgcolor: (themeValue) =>
                  themeValue.palette.mode === "dark"
                    ? alpha(themeValue.palette.primary.main, 0.18)
                    : alpha(themeValue.palette.primary.main, 0.12),
                color: "primary.main",
                border: "1px solid",
                borderColor: (themeValue) => alpha(themeValue.palette.primary.main, 0.35),
              }}
            />
            <Typography
              sx={{
                fontWeight: 800,
                color: (themeValue) =>
                  themeValue.palette.mode === "dark"
                    ? "rgba(236, 242, 252, 0.98)"
                    : "rgba(18, 33, 55, 0.96)",
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {route.title}
            </Typography>
          </Stack>
          <Typography
            variant="caption"
            color="inherit"
            sx={{
              display: { xs: "none", md: "block" },
              color: (themeValue) =>
                themeValue.palette.mode === "dark"
                  ? "rgba(181, 198, 222, 0.92)"
                  : "rgba(60, 79, 108, 0.9)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {route.subtitle}
          </Typography>
        </Stack>

        {quickAction && !isMobile ? (
          <Button
            component={RouterLink}
            to={quickAction.to}
            variant="outlined"
            size="small"
            sx={{
              height: { xs: 36, md: 38 },
              minWidth: 132,
              px: 1.9,
              borderRadius: 1.5,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              textTransform: "none",
              borderWidth: 1,
              borderColor: (themeValue) => alpha(themeValue.palette.primary.main, 0.42),
              color: (themeValue) =>
                themeValue.palette.mode === "dark"
                  ? alpha(themeValue.palette.primary.light, 0.96)
                  : alpha(themeValue.palette.primary.dark, 0.88),
              bgcolor: (themeValue) =>
                themeValue.palette.mode === "dark"
                  ? alpha(themeValue.palette.primary.main, 0.16)
                  : alpha(themeValue.palette.primary.main, 0.08),
              boxShadow: "none",
              "&:hover": {
                boxShadow: "none",
                borderColor: (themeValue) => alpha(themeValue.palette.primary.main, 0.6),
                bgcolor: (themeValue) =>
                  themeValue.palette.mode === "dark"
                    ? alpha(themeValue.palette.primary.main, 0.22)
                    : alpha(themeValue.palette.primary.main, 0.14),
              },
            }}
          >
            {quickAction.label}
          </Button>
        ) : null}

        <Stack direction="row" spacing={0.75} alignItems="center">
          <Chip
            size="small"
            label={roleLabel}
            sx={{
              ...chipControlSx,
              display: { xs: "none", sm: "inline-flex" },
            }}
          />
          {wholesaleBadge ? (
            <Chip
              size="small"
              label={wholesaleBadge.label}
              color={wholesaleBadge.color}
              variant={wholesaleBadge.variant}
              sx={{
                ...chipControlSx,
                display: { xs: "none", md: "inline-flex" },
                ...(wholesaleBadge.color === "primary"
                  ? {
                      bgcolor: (themeValue) =>
                        themeValue.palette.mode === "dark"
                          ? alpha(themeValue.palette.primary.main, 0.2)
                          : alpha(themeValue.palette.primary.main, 0.12),
                      color: (themeValue) =>
                        themeValue.palette.mode === "dark"
                          ? alpha(themeValue.palette.primary.light, 0.96)
                          : alpha(themeValue.palette.primary.dark, 0.95),
                      borderColor: (themeValue) => alpha(themeValue.palette.primary.main, 0.45),
                    }
                  : {}),
              }}
            />
          ) : null}

          <IconButton
            color="inherit"
            onClick={toggleMode}
            aria-label={mode === "dark" ? "Включить светлую тему" : "Включить темную тему"}
            sx={iconControlSx}
          >
            {mode === "dark" ? (
              <LightModeRoundedIcon fontSize="small" />
            ) : (
              <DarkModeRoundedIcon fontSize="small" />
            )}
          </IconButton>

          <NotificationBell buttonSx={iconControlSx} />

          <IconButton
            color="inherit"
            onClick={onLogout}
            aria-label="Выйти из аккаунта"
            sx={iconControlSx}
          >
            <LogoutRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
