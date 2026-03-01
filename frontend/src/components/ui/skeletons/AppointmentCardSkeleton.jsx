import { Card, CardContent, Skeleton, Stack } from "@mui/material";

export default function AppointmentCardSkeleton() {
  return (
    <Card>
      <CardContent>
        <Stack spacing={1.1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Skeleton variant="text" width={170} height={30} />
            <Skeleton variant="rounded" width={94} height={26} />
          </Stack>
          <Skeleton variant="text" width="100%" />
          <Skeleton variant="text" width="74%" />
          <Skeleton variant="rounded" width="100%" height={8} />
          <Stack direction="row" spacing={1}>
            <Skeleton variant="rounded" width={130} height={28} />
            <Skeleton variant="rounded" width={120} height={28} />
          </Stack>
          <Skeleton variant="rounded" width="100%" height={42} />
        </Stack>
      </CardContent>
    </Card>
  );
}
