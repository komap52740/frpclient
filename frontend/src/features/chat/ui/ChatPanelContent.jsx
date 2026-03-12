import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import { Alert, Box, Button, Chip, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import ChatThread from "../../../components/ui/ChatThread";
import { useChat } from "../hooks/useChat";
import ChatComposer from "./ChatComposer";
import ChatLinksPanel from "./ChatLinksPanel";
import { RuDesktopEditorPanel, RuDesktopStatusPanel } from "./RuDesktopPanels";

export default function ChatPanelContent() {
  const {
    currentUser,
    isMobile,
    isDark,
    isSplitClientLayout,
    text,
    file,
    error,
    fileError,
    isSending,
    chatView,
    newIncomingCount,
    ruDesktopForm,
    ruDesktopError,
    ruDesktopSuccess,
    threadRef,
    safeDownloadLinks,
    threadItems,
    linkItems,
    canEditRuDesktop,
    ruDesktopSaving,
    hasRuDesktopCard,
    ruDesktopId,
    ruDesktopPassword,
    setChatView,
    setText,
    setNewIncomingCount,
    updateRuDesktopField,
    onThreadScroll,
    onSend,
    onDelete,
    onFileChange,
    copyLink,
    scrollToBottom,
    saveRuDesktopInline,
  } = useChat();

  const linksPanel = (
    <ChatLinksPanel linkItems={linkItems} copyLink={copyLink} isDark={isDark} isMobile={isMobile} />
  );
  const ruDesktopPanel = (
    <RuDesktopStatusPanel
      hasRuDesktopCard={hasRuDesktopCard}
      isDark={isDark}
      ruDesktopId={ruDesktopId}
      ruDesktopPassword={ruDesktopPassword}
    />
  );
  const ruDesktopInputPanel = (
    <RuDesktopEditorPanel
      canEditRuDesktop={canEditRuDesktop}
      isDark={isDark}
      ruDesktopForm={ruDesktopForm}
      ruDesktopError={ruDesktopError}
      ruDesktopSuccess={ruDesktopSuccess}
      ruDesktopSaving={ruDesktopSaving}
      updateRuDesktopField={updateRuDesktopField}
      saveRuDesktopInline={saveRuDesktopInline}
    />
  );

  return (
    <Paper
      sx={{
        p: { xs: 1.4, sm: 2 },
        borderRadius: 1.6,
        overflow: "hidden",
        background: isDark
          ? "linear-gradient(160deg, rgba(10,17,31,0.92) 0%, rgba(17,24,39,0.88) 100%)"
          : "linear-gradient(160deg, rgba(255,255,255,0.9) 0%, rgba(250,252,255,0.86) 100%)",
      }}
    >
      <Stack spacing={1.1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h3">Чат по заявке</Typography>
          <Chip
            size="small"
            icon={<LinkRoundedIcon />}
            label={
              isSplitClientLayout ? `Ссылок: ${linkItems.length}` : `Ссылки: ${linkItems.length}`
            }
            variant="outlined"
          />
        </Stack>

        {!isSplitClientLayout ? (
          <Tabs
            value={chatView}
            onChange={(_, value) => setChatView(value)}
            variant="fullWidth"
            sx={{
              borderRadius: 1.4,
              bgcolor: (themeValue) =>
                themeValue.palette.mode === "dark"
                  ? alpha("#0f172a", 0.66)
                  : alpha("#e5eefb", 0.62),
              minHeight: 40,
              "& .MuiTab-root": {
                minHeight: 40,
                textTransform: "none",
                fontWeight: 700,
              },
            }}
          >
            <Tab value="messages" label="Сообщения" />
            <Tab value="links" label={`Ссылки (${linkItems.length})`} />
          </Tabs>
        ) : null}

        {error ? <Alert severity="error">{error}</Alert> : null}
        {fileError ? <Alert severity="warning">{fileError}</Alert> : null}
        {file && !fileError ? (
          <Alert severity="success">Файл готов к отправке: {file.name}</Alert>
        ) : null}

        {isSplitClientLayout ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.35fr) minmax(250px, 0.9fr)",
              gap: 1.2,
              alignItems: "start",
            }}
          >
            <Paper
              variant="outlined"
              sx={{
                p: 0.8,
                borderRadius: 1.3,
                bgcolor: isDark ? alpha("#0f172a", 0.56) : alpha("#f8fbff", 0.72),
              }}
            >
              {newIncomingCount > 0 ? (
                <Button
                  size="small"
                  variant="contained"
                  sx={{ alignSelf: "flex-start", boxShadow: 2, mb: 0.8 }}
                  onClick={() => {
                    setNewIncomingCount(0);
                    scrollToBottom();
                  }}
                >
                  Новые сообщения: {newIncomingCount}
                </Button>
              ) : null}

              <ChatThread
                items={threadItems}
                currentUserId={currentUser.id}
                currentUserRole={currentUser.role}
                onDeleteMessage={onDelete}
                containerRef={threadRef}
                onScroll={onThreadScroll}
              />
            </Paper>
            <Stack spacing={0.6}>
              {ruDesktopPanel}
              {ruDesktopInputPanel}
              {safeDownloadLinks.length ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1,
                    borderRadius: 1.3,
                    borderColor: "divider",
                    bgcolor: isDark ? alpha("#0f172a", 0.62) : alpha("#f8fbff", 0.9),
                  }}
                >
                  <Stack spacing={0.55}>
                    <Typography variant="caption" color="text.secondary">
                      Ссылки для работы
                    </Typography>
                    {safeDownloadLinks.map((item) => (
                      <Button
                        key={`dl-${item.id || item.href}`}
                        size="small"
                        variant="outlined"
                        component="a"
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        sx={{ justifyContent: "flex-start", borderRadius: 1.1 }}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </Stack>
                </Paper>
              ) : null}
              <Typography variant="caption" color="text.secondary" sx={{ px: 0.2 }}>
                Ссылки из чата
              </Typography>
              {linksPanel}
            </Stack>
          </Box>
        ) : chatView === "messages" ? (
          <>
            {newIncomingCount > 0 ? (
              <Button
                size="small"
                variant="contained"
                sx={{ alignSelf: "flex-start", boxShadow: 2 }}
                onClick={() => {
                  setNewIncomingCount(0);
                  scrollToBottom();
                }}
              >
                Новые сообщения: {newIncomingCount}
              </Button>
            ) : null}

            <ChatThread
              items={threadItems}
              currentUserId={currentUser.id}
              currentUserRole={currentUser.role}
              onDeleteMessage={onDelete}
              containerRef={threadRef}
              onScroll={onThreadScroll}
            />
          </>
        ) : (
          linksPanel
        )}

        <ChatComposer
          isDark={isDark}
          isMobile={isMobile}
          text={text}
          file={file}
          fileError={fileError}
          isSending={isSending}
          setText={setText}
          onFileChange={onFileChange}
          onSend={onSend}
        />
        {!isSplitClientLayout && ruDesktopInputPanel}
      </Stack>
    </Paper>
  );
}
