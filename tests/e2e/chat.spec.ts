import { expect, test } from "@playwright/test";

test("supports streaming chat, multiple conversations, and local recovery", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("开始第一轮对话")).toBeVisible();

  await page.getByTestId("chat-input").fill("Launch checklist for demo");
  await page.getByTestId("send-button").click();

  await expect(page.getByTestId("user-message").last()).toContainText("Launch checklist for demo");
  await expect(page.getByTestId("assistant-message").last()).toContainText("当前仍处于 Mock 模式", {
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: /Launch checklist for demo/i })).toBeVisible();

  await page.getByTestId("new-chat-button").click();
  await page.getByTestId("chat-input").fill("Second thread summary");
  await page.getByTestId("send-button").click();

  await expect(page.getByTestId("assistant-message").last()).toContainText("当前仍处于 Mock 模式", {
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: /Second thread summary/i })).toBeVisible();

  await page.getByRole("button", { name: /Launch checklist for demo/i }).click();
  await expect(page.getByRole("heading", { name: "Launch checklist for demo" })).toBeVisible();
  await expect(page.getByTestId("user-message").last()).toContainText("Launch checklist for demo");

  await page.reload();

  await expect(page.getByRole("heading", { name: "新对话" })).toBeVisible();
  await page.getByRole("button", { name: /Launch checklist for demo/i }).click();
  await expect(page.getByRole("heading", { name: "Launch checklist for demo" })).toBeVisible();
  await expect(page.getByTestId("assistant-message").last()).toContainText("当前仍处于 Mock 模式", {
    timeout: 15_000,
  });
});

test("shows the error state and allows retry after a one-time mock failure", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("chat-input").fill("Retry __mock_error_once__ path");
  await page.getByTestId("send-button").click();

  await expect(page.getByText("请求失败")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "重试", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "重试", exact: true }).click();

  await expect(page.getByTestId("assistant-message").last()).toContainText("当前仍处于 Mock 模式", {
    timeout: 15_000,
  });
});
