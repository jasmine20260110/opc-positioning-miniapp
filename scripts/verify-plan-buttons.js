const fs = require("fs");
const automator = require(process.env.MINIPROGRAM_AUTOMATOR_PATH);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const miniProgram = await automator.connect({
    wsEndpoint: process.env.WECHAT_AUTOMATION_WS,
  });
  const screenshotPath = process.env.PLAN_BUTTON_SCREENSHOT;

  try {
    let page = await miniProgram.reLaunch("/pages/report/index?mode=fit");
    assert((await page.data("mode")) === "fit", "没有进入适配结果页");
    await page.callMethod("onSelectRoute", {
      currentTarget: { dataset: { route: "B" } },
    });
    await sleep(1800);
    page = await miniProgram.currentPage();
    assert(page.path === "pages/plan/index", "没有进入计划页");

    await page.callMethod("onStartDay1");
    await sleep(500);
    await miniProgram.screenshot({ path: screenshotPath });
    assert(fs.existsSync(screenshotPath), "弹窗截图没有生成");
    await miniProgram.native().confirmModal();

    await page.callMethod("onBackToRoutes");
    await sleep(1800);
    page = await miniProgram.currentPage();
    assert(page.path === "pages/report/index", "重新选择路线没有跳回报告页");
    assert((await page.data("mode")) === "fit", "没有返回启动适配结果");

    console.log(JSON.stringify({
      success: true,
      modalShown: true,
      modalScreenshot: screenshotPath,
      routeReselectionPath: page.path,
      routeReselectionMode: await page.data("mode"),
    }, null, 2));
  } finally {
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
