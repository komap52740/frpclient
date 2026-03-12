import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { renderWithProviders } from "../../test/renderWithProviders";
import ChatThread from "./ChatThread";

describe("ChatThread accessibility", () => {
  it("keeps message actions accessible and passes axe", async () => {
    const { container } = renderWithProviders(
      <ChatThread
        items={[
          {
            id: 55,
            sender: 7,
            sender_username: "client-user",
            text: "Файл отправлен",
            created_at: "2026-03-13T10:30:00Z",
            file_url: "https://example.com/file.txt",
            is_pending: false,
            is_deleted: false,
          },
        ]}
        currentUserId={7}
        currentUserRole="client"
        onDeleteMessage={() => undefined}
        containerRef={null}
        onScroll={() => undefined}
      />
    );

    expect(screen.getByRole("button", { name: "Удалить сообщение" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /открыть файл/i })).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});
