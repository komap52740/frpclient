import { Alert, Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useMemo, useState } from "react";

import { Link as RouterLink } from "react-router-dom";

import { wholesalePortalApi } from "../../../api/client";
import { APPOINTMENT_STATUS_OPTIONS, getStatusLabel } from "../../../constants/labels";
import { useAuth } from "../../auth/hooks/useAuth";
import { buildWholesaleReadiness } from "../lib/readiness";
import WholesaleLayout from "../ui/WholesaleLayout";
import WholesaleReadinessPanel from "../ui/WholesaleReadinessPanel";

function formatMoney(amount, currency = "RUB") {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return "Р¦РµРЅР° СѓС‚РѕС‡РЅСЏРµС‚СЃСЏ";
  }
  return `${numericAmount.toLocaleString("ru-RU")} ${currency || "RUB"}`;
}

function formatDateTime(value) {
  if (!value) return "вЂ”";
  const parsed = dayjs(value);
  if (!parsed.isValid()) return "вЂ”";
  return parsed.format("DD.MM.YYYY HH:mm");
}

export default function WholesaleOrdersPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState("");
  const [focusFilter, setFocusFilter] = useState("all");
  const {
    data = [],
    isPending,
    error,
  } = useQuery({
    queryKey: ["wholesale", "orders", statusFilter],
    queryFn: async () => {
      const response = await wholesalePortalApi.orders(
        statusFilter ? { status: statusFilter } : {}
      );
      return response.data || [];
    },
  });
  const readiness = buildWholesaleReadiness(user || {});

  const problematicCount = useMemo(() => data.filter((item) => item.sla_breached).length, [data]);
  const unreadOrdersCount = useMemo(
    () => data.filter((item) => Number(item.unread_count) > 0).length,
    [data]
  );
  const visibleOrders = useMemo(() => {
    if (focusFilter === "attention") {
      return data.filter((item) => item.sla_breached || Number(item.unread_count) > 0);
    }
    if (focusFilter === "unread") {
      return data.filter((item) => Number(item.unread_count) > 0);
    }
    if (focusFilter === "sla") {
      return data.filter((item) => item.sla_breached);
    }
    return data;
  }, [data, focusFilter]);

  return (
    <WholesaleLayout
      data-testid="wholesale-orders-page"
      title="РћРїРµСЂР°С†РёРѕРЅРЅР°СЏ РѕС‡РµСЂРµРґСЊ"
      subtitle="Р’СЃРµ B2B-РєРµР№СЃС‹ РІ РѕРґРЅРѕРј РїРѕС‚РѕРєРµ: СЃС‚Р°С‚СѓСЃ, SLA, РјР°СЃС‚РµСЂ, РЅРѕРІС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ Рё Р±С‹СЃС‚СЂС‹Р№ РїРµСЂРµС…РѕРґ РІ РєР°СЂС‚РѕС‡РєСѓ РїР°СЂС‚РЅС‘СЂСЃРєРѕРіРѕ РєРµР№СЃР°."
    >
      {!readiness.isOperational ? (
        <WholesaleReadinessPanel
          wholesale={user || {}}
          title="РЎРѕСЃС‚РѕСЏРЅРёРµ B2B-РєРѕРЅС‚СѓСЂР°"
        />
      ) : null}

      <Paper sx={{ p: 1.5, borderRadius: 2 }}>
        <Stack spacing={1.1}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between">
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                variant={focusFilter === "all" ? "filled" : "outlined"}
                color={focusFilter === "all" ? "primary" : "default"}
                label="Р’СЃСЏ РѕС‡РµСЂРµРґСЊ"
                onClick={() => setFocusFilter("all")}
              />
              <Chip
                size="small"
                variant={focusFilter === "attention" ? "filled" : "outlined"}
                color={focusFilter === "attention" ? "warning" : "default"}
                label="РўСЂРµР±СѓСЋС‚ РІРЅРёРјР°РЅРёСЏ"
                onClick={() => setFocusFilter("attention")}
              />
              <Chip
                size="small"
                variant={focusFilter === "unread" ? "filled" : "outlined"}
                color={focusFilter === "unread" ? "primary" : "default"}
                label="РЎ СЃРѕРѕР±С‰РµРЅРёСЏРјРё"
                onClick={() => setFocusFilter("unread")}
              />
              <Chip
                size="small"
                variant={focusFilter === "sla" ? "filled" : "outlined"}
                color={focusFilter === "sla" ? "error" : "default"}
                label="SLA-СЂРёСЃРє"
                onClick={() => setFocusFilter("sla")}
              />
            </Stack>
            <TextField
              select
              size="small"
              label="РЎС‚Р°С‚СѓСЃ"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              sx={{ minWidth: { xs: "100%", md: 220 } }}
            >
              <MenuItem value="">Р’СЃРµ СЃС‚Р°С‚СѓСЃС‹</MenuItem>
              {APPOINTMENT_STATUS_OPTIONS.map((status) => (
                <MenuItem key={status} value={status}>
                  {getStatusLabel(status)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" variant="outlined" label={`Р’СЃРµРіРѕ B2B: ${data.length}`} />
            <Chip
              size="small"
              variant="outlined"
              label={`РџРѕРєР°Р·Р°РЅРѕ: ${visibleOrders.length}`}
            />
            <Chip
              size="small"
              color={problematicCount ? "warning" : "default"}
              variant="outlined"
              label={`РќР°СЂСѓС€РµРЅ SLA: ${problematicCount}`}
            />
            <Chip
              size="small"
              color={unreadOrdersCount ? "primary" : "default"}
              variant="outlined"
              label={`РЎ РЅРѕРІС‹РјРё СЃРѕРѕР±С‰РµРЅРёСЏРјРё: ${unreadOrdersCount}`}
            />
          </Stack>
        </Stack>
      </Paper>

      {error ? (
        <Alert severity="error">РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ B2B-Р·Р°РєР°Р·С‹.</Alert>
      ) : null}
      {isPending ? (
        <Alert severity="info">Р—Р°РіСЂСѓР·РєР° РѕС‡РµСЂРµРґРё Р·Р°РєР°Р·РѕРІ...</Alert>
      ) : null}

      <Stack spacing={1.2}>
        {visibleOrders.map((item) => (
          <Paper
            key={item.id}
            sx={{ p: 1.7, borderRadius: 2 }}
            data-testid={`wholesale-order-card-${item.id}`}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              justifyContent="space-between"
            >
              <Stack spacing={0.45}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    #{item.id} вЂў {item.brand} {item.model}
                  </Typography>
                  <Chip size="small" variant="outlined" label={getStatusLabel(item.status)} />
                  {item.sla_breached ? (
                    <Chip
                      size="small"
                      color="warning"
                      variant="outlined"
                      label="РќР°СЂСѓС€РµРЅ SLA"
                    />
                  ) : null}
                  {item.is_wholesale_request ? (
                    <Chip size="small" color="primary" variant="outlined" label="B2B" />
                  ) : null}
                  {item.unread_count ? (
                    <Chip
                      size="small"
                      color="primary"
                      label={`РќРѕРІС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ: ${item.unread_count}`}
                    />
                  ) : null}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  РњР°СЃС‚РµСЂ: {item.master_username || "РџРѕРєР° РЅРµ РЅР°Р·РЅР°С‡РµРЅ"}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={formatMoney(item.total_price, item.currency)}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`РЎРѕР·РґР°РЅ: ${formatDateTime(item.created_at)}`}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`РћР±РЅРѕРІР»С‘РЅ: ${formatDateTime(item.updated_at)}`}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  РџРѕСЃР»РµРґРЅРµРµ СЃРѕРѕР±С‰РµРЅРёРµ:{" "}
                  {item.latest_message_text || "Р”РёР°Р»РѕРі РїРѕРєР° РїСѓСЃС‚"}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button component={RouterLink} to={`/appointments/${item.id}`} variant="contained">
                  РћС‚РєСЂС‹С‚СЊ РєР°СЂС‚РѕС‡РєСѓ
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ))}
        {!isPending && !visibleOrders.length ? (
          <Paper sx={{ p: 2, borderRadius: 2 }}>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                {focusFilter === "attention"
                  ? "РЎРµР№С‡Р°СЃ РІ РѕС‡РµСЂРµРґРё РЅРµС‚ Р·Р°РєР°Р·РѕРІ, РєРѕС‚РѕСЂС‹Рµ С‚СЂРµР±СѓСЋС‚ СЃСЂРѕС‡РЅРѕР№ СЂРµР°РєС†РёРё. SLA Рё РґРёР°Р»РѕРіРё РїРѕРґ РєРѕРЅС‚СЂРѕР»РµРј."
                  : focusFilter === "unread"
                    ? "РќРµРїСЂРѕС‡РёС‚Р°РЅРЅС‹С… B2B-РґРёР°Р»РѕРіРѕРІ СЃРµР№С‡Р°СЃ РЅРµС‚."
                    : focusFilter === "sla"
                      ? "Р—Р°РєР°Р·РѕРІ СЃ РЅР°СЂСѓС€РµРЅРЅС‹Рј SLA СЃРµР№С‡Р°СЃ РЅРµС‚."
                      : readiness.isOperational
                        ? "РџРѕ С‚РµРєСѓС‰РµРјСѓ С„РёР»СЊС‚СЂСѓ B2B-РєРµР№СЃРѕРІ РЅРµС‚. РљР°Рє С‚РѕР»СЊРєРѕ Р·Р°СЏРІРєР° РІРѕР№РґС‘С‚ РІ РїР°СЂС‚РЅС‘СЂСЃРєРёР№ РјР°СЂС€СЂСѓС‚, РѕРЅР° РїРѕСЏРІРёС‚СЃСЏ Р·РґРµСЃСЊ."
                        : readiness.queueHint}
              </Typography>
              {focusFilter !== "all" ? (
                <Button size="small" variant="outlined" onClick={() => setFocusFilter("all")}>
                  РџРѕРєР°Р·Р°С‚СЊ РІСЃСЋ РѕС‡РµСЂРµРґСЊ
                </Button>
              ) : null}
            </Stack>
          </Paper>
        ) : null}
      </Stack>
    </WholesaleLayout>
  );
}
