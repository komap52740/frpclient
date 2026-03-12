import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadFixturePath = path.join(__dirname, "fixtures", "chat-upload.txt");
const smokeUsername = process.env.PLAYWRIGHT_SMOKE_USERNAME || "playwright_b2b_client";
const smokePassword = process.env.PLAYWRIGHT_SMOKE_PASSWORD || "PlaywrightPass123!";

async function navigateWithinSpa(page, nextPath) {
  await page.evaluate((targetPath) => {
    window.history.pushState({}, "", targetPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, nextPath);
}

async function fillTextField(locator, value) {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEditable();
  await locator.fill(value, { force: true });
}

test.describe("critical client smoke", () => {
  test("login -> appointment -> chat -> upload/download -> b2b queue", async ({
    page,
    request,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="text"]').first().fill(smokeUsername);
    await page.locator('input[type="password"]').first().fill(smokePassword);
    await page.getByTestId("auth-login-submit").click();

    await expect(page).not.toHaveURL(/\/login(?:$|\?)/);
    await page.locator('a[href="/client/create"]').first().waitFor({ state: "visible" });
    await page.locator('a[href="/client/create"]').first().click();

    await expect(page).toHaveURL(/\/client\/create$/);
    await expect(page.getByTestId("appointment-wizard-page")).toBeVisible();

    await fillTextField(page.getByTestId("appointment-wizard-brand"), "Samsung");
    await fillTextField(page.getByTestId("appointment-wizard-model"), "Galaxy A55");
    await page.getByTestId("appointment-wizard-lock-type").click();
    await page.getByRole("option", { name: "Google" }).click();
    await page.getByTestId("appointment-wizard-next").click();

    await page.getByTestId("appointment-wizard-rustdesk-id").click();
    await fillTextField(page.getByTestId("appointment-wizard-rustdesk-id"), "12345678");
    await fillTextField(page.getByTestId("appointment-wizard-rustdesk-password"), "4321");
    await fillTextField(
      page.getByTestId("appointment-wizard-description"),
      "Playwright smoke appointment for B2B queue and signed file download."
    );
    await page.getByTestId("appointment-wizard-next").click();
    await page.getByTestId("appointment-wizard-submit").click();

    await expect(page).toHaveURL(/\/appointments\/\d+$/);
    const appointmentIdMatch = page.url().match(/\/appointments\/(\d+)$/);
    expect(appointmentIdMatch).not.toBeNull();
    const appointmentId = appointmentIdMatch[1];

    await expect(page.getByTestId("chat-composer-text")).toBeVisible();
    const textMessageResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/appointments/${appointmentId}/messages/`) &&
        response.request().method() === "POST" &&
        response.status() === 201
    );
    await fillTextField(
      page.getByTestId("chat-composer-text"),
      "Smoke text message from Playwright"
    );
    await page.getByTestId("chat-composer-send").click();
    await textMessageResponse;
    await expect(page.getByText("Smoke text message from Playwright")).toBeVisible();

    const fileMessageResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/appointments/${appointmentId}/messages/`) &&
        response.request().method() === "POST" &&
        response.status() === 201
    );
    await page.getByTestId("chat-composer-file-input").setInputFiles(uploadFixturePath);
    await page.getByTestId("chat-composer-send").click();
    await fileMessageResponse;

    const fileLink = page.locator('[data-testid^="chat-message-file-"]').last();
    await expect(fileLink).toBeVisible();
    const signedFileUrl = await fileLink.getAttribute("href");
    expect(signedFileUrl).toBeTruthy();

    const fileResponse = await request.get(signedFileUrl);
    expect(fileResponse.ok()).toBeTruthy();
    expect(fileResponse.headers()["content-type"] || "").toContain("text/plain");
    expect(await fileResponse.text()).toContain("playwright smoke attachment");

    await navigateWithinSpa(page, "/wholesale");
    await expect(page).toHaveURL(/\/wholesale$/);

    const wholesaleOrdersResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/wholesale/portal/orders/") &&
        response.request().method() === "GET" &&
        response.ok()
    );
    await navigateWithinSpa(page, "/wholesale/orders");
    await wholesaleOrdersResponse;
    await expect(page).toHaveURL(/\/wholesale\/orders$/);
    await expect(page.getByTestId("wholesale-orders-page")).toBeVisible();
    await expect(page.getByTestId(`wholesale-order-card-${appointmentId}`)).toBeVisible();
  });
});
