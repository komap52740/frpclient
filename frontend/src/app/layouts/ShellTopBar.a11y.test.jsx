import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { renderWithProviders } from "../../test/renderWithProviders";
import ShellTopBar from "./ShellTopBar";

vi.mock("../../components/ui/NotificationBell", () => ({
  default: () => <button type="button" aria-label="Уведомления" />,
}));

describe("ShellTopBar accessibility", () => {
  it("exposes accessible names for header controls and passes axe", async () => {
    const { container } = renderWithProviders(
      <ShellTopBar
        route={{ title: "Кабинет", subtitle: "Рабочее пространство клиента" }}
        quickAction={{ to: "/client/create", label: "Новая заявка" }}
        roleLabel="Клиент"
        wholesaleBadge={null}
        onOpenDrawer={() => undefined}
        onLogout={() => undefined}
      />
    );

    expect(screen.getByRole("button", { name: "Открыть навигацию" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Включить светлую тему" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Выйти из аккаунта" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Уведомления" })).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});
