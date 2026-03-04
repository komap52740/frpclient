import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { Alert, Box, Button, Chip, Divider, Paper, Stack, TextField, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { authApi } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

dayjs.locale("ru");

function resolveLevelLabel(level) {
  if (level === "pro") return "Pro";
  if (level === "advanced") return "РџСЂРѕРґРІРёРЅСѓС‚С‹Р№";
  if (level === "newbie") return "РќРѕРІРёС‡РѕРє";
  return "Р‘Р°Р·РѕРІС‹Р№";
}

function resolveWholesaleLabel(status) {
  if (status === "approved") return "РћРґРѕР±СЂРµРЅРѕ";
  if (status === "pending") return "РќР° СЂР°СЃСЃРјРѕС‚СЂРµРЅРёРё";
  if (status === "rejected") return "РћС‚РєР»РѕРЅРµРЅРѕ";
  return "РќРµ Р·Р°РїСЂРѕС€РµРЅРѕ";
}

function formatPercent(value) {
  if (value == null) return "0%";
  return `${Math.round(Number(value) * 100)}%`;
}

function ProfileKpi({ title, value, helper, icon }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.4, md: 1.6 },
        borderRadius: 1.6,
        border: "1px solid",
        borderColor: "divider",
        minWidth: 0,
      }}
    >
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={0.9} alignItems="center">
          {icon}
          <Typography variant="caption" color="text.secondary">
            {title}
          </Typography>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 820 }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {helper}
        </Typography>
      </Stack>
    </Paper>
  );
}

export default function ClientProfilePage() {
  const { user, reloadMe } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const stats = user?.client_stats || {};
  const [profileForm, setProfileForm] = useState({
    username: user?.username || "",
    profile_photo: null,
    remove_profile_photo: false,
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [serviceForm, setServiceForm] = useState({
    wholesale_company_name: user?.wholesale_company_name || "",
    wholesale_city: user?.wholesale_city || "",
    wholesale_address: user?.wholesale_address || "",
    wholesale_comment: user?.wholesale_comment || "",
    wholesale_service_details: user?.wholesale_service_details || "",
    wholesale_service_photo_1: null,
    wholesale_service_photo_2: null,
  });
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestSuccess, setRequestSuccess] = useState("");

  const avatarText = useMemo(() => {
    const username = (user?.username || "РљР»РёРµРЅС‚").trim();
    return username.slice(0, 2).toUpperCase();
  }, [user?.username]);
  const avatarUrl = user?.profile_photo_url || user?.telegram_photo_url || "";

  const levelLabel = resolveLevelLabel(stats.level);
  const wholesaleLabel = resolveWholesaleLabel(user?.wholesale_status);
  const isWholesaleApproved = user?.wholesale_status === "approved";
  const hasExistingServicePhoto = Boolean(user?.wholesale_service_photo_1_url || user?.wholesale_service_photo_2_url);

  const updateServiceField = (key, value) => {
    setServiceForm((prev) => ({ ...prev, [key]: value }));
    setRequestError("");
    setRequestSuccess("");
  };

  const updateProfileField = (key, value) => {
    setProfileForm((prev) => ({ ...prev, [key]: value }));
    setProfileError("");
    setProfileSuccess("");
  };

  const submitProfileUpdate = async () => {
    const nextUsername = (profileForm.username || "").trim();
    if (nextUsername.length < 3) {
      setProfileError("РќРёРє РґРѕР»Р¶РµРЅ СЃРѕРґРµСЂР¶Р°С‚СЊ РјРёРЅРёРјСѓРј 3 СЃРёРјРІРѕР»Р°.");
      return;
    }
    const hasNicknameChanged = nextUsername !== (user?.username || "");
    const hasPhotoChanged = Boolean(profileForm.profile_photo) || Boolean(profileForm.remove_profile_photo);
    if (!hasNicknameChanged && !hasPhotoChanged) {
      setProfileError("РќРµС‚ РёР·РјРµРЅРµРЅРёР№ РґР»СЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ.");
      return;
    }

    setProfileLoading(true);
    setProfileError("");
    setProfileSuccess("");
    try {
      const payload = new FormData();
      payload.append("username", nextUsername);
      if (profileForm.profile_photo) {
        payload.append("profile_photo", profileForm.profile_photo);
      } else if (profileForm.remove_profile_photo) {
        payload.append("remove_profile_photo", "true");
      }
      await authApi.updateProfile(payload);
      await reloadMe();
      setProfileSuccess("РџСЂРѕС„РёР»СЊ РѕР±РЅРѕРІР»РµРЅ.");
      setProfileForm((prev) => ({
        ...prev,
        username: nextUsername,
        profile_photo: null,
        remove_profile_photo: false,
      }));
    } catch (error) {
      const detail = error?.response?.data?.detail;
      const usernameError = error?.response?.data?.username?.[0];
      const photoError = error?.response?.data?.profile_photo?.[0];
      setProfileError(detail || usernameError || photoError || "РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ РїСЂРѕС„РёР»СЊ.");
    } finally {
      setProfileLoading(false);
    }
  };

  const submitWholesaleRequest = async () => {
    const company = (serviceForm.wholesale_company_name || "").trim();
    const city = (serviceForm.wholesale_city || "").trim();
    const address = (serviceForm.wholesale_address || "").trim();
    const details = (serviceForm.wholesale_service_details || "").trim();
    if (!company) {
      setRequestError("РЈРєР°Р¶РёС‚Рµ РЅР°Р·РІР°РЅРёРµ СЃРµСЂРІРёСЃРЅРѕРіРѕ С†РµРЅС‚СЂР°");
      return;
    }
    if (!city) {
      setRequestError("Укажите город сервисного центра");
      return;
    }
    if (!address) {
      setRequestError("Укажите адрес сервисного центра");
      return;
    }
    if (details.length < 20) {
      setRequestError("Р”РѕР±Р°РІСЊС‚Рµ РѕРїРёСЃР°РЅРёРµ СЃРµСЂРІРёСЃР° РјРёРЅРёРјСѓРј 20 СЃРёРјРІРѕР»РѕРІ");
      return;
    }
    if (!serviceForm.wholesale_service_photo_1 && !serviceForm.wholesale_service_photo_2 && !hasExistingServicePhoto) {
      setRequestError("Р”РѕР±Р°РІСЊС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРЅРѕ С„РѕС‚Рѕ СЃРµСЂРІРёСЃР°");
      return;
    }

    setRequestLoading(true);
    setRequestError("");
    setRequestSuccess("");
    try {
      const payload = new FormData();
      payload.append("is_service_center", "true");
      payload.append("wholesale_company_name", company);
      payload.append("wholesale_city", city);
      payload.append("wholesale_address", address);
      payload.append("wholesale_comment", (serviceForm.wholesale_comment || "").trim());
      payload.append("wholesale_service_details", details);
      if (serviceForm.wholesale_service_photo_1) payload.append("wholesale_service_photo_1", serviceForm.wholesale_service_photo_1);
      if (serviceForm.wholesale_service_photo_2) payload.append("wholesale_service_photo_2", serviceForm.wholesale_service_photo_2);
      await authApi.requestWholesale(payload);
      await reloadMe();
      setRequestSuccess("Р—Р°СЏРІРєР° РЅР° РѕРїС‚РѕРІС‹Р№ СЃС‚Р°С‚СѓСЃ РѕС‚РїСЂР°РІР»РµРЅР°. РћР¶РёРґР°Р№С‚Рµ РїСЂРѕРІРµСЂРєСѓ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°.");
      setServiceForm((prev) => ({ ...prev, wholesale_service_photo_1: null, wholesale_service_photo_2: null }));
    } catch (error) {
      const responseData = error?.response?.data;
      const detail = responseData?.detail;

      let fieldError = "";
      if (!detail && responseData && typeof responseData === "object") {
        const preferredFields = [
          "wholesale_company_name",
          "wholesale_city",
          "wholesale_address",
          "wholesale_service_details",
          "wholesale_comment",
          "wholesale_service_photo_1",
          "wholesale_service_photo_2",
          "is_service_center",
        ];

        for (const field of preferredFields) {
          const value = responseData[field];
          if (typeof value === "string" && value) {
            fieldError = value;
            break;
          }
          if (Array.isArray(value) && typeof value[0] === "string" && value[0]) {
            fieldError = value[0];
            break;
          }
        }

        if (!fieldError) {
          for (const value of Object.values(responseData)) {
            if (typeof value === "string" && value) {
              fieldError = value;
              break;
            }
            if (Array.isArray(value) && typeof value[0] === "string" && value[0]) {
              fieldError = value[0];
              break;
            }
          }
        }
      }

      setRequestError(detail || fieldError || "РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ Р·Р°СЏРІРєСѓ РЅР° РѕРїС‚РѕРІС‹Р№ СЃС‚Р°С‚СѓСЃ");
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        sx={{
          p: { xs: 1.7, md: 2.4 },
          borderRadius: 1.8,
          border: "1px solid",
          borderColor: "divider",
          background: isDark
            ? "linear-gradient(145deg, rgba(10,19,31,0.95) 0%, rgba(17,31,51,0.92) 100%)"
            : "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(240,249,255,0.92) 100%)",
        }}
      >
        <Stack spacing={1.4}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Box
              sx={{
                width: 54,
                height: 54,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                letterSpacing: "0.02em",
                color: "#fff",
                background: avatarUrl
                  ? `url(${avatarUrl}) center/cover no-repeat`
                  : "linear-gradient(135deg, #0e74ff 0%, #38a1ff 100%)",
                boxShadow: "0 10px 22px rgba(14,116,255,0.32)",
                overflow: "hidden",
              }}
            >
              {!avatarUrl ? avatarText : null}
            </Box>
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography variant="h2" sx={{ fontSize: { xs: "1.4rem", md: "1.6rem" } }}>
                {user?.username || "РљР»РёРµРЅС‚"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Р›РёС‡РЅС‹Р№ РєР°Р±РёРЅРµС‚ РєР»РёРµРЅС‚Р°
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={`РЈСЂРѕРІРµРЅСЊ: ${levelLabel}`}
              sx={{
                bgcolor: (themeValue) => alpha(themeValue.palette.primary.main, 0.12),
                color: "primary.main",
                fontWeight: 760,
              }}
            />
            <Chip
              size="small"
              icon={<StorefrontRoundedIcon />}
              label={`РћРїС‚: ${wholesaleLabel}`}
              variant={isWholesaleApproved ? "filled" : "outlined"}
              color={isWholesaleApproved ? "success" : "default"}
            />
            {user?.telegram_username ? (
              <Chip size="small" label={`Telegram: @${user.telegram_username}`} variant="outlined" />
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
        <ProfileKpi
          title="Р—Р°РІРµСЂС€РµРЅРѕ"
          value={stats.completed_orders_count || 0}
          helper="РЈСЃРїРµС€РЅРѕ Р·Р°РєСЂС‹С‚С‹Рµ Р·Р°СЏРІРєРё"
          icon={<CheckCircleRoundedIcon fontSize="small" color="success" />}
        />
        <ProfileKpi
          title="РЎСЂРµРґРЅСЏСЏ РѕС†РµРЅРєР°"
          value={Number(stats.average_rating || 0).toFixed(1)}
          helper="РџРѕ РѕС‚Р·С‹РІР°Рј РїРѕСЃР»Рµ Р·Р°РІРµСЂС€РµРЅРёСЏ"
          icon={<TrendingUpRoundedIcon fontSize="small" color="primary" />}
        />
        <ProfileKpi
          title="Р”РѕР»СЏ РѕС‚РјРµРЅ"
          value={formatPercent(stats.cancellation_rate)}
          helper="РќРёР¶Рµ вЂ” Р»СѓС‡С€Рµ РґР»СЏ РїСЂРёРѕСЂРёС‚РµС‚Р°"
          icon={<LockRoundedIcon fontSize="small" color="warning" />}
        />
      </Stack>

      <Paper sx={{ p: { xs: 1.6, md: 1.8 }, borderRadius: 1.8 }}>
        <Stack spacing={1.2}>
          <Stack direction="row" spacing={0.8} alignItems="center">
            <PersonRoundedIcon fontSize="small" color="primary" />
            <Typography variant="h3">РџСѓР±Р»РёС‡РЅС‹Р№ РїСЂРѕС„РёР»СЊ</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            РќРёРє Рё С„РѕС‚Рѕ РІРёРґСЏС‚ РјР°СЃС‚РµСЂ Рё Р°РґРјРёРЅ РІ РєР°СЂС‚РѕС‡РєРµ РєР»РёРµРЅС‚Р°.
          </Typography>
          {profileError ? <Alert severity="error">{profileError}</Alert> : null}
          {profileSuccess ? <Alert severity="success">{profileSuccess}</Alert> : null}
          <TextField
            label="РќРёРє"
            value={profileForm.username}
            onChange={(event) => updateProfileField("username", event.target.value)}
            inputProps={{ maxLength: 150 }}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon />}>
              {profileForm.profile_photo ? "Р—Р°РјРµРЅРёС‚СЊ С„РѕС‚Рѕ" : "Р—Р°РіСЂСѓР·РёС‚СЊ С„РѕС‚Рѕ"}
              <input
                hidden
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(event) => {
                  updateProfileField("profile_photo", event.target.files?.[0] || null);
                  if (event.target.files?.[0]) updateProfileField("remove_profile_photo", false);
                }}
              />
            </Button>
            {avatarUrl ? (
              <Button
                variant={profileForm.remove_profile_photo ? "contained" : "outlined"}
                color={profileForm.remove_profile_photo ? "warning" : "inherit"}
                onClick={() => updateProfileField("remove_profile_photo", !profileForm.remove_profile_photo)}
              >
                {profileForm.remove_profile_photo ? "Р¤РѕС‚Рѕ Р±СѓРґРµС‚ СѓРґР°Р»РµРЅРѕ" : "РЈРґР°Р»РёС‚СЊ С„РѕС‚Рѕ"}
              </Button>
            ) : null}
          </Stack>
          {profileForm.profile_photo ? (
            <Typography variant="caption" color="text.secondary">
              Р¤Р°Р№Р»: {profileForm.profile_photo.name}
            </Typography>
          ) : null}
          <Button variant="contained" onClick={submitProfileUpdate} disabled={profileLoading} sx={{ alignSelf: "flex-start" }}>
            {profileLoading ? "РЎРѕС…СЂР°РЅСЏРµРј..." : "РЎРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС„РёР»СЊ"}
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 1.6, md: 1.8 }, borderRadius: 1.8 }}>
        <Stack spacing={1.2}>
          <Typography variant="h3">РЎС‚Р°С‚СѓСЃ СЃРµСЂРІРёСЃР°</Typography>
          <Stack direction="row" spacing={0.9} flexWrap="wrap" useFlexGap alignItems="center">
            <Chip
              icon={<StorefrontRoundedIcon />}
              label={isWholesaleApproved ? "РћРїС‚РѕРІС‹Р№ СЃРµСЂРІРёСЃ" : "РћР±С‹С‡РЅС‹Р№ РєР»РёРµРЅС‚"}
              color={isWholesaleApproved ? "success" : "default"}
              variant={isWholesaleApproved ? "filled" : "outlined"}
            />
            <Chip label={`РЎС‚Р°С‚СѓСЃ: ${wholesaleLabel}`} variant="outlined" />
          </Stack>
          {!isWholesaleApproved ? (
            <Stack spacing={1.15}>
              {requestError ? <Alert severity="error">{requestError}</Alert> : null}
              {requestSuccess ? <Alert severity="success">{requestSuccess}</Alert> : null}
              <TextField
                label="РќР°Р·РІР°РЅРёРµ СЃРµСЂРІРёСЃР°"
                value={serviceForm.wholesale_company_name}
                onChange={(event) => updateServiceField("wholesale_company_name", event.target.value)}
              />
              <TextField
                label="Город"
                value={serviceForm.wholesale_city}
                onChange={(event) => updateServiceField("wholesale_city", event.target.value)}
              />
              <TextField
                label="Адрес сервиса"
                value={serviceForm.wholesale_address}
                onChange={(event) => updateServiceField("wholesale_address", event.target.value)}
              />
              <TextField
                label="РћРїРёСЃР°РЅРёРµ СЃРµСЂРІРёСЃР°"
                multiline
                minRows={3}
                value={serviceForm.wholesale_service_details}
                onChange={(event) => updateServiceField("wholesale_service_details", event.target.value)}
                helperText="РњРёРЅРёРјСѓРј 20 СЃРёРјРІРѕР»РѕРІ"
              />
              <TextField
                label="РљРѕРјРјРµРЅС‚Р°СЂРёР№ (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)"
                multiline
                minRows={2}
                value={serviceForm.wholesale_comment}
                onChange={(event) => updateServiceField("wholesale_comment", event.target.value)}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.1}>
                <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon />}>
                  Р¤РѕС‚Рѕ СЃРµСЂРІРёСЃР° 1
                  <input
                    hidden
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={(event) => updateServiceField("wholesale_service_photo_1", event.target.files?.[0] || null)}
                  />
                </Button>
                <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon />}>
                  Р¤РѕС‚Рѕ СЃРµСЂРІРёСЃР° 2
                  <input
                    hidden
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={(event) => updateServiceField("wholesale_service_photo_2", event.target.files?.[0] || null)}
                  />
                </Button>
              </Stack>
              <Button
                variant="contained"
                onClick={submitWholesaleRequest}
                disabled={requestLoading}
                sx={{ alignSelf: "flex-start" }}
              >
                {requestLoading ? "РћС‚РїСЂР°РІР»СЏРµРј..." : "РћС‚РїСЂР°РІРёС‚СЊ Р·Р°СЏРІРєСѓ РЅР° РѕРїС‚РѕРІС‹Р№ СЃС‚Р°С‚СѓСЃ"}
              </Button>
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">
              РџРѕРјРµС‚РєР° РѕРїС‚РѕРІРѕРіРѕ СЃРµСЂРІРёСЃР° Р°РєС‚РёРІРЅР°. РњР°СЃС‚РµСЂ РІРёРґРёС‚ СЌС‚РѕС‚ СЃС‚Р°С‚СѓСЃ РІ РєР°СЂС‚РѕС‡РєРµ РєР»РёРµРЅС‚Р°.
            </Typography>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 1.6, md: 1.8 }, borderRadius: 1.8 }}>
        <Stack spacing={1.2}>
          <Typography variant="h3">Р‘С‹СЃС‚СЂС‹Рµ РґРµР№СЃС‚РІРёСЏ</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.1}>
            <Button
              variant="contained"
              startIcon={<RocketLaunchRoundedIcon />}
              onClick={() => navigate("/client/create")}
              sx={{ minWidth: { xs: "100%", sm: 180 } }}
            >
              РќРѕРІР°СЏ Р·Р°СЏРІРєР°
            </Button>
            <Button
              variant="outlined"
              startIcon={<ChatRoundedIcon />}
              onClick={() => navigate("/client/my")}
              sx={{ minWidth: { xs: "100%", sm: 210 } }}
            >
              РћС‚РєСЂС‹С‚СЊ РјРѕРё Р·Р°СЏРІРєРё Рё С‡Р°С‚
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 1.5, md: 1.7 }, borderRadius: 1.8 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            РљСЂР°С‚РєР°СЏ РїР°РјСЏС‚РєР°
          </Typography>
          <Typography variant="body2" color="text.secondary">
            1) РЎРѕР·РґР°Р№С‚Рµ Р·Р°СЏРІРєСѓ.
            <br />
            2) Р”РµСЂР¶РёС‚Рµ СЃРІСЏР·СЊ РІ С‡Р°С‚Рµ.
            <br />
            3) РџРѕСЃР»Рµ РѕРїР»Р°С‚С‹ Р·Р°РіСЂСѓР·РёС‚Рµ С‡РµРє.
          </Typography>
          <Divider />
          <Typography variant="caption" color="text.secondary">
            РћР±РЅРѕРІР»РµРЅРѕ: {dayjs().format("DD.MM.YYYY HH:mm")}
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}

