import { Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";

export function ClientReviewCard({
  reviewRef,
  reviewRating,
  setReviewRating,
  reviewComment,
  setReviewComment,
  onSubmit,
}) {
  return (
    <Paper ref={reviewRef} sx={{ p: 2.2 }}>
      <Typography variant="h3" sx={{ mb: 1 }}>
        Оцените работу мастера
      </Typography>
      <Stack spacing={1}>
        <TextField
          type="number"
          label="Рейтинг 1-5"
          value={reviewRating}
          onChange={(event) => setReviewRating(Number(event.target.value))}
        />
        <TextField
          label="Комментарий"
          multiline
          minRows={2}
          value={reviewComment}
          onChange={(event) => setReviewComment(event.target.value)}
        />
        <Button variant="outlined" onClick={onSubmit}>
          Отправить отзыв
        </Button>
      </Stack>
    </Paper>
  );
}

export function MasterReviewClientCard({
  reviewRef,
  reviewRating,
  setReviewRating,
  reviewComment,
  setReviewComment,
  clientReviewFlags,
  setClientReviewFlags,
  behaviorFlags,
  onSubmit,
}) {
  return (
    <Paper ref={reviewRef} sx={{ p: 2.2 }}>
      <Typography variant="h3" sx={{ mb: 1 }}>
        Оценка клиента
      </Typography>
      <Stack spacing={1}>
        <TextField
          type="number"
          label="Рейтинг 1-5"
          value={reviewRating}
          onChange={(event) => setReviewRating(Number(event.target.value))}
        />
        <TextField
          select
          label="Флаги поведения"
          SelectProps={{ multiple: true }}
          value={clientReviewFlags}
          onChange={(event) =>
            setClientReviewFlags(
              typeof event.target.value === "string"
                ? event.target.value.split(",")
                : event.target.value
            )
          }
        >
          {behaviorFlags.map((flag) => (
            <MenuItem key={flag.code} value={flag.code}>
              {flag.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Комментарий"
          multiline
          minRows={2}
          value={reviewComment}
          onChange={(event) => setReviewComment(event.target.value)}
        />
        <Button variant="outlined" onClick={onSubmit}>
          Сохранить оценку клиента
        </Button>
      </Stack>
    </Paper>
  );
}
