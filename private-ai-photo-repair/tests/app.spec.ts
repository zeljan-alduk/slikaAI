import { test, expect, type Page } from "@playwright/test";
import { makePngBuffer } from "./pngFixture";

const PNG = makePngBuffer(96, 96);

async function openApp(page: Page): Promise<void> {
  // Force English + light theme for stable selectors, and mock mode for speed.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("papr-lang", "en");
      localStorage.setItem("papr-theme", "light");
    } catch {
      /* ignore */
    }
  });
  await page.goto("/?engine=mock");
}

async function uploadSample(page: Page): Promise<void> {
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(page.getByText("sample.png")).toBeVisible();
}

test("app loads with brand and image uploader", async ({ page }) => {
  await openApp(page);
  await expect(page.getByText("Private AI Photo Repair").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Main photo" })).toBeVisible();
});

test("parses a prompt into a recognised task", async ({ page }) => {
  await openApp(page);
  await page.getByRole("textbox").fill("remove background");
  await expect(page.getByText("Background removal").first()).toBeVisible();
});

test("suggested chip fills the prompt", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Enhance photo" }).click();
  await expect(page.getByRole("textbox")).toHaveValue(/enhance/i);
});

test("full mock flow: upload -> prompt -> start -> before/after -> export", async ({ page }) => {
  await openApp(page);
  await uploadSample(page);

  await page.getByRole("textbox").fill("remove background");
  await expect(page.getByText("Background removal").first()).toBeVisible();

  const start = page.getByRole("button", { name: "Start" });
  await expect(start).toBeEnabled();
  await start.click();

  // Mock background removal should produce a result and reveal the comparison.
  await expect(page.getByRole("heading", { name: "Before / after" })).toBeVisible({
    timeout: 40_000,
  });
  await expect(page.getByRole("button", { name: "Download" })).toBeVisible();
  // Result should be labelled as mock.
  await expect(page.getByText(/mock mode/i).first()).toBeVisible();
});

test("super-resolution mock runs and shows a result", async ({ page }) => {
  await openApp(page);
  await uploadSample(page);
  await page.getByRole("textbox").fill("upscale 2x");
  const start = page.getByRole("button", { name: "Start" });
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.getByRole("heading", { name: "Before / after" })).toBeVisible({
    timeout: 40_000,
  });
});

test("theme toggle switches the document theme", async ({ page }) => {
  await openApp(page);
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: /theme/i }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
});

test("model manager lists models with status and a download action", async ({ page }) => {
  await openApp(page);
  await page.getByText("Model manager", { exact: true }).click();
  await expect(page.getByText("Background Removal")).toBeVisible();
  // Real models that aren't cached expose a Download button.
  await expect(page.getByRole("button", { name: "Download" }).first()).toBeVisible();
  await expect(page.getByText("Not downloaded").first()).toBeVisible();
});

test("language switch to Croatian updates the UI", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "HR", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Glavna fotografija" })).toBeVisible();
});
