const automator = require(process.env.MINIPROGRAM_AUTOMATOR_PATH);

async function main() {
  const miniProgram = await automator.connect({
    wsEndpoint: process.env.WECHAT_AUTOMATION_WS,
  });
  const events = [];
  miniProgram.on("exception", (error) => events.push({ type: "exception", error }));
  miniProgram.on("console", (entry) => events.push({ type: "console", entry }));

  try {
    const page = await miniProgram.reLaunch("/pages/index/index");
    await page.waitFor(500);
    const callResult = await page.callMethod("onUseDemo");
    const paths = [];
    for (const delay of [200, 1000, 3000]) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      const current = await miniProgram.currentPage();
      paths.push({ delay, path: current.path });
    }
    console.log(JSON.stringify({ callResult, paths, events }, null, 2));
  } finally {
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
