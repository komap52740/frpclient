import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { renderWithProviders } from "../../test/renderWithProviders";
import NotificationBell from "./NotificationBell";

const notificationListMock = vi.fn();
const markReadMock = vi.fn(async () => ({ data: { success: true } }));
const markAllReadMock = vi.fn(async () => ({ data: { success: true } }));

vi.mock("../../api/client", () => ({
  notificationsApi: {
    list: (...args) => notificationListMock(...args),
    markRead: (...args) => markReadMock(...args),
    markAllRead: (...args) => markAllReadMock(...args),
  },
}));

vi.mock("../../features/platform/notifications/hooks/useNotificationsRealtime", () => ({
  useNotificationsRealtime: () => undefined,
}));

describe("NotificationBell accessibility", () => {
  it("labels the bell and drawer actions accessibly and passes axe", async () => {
    notificationListMock.mockResolvedValue({
      data: [
        {
          id: 101,
          title: "Новая заявка",
          message: "Проверьте кейс в очереди",
          created_at: "2026-03-13T10:00:00Z",
          is_read: false,
          payload: {},
        },
      ],
    });

    const { container } = renderWithProviders(<NotificationBell />);

    await waitFor(() => {
      expect(notificationListMock).toHaveBeenCalled();
    });

    const trigger = screen.getByRole("button", { name: /уведомления/i });
    fireEvent.click(trigger);

    expect(await screen.findByRole("dialog", { name: "Уведомления" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Отметить уведомление прочитанным" })
    ).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});
