const assert = require("assert");
const { SAMPLE_ANSWERS } = require("../miniprogram/utils/demoData");

const automatorPath = process.env.MINIPROGRAM_AUTOMATOR_PATH;
const wsEndpoint = process.env.WECHAT_AUTOMATION_WS;

if (!automatorPath || !wsEndpoint) {
  throw new Error("缺少环境变量：MINIPROGRAM_AUTOMATOR_PATH、WECHAT_AUTOMATION_WS");
}

const automator = require(automatorPath);

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const miniProgram = await automator.connect({ wsEndpoint });
  const exceptions = [];
  miniProgram.on("exception", (error) => exceptions.push(error));

  try {
    console.log("LIVE_CHECK health:start");
    const healthResponse = await miniProgram.evaluate(async () => {
      const response = await wx.cloud.callFunction({
        name: "opcApi",
        data: { action: "health" },
      });
      return response.result;
    });
    assert(healthResponse && healthResponse.ok, "opcApi health调用失败");
    assert.strictEqual(healthResponse.data.configured, true, "opcApi尚未配置API Key");
    assert.strictEqual(healthResponse.data.fastModel, "deepseek-v4-flash");
    assert.strictEqual(healthResponse.data.qualityModel, "deepseek-v4-flash");
    console.log(`LIVE_CHECK health:pass model=${healthResponse.data.qualityModel}`);

    const now = new Date().toISOString();
    const session = {
      sessionId: `stage4-live-${Date.now()}`,
      status: "in_progress",
      currentStep: "analyzing",
      currentQuestionIndex: 19,
      answers: { ...SAMPLE_ANSWERS },
      context: {
        ageStage: SAMPLE_ANSWERS.Q18,
        careerStatus: SAMPLE_ANSWERS.Q19,
        dailyAvailableTime: SAMPLE_ANSWERS.Q20,
        weeklyAvailableTime: "7—14小时",
      },
      startupConditions: { weeklyAvailableTime: "7—14小时" },
      selectedRouteId: null,
      behavior: { day1Started: false },
      createdAt: now,
      updatedAt: now,
    };
    await miniProgram.callWxMethod("setStorageSync", "opc_mvp_session", session);
    await miniProgram.callWxMethod("removeStorageSync", "opc_mvp_result");

    console.log("LIVE_CHECK analysis:start (fictional sample answers)");
    await miniProgram.reLaunch("/pages/loading/index");

    const deadline = Date.now() + 180000;
    let page;
    while (Date.now() < deadline) {
      page = await miniProgram.currentPage();
      if (page.path === "pages/report/index") break;
      if (page.path === "pages/loading/index") {
        const hasError = await page.data("hasError");
        if (hasError) {
          const errorMessage = await page.data("errorMessage");
          throw new Error(`Loading页报告失败：${errorMessage}`);
        }
      }
      await sleep(2000);
    }
    assert(page && page.path === "pages/report/index", "真实AI分析在180秒内未完成");

    const result = await miniProgram.callWxMethod("getStorageSync", "opc_mvp_result");
    assert(result && result.demoMode === false, "结果不是实时AI数据");
    assert(result.evidence.flowEvidence.length > 0, "缺少心流证据");
    assert(result.evidence.strengthEvidence.length > 0, "缺少优势证据");
    assert.strictEqual(result.routes.length, 3, "路线数量不是3条");
    assert(result.routes.every((route) => route.marketOpportunity && route.launchRequirements));
    assert(result.aiMeta.every((meta) => meta.model === "deepseek-v4-flash"));
    assert.strictEqual(exceptions.length, 0, "微信运行时出现异常");

    console.log(JSON.stringify({
      success: true,
      configured: healthResponse.data.configured,
      model: healthResponse.data.qualityModel,
      routeCount: result.routes.length,
      flowEvidenceCount: result.evidence.flowEvidence.length,
      strengthEvidenceCount: result.evidence.strengthEvidence.length,
      marketFieldCount: result.routes.reduce(
        (count, route) => count + Object.keys(route.marketOpportunity).length,
        0,
      ),
      runtimeExceptions: exceptions.length,
    }, null, 2));
  } finally {
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
