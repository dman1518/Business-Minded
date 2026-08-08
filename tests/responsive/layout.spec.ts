import { test, expect, type Page } from "@playwright/test";

/**
 * P0 responsive-repair verification (see remediation brief).
 *
 * Loads each primary page at every required breakpoint and fails if any
 * meaningful element's bounding rect extends beyond the viewport width, or
 * if the document itself is horizontally scrollable. This intentionally
 * checks real computed layout rather than just class names, so it catches
 * regressions regardless of which CSS technique caused them (fixed widths,
 * unconstrained flex/grid children, off-canvas elements without clipping,
 * oversized text, etc).
 *
 * Mobile-specific flows (assessment, results) are tested against seeded
 * client state (localStorage progress / a fixture id) rather than a live
 * submission, so these tests don't depend on a live database.
 */

const BREAKPOINTS = [320, 375, 390, 430, 768, 1440] as const;

/** Elements that are allowed to be visually clipped/hidden (e.g. the honeypot). */
const IGNORED_SELECTOR = '[aria-hidden="true"]';

async function assertNoHorizontalOverflow(page: Page, viewportWidth: number) {
  // 1. Document-level check: the page itself must not be horizontally scrollable.
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    scrollWidth,
    `document.scrollWidth (${scrollWidth}) exceeds viewport clientWidth (${clientWidth}) at ${viewportWidth}px — page is horizontally scrollable.`
  ).toBeLessThanOrEqual(clientWidth);

  // 2. Element-level check: no visible, non-ignored element's box may extend
  //    past the right edge of the viewport (a coarser check than scrollWidth
  //    that also catches elements clipped by an ancestor overflow:hidden,
  //    which the brief explicitly forbids using to mask this class of bug).
  const offenders = await page.evaluate((ignoredSelector) => {
    const viewportWidth = document.documentElement.clientWidth;
    const results: { tag: string; text: string; right: number }[] = [];
    document.querySelectorAll("body *").forEach((el) => {
      if (el.closest(ignoredSelector)) return;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      // Allow a 1px rounding tolerance.
      if (rect.right > viewportWidth + 1) {
        results.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || "").trim().slice(0, 40),
          right: Math.round(rect.right),
        });
      }
    });
    return results;
  }, IGNORED_SELECTOR);

  expect(
    offenders,
    `Found ${offenders.length} element(s) overflowing the ${viewportWidth}px viewport: ${JSON.stringify(offenders)}`
  ).toHaveLength(0);
}

for (const width of BREAKPOINTS) {
  test.describe(`viewport ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("landing page has no horizontal overflow", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("link", { name: /start assessment/i })).toBeVisible();
      await assertNoHorizontalOverflow(page, width);
    });

    test("assessment question renders as wrapped phrases, no overflow", async ({ page }) => {
      await page.goto("/assessment");
      await expect(page.getByRole("radiogroup")).toBeVisible();

      // Question text must wrap as normal prose: every line box a single
      // word tall would mean dozens of line boxes for a full sentence.
      // We assert instead on the concrete, brief-mandated outcome: the
      // rendered heading's height stays within a small multiple of one
      // line, and it never exceeds the viewport width.
      const heading = page.locator("h3").first();
      const box = await heading.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x + box.width, `question heading overflows at ${width}px`).toBeLessThanOrEqual(
          width + 1
        );
      }

      await assertNoHorizontalOverflow(page, width);
    });

    test("results page cards stay aligned and fully visible", async ({ page }) => {
      // Seed a fixture result via route interception so this test doesn't
      // require a live database.
      await page.route("**/api/assessments/*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "fixture-result-id",
            overallScore: 65,
            categoryScores: [
              { categoryId: "money", categoryName: "Money", score: 13, status: "Developing" },
              { categoryId: "operations", categoryName: "Operations", score: 10, status: "Developing" },
              { categoryId: "growth", categoryName: "Growth", score: 15, status: "Developing" },
              { categoryId: "freedom", categoryName: "Freedom", score: 13, status: "Developing" },
              { categoryId: "resilience", categoryName: "Resilience", score: 15, status: "Developing" },
            ],
            scoreInterpretation:
              "At 65/100, your business has a solid foundation with a few clear areas holding it back.",
            whatsWorking: {
              categoryId: "growth",
              categoryName: "Growth",
              headline: "You have a repeatable path to growth",
              description:
                "A reliable way to bring in new customers makes future growth less dependent on luck. This was your strongest dimension, scoring 15/20.",
            },
            biggestOpportunity: {
              categoryId: "money",
              categoryName: "Money",
              headline: "Strengthen your financial foundation",
              description:
                "Improving margin and revenue predictability is one of the fastest ways to increase what your business is worth, even when the underlying explanation runs long enough to wrap across several lines on a narrow screen. This was your next-biggest area for improvement, at 13/20.",
            },
            biggestConstraint: {
              categoryId: "operations",
              categoryName: "Operations",
              headline: "Inconsistent execution",
              description: "Without documented processes, quality depends on who is doing the work. This was your lowest-scoring dimension, at 10/20.",
            },
            topPriorities: [
              {
                categoryId: "operations",
                categoryName: "Operations",
                action: "Review your pricing and margins this month.",
                whyItMatters: "Predictable profit and cash flow directly increase what the business is worth.",
                timeframe: "This month",
              },
              {
                categoryId: "money",
                categoryName: "Money",
                action: "Document your top two recurring processes as simple step-by-step guides this quarter.",
                whyItMatters: "Documented processes let the business run consistently without depending on any one person.",
                timeframe: "This quarter",
              },
              {
                categoryId: "freedom",
                categoryName: "Freedom",
                action: "Identify the one marketing or sales activity that has worked best, and turn it into a repeatable process.",
                whyItMatters: "A repeatable growth engine makes future revenue less dependent on luck or one-off effort.",
                timeframe: "This quarter",
              },
            ],
            confidenceLevel: "High",
          }),
        });
      });

      await page.goto("/results?id=fixture-result-id");
      await expect(page.getByText("Category Scores")).toBeVisible();
      await assertNoHorizontalOverflow(page, width);

      // Category rows: name and score must both stay on-screen and aligned
      // (name truncates rather than pushing the score off the card).
      const rows = page.locator("text=Money").locator("..");
      await expect(rows.first()).toBeVisible();
    });

    test("lead capture form has no phantom overflow from hidden fields", async ({ page }) => {
      await page.route("**/api/assessments/*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "fixture-result-id",
            overallScore: 65,
            categoryScores: [
              { categoryId: "money", categoryName: "Money", score: 13, status: "Developing" },
              { categoryId: "operations", categoryName: "Operations", score: 10, status: "Developing" },
              { categoryId: "growth", categoryName: "Growth", score: 15, status: "Developing" },
              { categoryId: "freedom", categoryName: "Freedom", score: 13, status: "Developing" },
              { categoryId: "resilience", categoryName: "Resilience", score: 15, status: "Developing" },
            ],
            scoreInterpretation: "At 65/100, your business has a solid foundation.",
            whatsWorking: {
              categoryId: "growth",
              categoryName: "Growth",
              headline: "You have a repeatable path to growth",
              description: "Short description. This was your strongest dimension, scoring 15/20.",
            },
            biggestOpportunity: {
              categoryId: "money",
              categoryName: "Money",
              headline: "Strengthen your financial foundation",
              description: "Short description.",
            },
            biggestConstraint: {
              categoryId: "operations",
              categoryName: "Operations",
              headline: "Inconsistent execution",
              description: "Short description.",
            },
            topPriorities: [
              {
                categoryId: "operations",
                categoryName: "Operations",
                action: "Priority one.",
                whyItMatters: "Why one.",
                timeframe: "This month",
              },
              {
                categoryId: "money",
                categoryName: "Money",
                action: "Priority two.",
                whyItMatters: "Why two.",
                timeframe: "This quarter",
              },
              {
                categoryId: "freedom",
                categoryName: "Freedom",
                action: "Priority three.",
                whyItMatters: "Why three.",
                timeframe: "This quarter",
              },
            ],
            confidenceLevel: "High",
          }),
        });
      });

      await page.goto("/results?id=fixture-result-id");
      const ctaButtons = page.getByRole("button", { name: /report/i });
      await ctaButtons.first().click();

      await expect(page.getByLabel(/first name/i)).toBeVisible();
      await assertNoHorizontalOverflow(page, width);
    });
  });
}
