const express = require("express");
const { chromium } = require("playwright");
const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------------
// UTIL — Launch Stealth Browser
// -------------------------------
async function launchStealth() {
  return await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox"
    ]
  });
}

// -------------------------------
// GENERIC SCRAPER FUNCTION
// -------------------------------
async function scrapeSite(url, pageExtractor) {
  let browser;
  try {
    browser = await launchStealth();
    const page = await browser.newPage();

    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["image", "font", "media"].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    const results = await pageExtractor(page);
    await browser.close();
    return results;
  } catch (e) {
    if (browser) await browser.close();
    return { error: e.message };
  }
}

// -------------------------------
// SCRAPERS FOR EACH WEBSITE
// -------------------------------

// 1️⃣ INDEED
async function indeedScraper(role, location) {
  const url =
    `https://www.indeed.com/jobs?q=${encodeURIComponent(role)}&l=${encodeURIComponent(location)}`;

  return scrapeSite(url, async (page) => {
    return await page.evaluate(() => {
      const items = document.querySelectorAll(".job_seen_beacon");
      return [...items].map((el) => ({
        title: el.querySelector("h2")?.innerText || null,
        company: el.querySelector(".companyName")?.innerText || null,
        location: el.querySelector(".companyLocation")?.innerText || null,
        link: el.querySelector("a")?.href || null
      }));
    });
  });
}

// 2️⃣ LINKEDIN
async function linkedinScraper(role, location) {
  const url =
    `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(role)}&location=${encodeURIComponent(location)}`;

  return scrapeSite(url, async (page) => {
    return await page.evaluate(() => {
      const items = document.querySelectorAll(".jobs-search-results__list-item");
      return [...items].map((el) => ({
        title: el.querySelector(".base-search-card__title")?.innerText.trim() || null,
        company: el.querySelector(".base-search-card__subtitle")?.innerText.trim() || null,
        location: el.querySelector(".job-search-card__location")?.innerText.trim() || null,
        link: el.querySelector("a")?.href || null
      }));
    });
  });
}

// 3️⃣ GLASSDOOR
async function glassdoorScraper(role, location) {
  const url =
    `https://www.glassdoor.com/Job/${location.replace(/ /g, "-")}-${role.replace(/ /g, "-")}-jobs-SRCH_IL.0,0_IC1147401_KO0,0.htm`;

  return scrapeSite(url, async (page) => {
    return await page.evaluate(() => {
      const items = document.querySelectorAll(".job-search-1");
      return [...items].map((el) => ({
        title: el.querySelector("a")?.innerText || null,
        company: el.querySelector(".e1n63ojh0")?.innerText || null,
        location: el.querySelector(".e1rrn5ka0")?.innerText || null,
        link: el.querySelector("a")?.href || null
      }));
    });
  });
}

// 4️⃣ ZIPRECRUITER
async function zipRecruiterScraper(role, location) {
  const url =
    `https://www.ziprecruiter.com/candidate/search?search=${encodeURIComponent(role)}&location=${encodeURIComponent(location)}`;

  return scrapeSite(url, async (page) => {
    return await page.evaluate(() => {
      const items = document.querySelectorAll(".job_content");
      return [...items].map((el) => ({
        title: el.querySelector(".job_title")?.innerText || null,
        company: el.querySelector(".t_org_link")?.innerText || null,
        location: el.querySelector(".location")?.innerText || null,
        link: el.querySelector("a")?.href || null
      }));
    });
  });
}

// 5️⃣ SIMPLYHIRED
async function simplyHiredScraper(role, location) {
  const url =
    `https://www.simplyhired.com/search?q=${encodeURIComponent(role)}&l=${encodeURIComponent(location)}`;

  return scrapeSite(url, async (page) => {
    return await page.evaluate(() => {
      const items = document.querySelectorAll(".SerpJob-jobCard");
      return [...items].map((el) => ({
        title: el.querySelector(".jobposting-title")?.innerText || null,
        company: el.querySelector(".jobposting-company")?.innerText || null,
        location: el.querySelector(".jobposting-location")?.innerText || null,
        link: el.querySelector("a")?.href || null
      }));
    });
  });
}

// 6️⃣ ANGELLIST (Wellfound)
async function angelListScraper(role) {
  const url = `https://wellfound.com/role/${role.replace(/ /g, "-")}`;

  return scrapeSite(url, async (page) => {
    return await page.evaluate(() => {
      const items = document.querySelectorAll(".styles_component__roleCard");
      return [...items].map((el) => ({
        title: el.querySelector(".styles_title")?.innerText || null,
        company: el.querySelector(".styles_company")?.innerText || null,
        link: el.querySelector("a")?.href || null
      }));
    });
  });
}

// 7️⃣ USAJOBS
async function usaJobsScraper(role, location) {
  const url =
    `https://www.usajobs.gov/Search?Keyword=${encodeURIComponent(role)}&Location=${encodeURIComponent(location)}`;

  return scrapeSite(url, async (page) => {
    return await page.evaluate(() => {
      const items = document.querySelectorAll("usajobs-search-result");
      return [...items].map((el) => ({
        title: el.querySelector("h2")?.innerText || null,
        company: el.querySelector(".usajobs-search-result--core__agency")?.innerText || null,
        location: el.querySelector(".usajobs-search-result--core__location")?.innerText || null,
        link: el.querySelector("a")?.href || null
      }));
    });
  });
}

// -------------------------------
// MASTER ENDPOINT
// -------------------------------
app.get("/jobs", async (req, res) => {
  const role = req.query.role || "software engineer";
  const location = req.query.location || "USA";

  const results = await Promise.all([
    indeedScraper(role, location),
    linkedinScraper(role, location),
    glassdoorScraper(role, location),
    zipRecruiterScraper(role, location),
    simplyHiredScraper(role, location),
    angelListScraper(role),
    usaJobsScraper(role, location)
  ]);

  res.json({
    role,
    location,
    sources: {
      indeed: results[0],
      linkedin: results[1],
      glassdoor: results[2],
      ziprecruiter: results[3],
      simplyhired: results[4],
      angellist: results[5],
      usajobs: results[6]
    }
  });
});

app.listen(PORT, () => {
  console.log("Job Scraper API running on port", PORT);
});
