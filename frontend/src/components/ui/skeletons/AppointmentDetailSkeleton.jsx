import { Grid, Paper, Skeleton, Stack } from "@mui/material";

export default function AppointmentDetailSkeleton() {
  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2.2 }}>
        <Stack spacing={1.2}>
          <Skeleton variant="text" width={230} height={36} />
          <Skeleton variant="rounded" width="100%" height={48} />
          <Skeleton variant="rounded" width="100%" height={44} />
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          <Stack spacing={2}>
            {[0, 1, 2].map((index) => (
              <Paper key={index} sx={{ p: 2.2 }}>
                <Stack spacing={1}>
                  <Skeleton variant="text" width={180} height={28} />
                  <Skeleton variant="text" width="100%" />
                  <Skeleton variant="text" width="92%" />
                  <Skeleton variant="rounded" width="100%" height={42} />
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Stack spacing={2}>
            {[0, 1].map((index) => (
              <Paper key={index} sx={{ p: 2.2 }}>
                <Stack spacing={1}>
                  <Skeleton variant="text" width={170} height={28} />
                  <Skeleton variant="text" width="100%" />
                  <Skeleton variant="text" width="88%" />
                  <Skeleton variant="text" width="75%" />
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
