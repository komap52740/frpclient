import { Button } from "@mui/material";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { renderWithProviders } from "../../../test/renderWithProviders";
import LoginCard from "./LoginCard";
import LoginForm from "./LoginForm";

describe("Login experience accessibility", () => {
  it("announces auth status and passes axe", async () => {
    const { container } = renderWithProviders(
      <LoginCard
        requiresSetup={false}
        error="Неверный логин или пароль."
        success=""
        title="Вход в систему"
        subtitle="Авторизация по логину и паролю."
      >
        <LoginForm
          form={{ username: "client-user", password: "" }}
          loading={false}
          onSubmit={(event) => event.preventDefault()}
          onChange={() => undefined}
          footer={
            <Button type="button" variant="text">
              Забыли пароль?
            </Button>
          }
        />
      </LoginCard>
    );

    expect(screen.getByRole("heading", { name: "Вход в систему" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Неверный логин или пароль.");
    expect(screen.getByRole("button", { name: "Войти" })).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});
