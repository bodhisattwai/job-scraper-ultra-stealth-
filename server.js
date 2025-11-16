import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json());

// Health route
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Main scraper endpoint
app.get("/scrape", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "Missing ?url=" });

    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);

    const html = await page.content();
    await browser.close();

    res.json({ success: true, html });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Stealth Scraper API running on port", PORT);
});
