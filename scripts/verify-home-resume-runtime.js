const assert = require("assert");
const automator = require(process.env.MINIPROGRAM_AUTOMATOR_PATH);
const { DEMO_DATA } = require("../miniprogram/utils/demoData");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const miniProgram = await automator.connect({
    wsEndpoint: process.env.WECHAT_AUTOMATION_WS,
  });
  const exceptions = [];
  const errors = [];
  miniProgram.on("exception", (error) => exceptions.push(error));
  miniProgram.on("console", (entry) => {
    if (entry && (entry.type === "error" || entry.level === "error")) errors.push(entry);
  });

  try {
    const result = clone(DEMO_DATA);
    const session = clone(DEMO_DATA.session);
    session.currentQuestionIndex = 19;
    session.currentIndex = 19;
    session.currentStep = "plan";
    session.selectedRouteId = "A";
    result.session = clone(session);
    result.plan = clone(DEMO_DATA.plan);
    await miniProgram.callWxMethod("setStorageSync", "opc_mvp_session", session);
    await miniProgram.callWxMethod("setStorageSync", "opc_mvp_result", result);
    await miniProgram.callWxMethod("setStorageSync", "opc_mvp_plan", result.plan);

    let page = await miniProgram.reLaunch("/pages/index/index");
    const primaryButton = await page.$(".main-button");
    const completedLabel = await primaryButton.text();
    assert.strictEqual(completedLabel, "开始探索");
    await primaryButton.tap();
    await sleep(800);
    page = await miniProgram.currentPage();
    assert.strictEqual(page.path, "pages/positioning-intro/index");
    const completedEnterButton = await page.$(".intro-enter-button");
    await completedEnterButton.tap();
    await sleep(1000);
    page = await miniProgram.currentPage();
    assert.strictEqual(page.path, "pages/question/index");
    assert.strictEqual(await page.data("currentIndex"), 0);

    const draftSession = {
      sessionId: "resume-q3",
      status: "in_progress",
      currentStep: "questions",
      currentIndex: 2,
      currentQuestionIndex: 2,
      answers: { Q1: "回答1", Q2: "回答2", Q3: "Q3草稿" },
      context: {},
      behavior: {},
    };
    await miniProgram.callWxMethod("setStorageSync", "opc_mvp_session", draftSession);
    await miniProgram.callWxMethod("removeStorageSync", "opc_mvp_result");
    await miniProgram.callWxMethod("removeStorageSync", "opc_mvp_plan");
    page = await miniProgram.reLaunch("/pages/index/index");
    const questionButton = await page.$(".main-button");
    const draftLabel = await questionButton.text();
    assert.strictEqual(draftLabel, "开始探索");
    await questionButton.tap();
    await sleep(800);
    page = await miniProgram.currentPage();
    assert.strictEqual(page.path, "pages/positioning-intro/index");
    const draftEnterButton = await page.$(".intro-enter-button");
    await draftEnterButton.tap();
    await sleep(1000);
    page = await miniProgram.currentPage();
    assert.strictEqual(page.path, "pages/question/index");
    assert.strictEqual(await page.data("currentIndex"), 0);

    assert.strictEqual(exceptions.length, 0);
    assert.strictEqual(errors.length, 0);
    console.log(JSON.stringify({
      success: true,
      completedLabel,
      completedDestination: "pages/question/index",
      draftLabel,
      draftDestination: "pages/question/index",
      draftQuestionIndex: 0,
      introRequiresTap: true,
      runtimeExceptions: 0,
      consoleErrors: 0,
    }, null, 2));
  } finally {
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
