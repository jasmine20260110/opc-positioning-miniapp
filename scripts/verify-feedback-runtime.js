const automator = require(process.env.MINIPROGRAM_AUTOMATOR_PATH);
const { DEMO_DATA } = require("../miniprogram/utils/demoData");

const SESSION_KEY = "opc_mvp_session";
const RESULT_KEY = "opc_mvp_result";
const FEEDBACKS_KEY = "opc_mvp_feedbacks";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const miniProgram = process.env.WECHAT_AUTOMATION_WS
    ? await automator.connect({ wsEndpoint: process.env.WECHAT_AUTOMATION_WS })
    : await automator.launch({
      cliPath: process.env.WECHAT_DEVTOOLS_CLI,
      projectPath: process.env.OPC_PROJECT_PATH || process.cwd(),
      trustProject: true,
      timeout: 60000,
    });
  const exceptions = [];
  const errorLogs = [];
  miniProgram.on("exception", (error) => exceptions.push(error));
  miniProgram.on("console", (entry) => {
    if (entry && (entry.type === "error" || entry.level === "error")) errorLogs.push(entry);
  });

  try {
    await miniProgram.callWxMethod("clearStorageSync");
    const result = clone(DEMO_DATA);
    const session = clone(DEMO_DATA.session);
    session.sessionId = "feedback-runtime-test";
    session.currentStep = "plan";
    session.selectedRouteId = "A";
    session.behavior = {};
    result.session = clone(session);
    await miniProgram.callWxMethod("setStorageSync", RESULT_KEY, result);
    await miniProgram.callWxMethod("setStorageSync", SESSION_KEY, session);

    let page = await miniProgram.reLaunch("/pages/plan/index?routeId=A");
    assert(page.path === "pages/plan/index", `没有进入计划页：${page.path}`);
    const feedbackButton = await page.$(".feedback-button");
    assert(feedbackButton, "计划页底部没有填写反馈按钮");
    assert((await feedbackButton.text()) === "填写反馈", "反馈按钮文案错误");

    await feedbackButton.tap();
    await sleep(1200);
    page = await miniProgram.currentPage();
    assert(page.path === "pages/feedback/index", `点击后没有进入反馈页：${page.path}`);
    assert((await page.$$(".question-card")).length === 5, "反馈页不是5个问题");
    assert((await page.$$(".feedback-textarea")).length === 5, "5个问题没有全部使用文本输入框");
    assert((await page.$$(".option-button")).length === 0, "反馈页仍存在选择按钮");
    assert((await page.$$(".score-button")).length === 0, "反馈页仍存在评分选项");

    await page.callMethod("onMostResonantDirectionInput", { detail: { value: "路线B · AI实践内容产品创作者" } });
    await page.callMethod("onResonanceReasonInput", { detail: { value: "这条路线最贴近我的实际经历。" } });
    await page.callMethod("onExperienceFeedbackInput", { detail: { value: "8分，整体清晰。" } });
    await page.callMethod("onDay1WillingnessInput", { detail: { value: "愿意，但需要控制在30分钟内。" } });
    await page.callMethod("onOtherSuggestionsInput", { detail: { value: "希望结果解释更简短。" } });
    await page.callMethod("onSubmit");
    await sleep(1200);

    page = await miniProgram.currentPage();
    assert(page.path === "pages/plan/index", "提交反馈后没有返回计划页");
    const records = await miniProgram.callWxMethod("getStorageSync", FEEDBACKS_KEY);
    const feedback = records && records[session.sessionId];
    assert(feedback, "反馈没有保存到本机");
    assert(feedback.mostResonantDirection === "路线B · AI实践内容产品创作者", "方向反馈没有正确保存");
    assert(feedback.experienceFeedback === "8分，整体清晰。", "体验反馈没有正确保存");
    assert(feedback.day1Willingness === "愿意，但需要控制在30分钟内。", "Day1意愿没有正确保存");

    const secondButton = await page.$(".feedback-button");
    await secondButton.tap();
    await sleep(1200);
    page = await miniProgram.currentPage();
    assert((await page.data("form.experienceFeedback")) === "8分，整体清晰。", "再次进入没有回填体验反馈");
    assert((await page.data("form.mostResonantDirection")) === "路线B · AI实践内容产品创作者", "再次进入没有回填方向反馈");
    assert(exceptions.length === 0, `运行期间出现异常：${JSON.stringify(exceptions)}`);
    assert(errorLogs.length === 0, `运行期间出现console error：${JSON.stringify(errorLogs)}`);

    console.log(JSON.stringify({
      success: true,
      buttonNavigationVerified: true,
      questionCount: 5,
      allQuestionsAreFreeText: true,
      feedbackPersisted: true,
      feedbackRestored: true,
      exceptions: 0,
      consoleErrors: 0,
    }, null, 2));
  } finally {
    try {
      await miniProgram.callWxMethod("clearStorageSync");
    } catch (error) {}
    try {
      await miniProgram.reLaunch("/pages/index/index");
    } catch (error) {}
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
