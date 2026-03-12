import GoogleIcon from "@mui/icons-material/Google";
import { Box, Button, Stack } from "@mui/material";

import { oauthServiceButtonSx, providerBadgeSx } from "./authStyles";

const PROVIDERS = [
  {
    id: "google",
    label: "Войти через Google",
    icon: <GoogleIcon sx={{ fontSize: 19 }} />,
  },
  {
    id: "yandex",
    label: "Войти через Яндекс",
    icon: "Я",
  },
  {
    id: "vk",
    label: "Войти через VK",
    icon: "VK",
  },
];

export default function OAuthButtons({ loading, onOAuthLogin }) {
  return (
    <Stack spacing={1.2}>
      {PROVIDERS.map((provider) => (
        <Button
          key={provider.id}
          fullWidth
          variant="outlined"
          disabled={loading}
          onClick={() => onOAuthLogin(provider.id)}
          sx={oauthServiceButtonSx}
          startIcon={<Box sx={providerBadgeSx}>{provider.icon}</Box>}
        >
          {provider.label}
        </Button>
      ))}
    </Stack>
  );
}
