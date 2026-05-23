log("ai_overview start", input);

const requestText = String(input.request || "").trim();
if (!requestText) {
  return { ok: false, error: "Missing input.request", ai_answer: null };
}

await page.goto("https://google.com/ai", {
  waitUntil: "domcontentloaded",
  timeout: 60000
});
log("opened", page.url());

const prompt = page.locator('textarea[placeholder="Ask anything"]').first();
await prompt.waitFor({ state: "visible", timeout: 30000 });
await prompt.fill(requestText);
const sendButton = page.locator('button[aria-label="Send"]').first();
await sendButton.waitFor({ state: "visible", timeout: 30000 });
await sendButton.click();
log("prompt submitted via Send button");

const mainCol = page.locator('div[data-container-id="main-col"]').first();
await mainCol.waitFor({ state: "visible", timeout: 60000 });
await sleep(3000);

const aiAnswer = await mainCol.evaluate((el) =>
  String(el.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
);

const result = {
  ok: Boolean(aiAnswer),
  ai_answer: aiAnswer || null,
  currentUrl: page.url(),
  request: requestText,
  error: aiAnswer ? null : "Empty main-col content"
};

setResult(result);
return result;
