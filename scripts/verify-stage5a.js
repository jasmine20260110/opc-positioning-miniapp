const fs = require("fs");
const path = require("path");
const automator = require(process.env.MINIPROGRAM_AUTOMATOR_PATH);
const { DEMO_DATA } = require("../miniprogram/utils/demoData");

const SESSION_KEY = "opc_mvp_session";
const RESULT_KEY = "opc_mvp_result";
const CONDITIONS_KEY = "opc_mvp_conditions";
const PLAN_KEY = "opc_mvp_plan";

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
  const miniProgram = await automator.connect({
    wsEndpoint: process.env.WECHAT_AUTOMATION_WS,
  });
  const exceptions = [];
  const errorLogs = [];
  const screenshotDir = process.env.STAGE5A_SCREENSHOT_DIR;
  miniProgram.on("exception", (error) => exceptions.push(error));
  miniProgram.on("console", (entry) => {
    if (entry && (entry.type === "error" || entry.level === "error")) errorLogs.push(entry);
  });

  try {
    console.log("STAGE5_CHECK setup:start");
    await miniProgram.callWxMethod("clearStorageSync");
    const result = clone(DEMO_DATA);
    const session = {
      sessionId: "stage5a-local-test",
      status: "in_progress",
      currentStep: "evidence",
      currentIndex: 19,
      currentQuestionIndex: 19,
      answers: {},
      context: {
        dailyAvailableTime: "1—2小时（早晚或周末）",
        weeklyAvailableTime: "7—14小时",
      },
      startupConditions: clone(DEMO_DATA.session.startupConditions),
      selectedRouteId: null,
      behavior: {},
    };
    await miniProgram.callWxMethod("setStorageSync", RESULT_KEY, result);
    await miniProgram.callWxMethod("setStorageSync", SESSION_KEY, session);

    console.log("STAGE5_CHECK startup:start");
    let page = await miniProgram.reLaunch("/pages/report/index?mode=startup");
    console.log("STAGE5_CHECK startup:relaunched");
    assert(page.path === "pages/report/index", "没有进入报告页");
    assert((await page.data("mode")) === "startup", "没有进入启动条件模式");
    assert((await page.$$(".condition-card")).length === 4, "启动条件不是4项");
    assert((await page.data("conditions.weeklyAvailableTime")) === "7—14小时", "Q20时间没有预填");

    await page.callMethod("onSelectRoute", {
      currentTarget: { dataset: { route: "A" } },
    });
    console.log("STAGE5_CHECK startup:selection-locked");
    await sleep(1600);
    let current = page;
    let storedSession = await miniProgram.callWxMethod("getStorageSync", SESSION_KEY);
    assert(current.path === "pages/report/index", "查看适配前不应允许进入计划页");
    assert(!storedSession.selectedRouteId, "查看适配前不应保存路线选择");

    await page.callMethod("onBudgetChange", { detail: { value: 1 } });
    console.log("STAGE5_CHECK startup:budget-changed");
    await sleep(200);
    const storedConditions = await miniProgram.callWxMethod("getStorageSync", CONDITIONS_KEY);
    assert(storedConditions.sessionId === session.sessionId, "条件记录没有绑定当前会话");
    assert(storedConditions.values.validationResources.budget === "500元以内", "预算修改没有立即保存");

    await page.callMethod("onShowFit");
    console.log("STAGE5_CHECK startup:fit-generated");
    await sleep(300);
    assert((await page.data("mode")) === "fit", "没有进入启动适配模式");
    const routes = await page.data("routes");
    const results = routes.map((route) => route.startupFit.result);
    assert(results.join("|") === "优先验证|补足后验证|暂缓", `三条路线结果不符合预期：${results.join("|")}`);
    assert((await page.$$(".dimension-item")).length === 12, "每条路线必须显示4项适配状态");
    assert(routes.every((route) => route.startupFit.maxGap && route.startupFit.recommendation), "路线缺少最大缺口或补足建议");
    assert(new Set(routes.map((route) => route.startupFit.conclusion)).size === 3, "三条路线的结论说明不应相同");
    assert(new Set(routes.map((route) => route.startupFit.maxGap)).size === 3, "三条路线的最大缺口不应相同");
    assert(new Set(routes.map((route) => route.startupFit.recommendation)).size === 3, "三条路线的补足建议不应相同");
    const reportText = await (await page.$(".report-screen")).text();
    assert(!reportText.includes("internalScore") && !reportText.includes("internal_score"), "页面暴露了内部精确分数字段");

    storedSession = await miniProgram.callWxMethod("getStorageSync", SESSION_KEY);
    const storedResult = await miniProgram.callWxMethod("getStorageSync", RESULT_KEY);
    assert(storedSession.currentStep === "startup_fit", "查看适配后步骤没有更新");
    assert(storedSession.behavior.startupFitViewed === true, "没有记录已查看适配");
    assert(storedResult.routes[0].startupFit.dimensions[0].internalScore === 2, "内部规则分数没有写入结果");

    if (screenshotDir) {
      const fitScreenshot = path.join(screenshotDir, "01-stage5a-fit.png");
      await miniProgram.screenshot({ path: fitScreenshot });
      assert(fs.existsSync(fitScreenshot), "启动适配截图未生成");
    }

    console.log("STAGE5_CHECK plan:start");
    await page.callMethod("onSelectRoute", {
      currentTarget: { dataset: { route: "B" } },
    });
    await sleep(1800);
    page = await miniProgram.currentPage();
    assert(page.path === "pages/plan/index", "选择路线后没有进入计划页");
    const plan = await page.data("plan");
    assert(plan.source === "fixed_local_fallback", "阶段五A没有使用本地固定计划");
    assert(plan.selectedRouteId === "B", "计划路线和选择路线不一致");
    assert(plan.days.length === 7, "计划不是Day 1—Day 7");
    assert(plan.days.every((day) => day.minimumAction && day.estimatedTime && day.completionEvidence && day.fallback), "每日计划字段不完整");
    assert(plan.days.some((day) => day.goal.includes("付费")), "计划缺少市场或付费验证");
    assert((await page.$$(".day-card")).length === 7, "页面没有显示7张行动卡");

    console.log("STAGE5_CHECK day1:start");
    await miniProgram.mockWxMethod("showModal", { confirm: true, cancel: false });
    await page.callMethod("onStartDay1");
    await sleep(200);
    storedSession = await miniProgram.callWxMethod("getStorageSync", SESSION_KEY);
    const storedPlan = await miniProgram.callWxMethod("getStorageSync", PLAN_KEY);
    assert(storedSession.behavior.day1Started === true, "没有记录Day 1已开始");
    assert(storedSession.behavior.day1RouteId === "B", "Day 1路线记录不一致");
    assert(storedPlan.day1Started === true, "计划没有保存Day 1开始状态");
    assert((await page.data("day1Started")) === true, "页面没有显示Day 1已开始");
    await miniProgram.restoreWxMethod("showModal");

    if (screenshotDir) {
      const planScreenshot = path.join(screenshotDir, "02-stage5a-plan.png");
      await miniProgram.screenshot({ path: planScreenshot });
      assert(fs.existsSync(planScreenshot), "7天计划截图未生成");
    }

    console.log("STAGE5_CHECK reselect:start");
    await page.callMethod("onBackToRoutes");
    await sleep(1800);
    page = await miniProgram.currentPage();
    assert(page.path === "pages/report/index", "重新选择路线没有返回报告页");
    assert((await page.data("mode")) === "fit", "重新选择路线没有返回适配结果");

    assert(exceptions.length === 0, `运行期间出现异常：${JSON.stringify(exceptions)}`);
    assert(errorLogs.length === 0, `运行期间出现console error：${JSON.stringify(errorLogs)}`);
    console.log(JSON.stringify({
      success: true,
      conditionsPersisted: true,
      selectionLockedBeforeFit: true,
      routeResults: results,
      internalScoreHidden: true,
      selectedRouteId: plan.selectedRouteId,
      planSource: plan.source,
      planDayCount: plan.days.length,
      containsPaidValidation: true,
      day1StartPersisted: true,
      routeReselectionNavigation: true,
      exceptions: 0,
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
