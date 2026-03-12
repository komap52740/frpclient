import {
  Chip,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Link as RouterLink, useLocation } from "react-router-dom";

export default function ShellDrawer({
  drawerOpen,
  menuItems,
  onClose,
  onLogout,
  roleLabel,
  user,
  wholesaleBadge,
  b2bPanel,
}) {
  const location = useLocation();

  return (
    <Drawer
      open={drawerOpen}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 300,
          borderRight: "1px solid",
          borderColor: "divider",
          backgroundColor: (themeValue) =>
            themeValue.palette.mode === "dark" ? "rgba(9, 15, 27, 0.95)" : "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px) saturate(150%)",
        },
      }}
    >
      <Stack sx={{ p: 2 }} spacing={0.7}>
        <Typography variant="h3">Навигация</Typography>
        <Typography variant="caption" color="text.secondary">
          {user?.username || "Пользователь"} · {roleLabel}
        </Typography>
        {wholesaleBadge ? (
          <Chip
            size="small"
            label={wholesaleBadge.label}
            color={wholesaleBadge.color}
            variant={wholesaleBadge.variant}
            sx={{ alignSelf: "flex-start" }}
          />
        ) : null}
        {b2bPanel ? (
          <Stack spacing={0.8} sx={{ pt: 0.3 }}>
            <Typography variant="caption" color="text.secondary">
              {b2bPanel.title}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {b2bPanel.description}
            </Typography>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
              {b2bPanel.links.map((item) => {
                const active =
                  item.to === "/wholesale"
                    ? location.pathname === "/wholesale" || location.pathname === "/wholesale/"
                    : location.pathname.startsWith(item.to);
                return (
                  <Chip
                    key={item.to}
                    size="small"
                    clickable
                    component={RouterLink}
                    to={item.to}
                    onClick={onClose}
                    label={item.label}
                    color={active ? "primary" : "default"}
                    variant={active ? "filled" : "outlined"}
                  />
                );
              })}
              <Chip
                size="small"
                clickable
                component="a"
                href={b2bPanel.supportUrl}
                target="_blank"
                rel="noreferrer"
                label={b2bPanel.supportTelegram}
                color="info"
                variant="outlined"
              />
            </Stack>
          </Stack>
        ) : null}
      </Stack>
      <Divider />
      <List sx={{ p: 1 }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.to}
            component={RouterLink}
            to={item.to}
            selected={location.pathname.startsWith(item.to)}
            onClick={onClose}
            sx={{
              borderRadius: 2,
              mb: 0.4,
              "&.Mui-selected": {
                bgcolor: (themeValue) => alpha(themeValue.palette.primary.main, 0.14),
                color: "primary.main",
              },
            }}
          >
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
        <ListItemButton onClick={onLogout} sx={{ borderRadius: 2 }}>
          <ListItemText primary="Выйти" />
        </ListItemButton>
      </List>
    </Drawer>
  );
}
