const automator = require(process.env.MINIPROGRAM_AUTOMATOR_PATH);

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
    const page = await miniProgram.reLaunch("/pages/index/index");
    const button = await page.$(".secondary-button");
    if (!button) throw new Error("首页找不到示例数据按钮");
    const buttonInfo = {
      text: await button.text(),
      size: await button.size(),
      offset: await button.offset(),
    };
    await button.tap();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const current = await miniProgram.currentPage();
    const session = await miniProgram.callWxMethod("getStorageSync", "opc_mvp_session");
    console.log(JSON.stringify({
      buttonInfo,
      currentPath: current.path,
      demoMode: session && session.demoMode,
      answerCount: session && session.answers ? Object.keys(session.answers).length : 0,
      exceptions,
      consoleErrors: errors,
    }, null, 2));
  } finally {
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
