const express = require("express");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/scrape", async (req, res) => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto("https://example.com");
    const title = await page.title();

    await browser.close();

    res.json({ success: true, title });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`Running on port ${PORT}`));
