import { Box } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useLocation } from "react-router-dom";

export default function PageMotion({ children }) {
  const location = useLocation();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  return (
    <Box
      key={`${location.pathname}${location.search}`}
      sx={{
        animation: reducedMotion ? "none" : "frpPageEnter 320ms cubic-bezier(0.16, 1, 0.3, 1)",
        transformOrigin: "top center",
      }}
    >
      {children}
    </Box>
  );
}

