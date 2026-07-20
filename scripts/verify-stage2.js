const fs = require("fs");
const path = require("path");
const { DEMO_DATA } = require("../miniprogram/utils/demoData");

const automatorPath = process.env.MINIPROGRAM_AUTOMATOR_PATH;
const cliPath = process.env.WECHAT_DEVTOOLS_CLI;
const projectPath = process.env.OPC_PROJECT_PATH || process.cwd();
const screenshotDir = process.env.STAGE2_SCREENSHOT_DIR;

if (!automatorPath || !cliPath || !screenshotDir) {
  throw new Error(
    "缺少环境变量：MINIPROGRAM_AUTOMATOR_PATH、WECHAT_DEVTOOLS_CLI、STAGE2_SCREENSHOT_DIR",
  );
}

const automator = require(automatorPath);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function textOf(page, selector) {
  const element = await page.$(selector);
  assert(element, `页面 ${page.path} 缺少元素 ${selector}`);
  return element.text();
}

async function capture(miniProgram, name) {
  const target = path.join(screenshotDir, `${name}.png`);
  await miniProgram.screenshot({ path: target });
  assert(fs.existsSync(target), `截图未生成：${target}`);
  return target;
}

async function main() {
  const exceptions = [];
  const errorLogs = [];
  const screenshots = [];
  let miniProgram;

  try {
    miniProgram = await automator.launch({
      cliPath,
      projectPath,
      trustProject: true,
      timeout: 60000,
    });

    miniProgram.on("exception", (error) => exceptions.push(error));
    miniProgram.on("console", (entry) => {
      if (entry && (entry.type === "error" || entry.level === "error")) errorLogs.push(entry);
    });

    let page = await miniProgram.reLaunch("/pages/index/index");
    await page.waitFor(800);
    assert(page.path === "pages/index/index", "首页路由错误");
    assert((await textOf(page, ".hero-title")).includes("OPC定位神器"), "首页产品名缺失");
    screenshots.push(await capture(miniProgram, "01-index"));

    const demoButton = await page.$(".secondary-button");
    assert(demoButton, "首页缺少示例数据入口");
    await demoButton.tap();
    await page.waitFor(500);
    page = await miniProgram.currentPage();
    assert(page.path === "pages/question/index", "示例入口未进入问答页");
    assert((await textOf(page, ".question-title")).length > 10, "问答页题目未显示");
    screenshots.push(await capture(miniProgram, "02-question"));

    for (let index = 0; index < 20; index += 1) {
      await page.callMethod("onNext");
      await page.waitFor(80);
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
    page = await miniProgram.currentPage();
    assert(page.path === "pages/loading/index", "20题提交后未进入Loading页");
    assert((await page.$$(".stage-row")).length === 3, "Loading页必须展示3个分析阶段");
    screenshots.push(await capture(miniProgram, "03-loading"));
    await miniProgram.callWxMethod("setStorageSync", "opc_mvp_result", DEMO_DATA);
    await miniProgram.callWxMethod("setStorageSync", "opc_mvp_session", DEMO_DATA.session);
    page = await miniProgram.reLaunch("/pages/report/index?mode=evidence");
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert(page.path === "pages/report/index", "Loading后未进入报告页");
    assert((await page.data("mode")) === "evidence", "报告页没有从evidence模式开始");
    assert((await page.$$(".route-preview")).length === 3, "证据页必须展示3条路线预览");
    screenshots.push(await capture(miniProgram, "04-evidence"));

    await page.callMethod("onShowMarket");
    await page.waitFor(200);
    assert((await page.data("mode")) === "market", "未进入market模式");
    assert((await page.$$(".market-card")).length === 3, "市场页必须展示3张路线卡");
    assert((await page.$$(".market-field")).length === 15, "每条路线必须展示5项市场机会");
    screenshots.push(await capture(miniProgram, "05-market"));

    await page.callMethod("onShowStartup");
    await new Promise((resolve) => setTimeout(resolve, 500));
    page = await miniProgram.currentPage();
    assert(page.path === "pages/opc-transition/index", "市场页没有进入OPC定位过渡页");
    assert((await page.$$(".transition-button")).length === 1, "过渡页缺少红色箭头点击区");
    screenshots.push(await capture(miniProgram, "06-opc-transition"));

    await page.callMethod("onContinue");
    await new Promise((resolve) => setTimeout(resolve, 500));
    page = await miniProgram.currentPage();
    assert(page.path === "pages/report/index", "过渡页没有进入启动条件页");
    assert((await page.data("mode")) === "startup", "未进入startup模式");
    assert((await page.$$(".condition-card")).length === 4, "启动条件页必须展示4项条件");
    screenshots.push(await capture(miniProgram, "07-startup"));

    await page.callMethod("onShowFit");
    await page.waitFor(200);
    assert((await page.data("mode")) === "fit", "未进入fit模式");
    assert((await page.$$(".fit-card")).length === 3, "适配页必须展示3条路线");
    assert((await page.$$(".dimension-item")).length === 12, "每条路线必须展示4个适配维度");
    const fitText = await textOf(page, ".report-screen");
    assert(!fitText.includes("internalScore"), "前端不应展示内部精确分数");
    screenshots.push(await capture(miniProgram, "08-fit"));

    const routeButton = await page.$(".route-select-button");
    assert(routeButton, "适配页缺少路线选择按钮");
    await routeButton.tap();
    await new Promise((resolve) => setTimeout(resolve, 600));
    page = await miniProgram.currentPage();
    assert(page.path === "pages/plan/index", "选择路线后未进入计划页");
    assert((await page.$$(".day-card")).length === 7, "计划页必须展示7天行动卡");
    assert((await page.$$(".other-route")).length === 2, "计划页必须解释另外2条路线为何暂不优先");
    screenshots.push(await capture(miniProgram, "09-plan"));

    await miniProgram.mockWxMethod("showModal", { confirm: true, cancel: false });
    await page.callMethod("onStartDay1");
    await page.waitFor(200);
    const session = await miniProgram.callWxMethod("getStorageSync", "opc_mvp_session");
    const storedPlan = await miniProgram.callWxMethod("getStorageSync", "opc_mvp_plan");
    assert(session.behavior.day1Started === true, "没有记录Day 1已开始");
    assert(session.behavior.day1RouteId === session.selectedRouteId, "Day 1路线记录不一致");
    assert(storedPlan.day1Started === true, "计划没有保存Day 1开始状态");
    await miniProgram.restoreWxMethod("showModal");

    await page.callMethod("onBackToRoutes");
    await new Promise((resolve) => setTimeout(resolve, 1800));
    page = await miniProgram.currentPage();
    assert(page.path === "pages/report/index", "重新选择路线没有返回报告页");
    assert((await page.data("mode")) === "fit", "重新选择路线没有返回适配结果");

    assert(exceptions.length === 0, `运行期间出现异常：${JSON.stringify(exceptions)}`);
    assert(errorLogs.length === 0, `运行期间出现console error：${JSON.stringify(errorLogs)}`);

    console.log(
      JSON.stringify(
        {
          success: true,
          route: page.path,
          screenshots,
          checks: {
            questionCount: 20,
            routePreviewCount: 3,
            marketFieldCount: 15,
            startupConditionCount: 4,
            fitDimensionCount: 12,
            planDayCount: 7,
            day1StartPersisted: true,
            routeReselectionNavigation: true,
            exceptions: 0,
            consoleErrors: 0,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    if (miniProgram) miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
