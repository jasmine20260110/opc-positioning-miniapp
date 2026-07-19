const assert = require("assert");
const { DEMO_DATA } = require("../miniprogram/utils/demoData");

const automatorPath = process.env.MINIPROGRAM_AUTOMATOR_PATH;
const wsEndpoint = process.env.WECHAT_AUTOMATION_WS;

if (!automatorPath || !wsEndpoint) {
  throw new Error("缺少环境变量：MINIPROGRAM_AUTOMATOR_PATH、WECHAT_AUTOMATION_WS");
}

const automator = require(automatorPath);
const LIVE_RESULT_KEY = "opc_stage5_live_result";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const miniProgram = await automator.connect({ wsEndpoint });
  try {
    await miniProgram.callWxMethod("removeStorageSync", LIVE_RESULT_KEY);
    console.log("STAGE5_LIVE generatePlan:started (fictional sample route)");
    const started = await miniProgram.evaluate((storageKey, payload) => {
      wx.cloud.callFunction({
        name: "opcApi",
        data: { action: "generatePlan", payload },
      }).then((cloudResponse) => {
        wx.setStorageSync(storageKey, cloudResponse.result || {
          ok: false,
          error: { code: "NO_CLOUD_RESULT", message: "云函数没有返回结果" },
        });
      }).catch((error) => {
        wx.setStorageSync(storageKey, {
          ok: false,
          error: {
            code: "CLOUD_CALL_REJECTED",
            message: String(error && error.errMsg ? error.errMsg : error).slice(0, 300),
          },
        });
      });
      return true;
    }, LIVE_RESULT_KEY, {
      selectedRoute: DEMO_DATA.routes[0],
      startupConditions: DEMO_DATA.session.startupConditions,
    });
    assert.strictEqual(started, true, "未能发起generatePlan调用");

    const deadline = Date.now() + 70000;
    let response;
    while (Date.now() < deadline) {
      await sleep(5000);
      try {
        response = await miniProgram.callWxMethod("getStorageSync", LIVE_RESULT_KEY);
        if (response && typeof response.ok === "boolean") break;
      } catch (error) {
        // 开发者工具忙碌时可能单次读取超时，继续下一轮。
      }
    }

    assert(response && typeof response.ok === "boolean", "70秒内没有收到generatePlan结果");
    assert(response.ok, response.error
      ? `${response.error.code}: ${response.error.message}`
      : "generatePlan失败");

    const { plan, aiMeta } = response.data;
    assert.strictEqual(plan.source, "ai_generated");
    assert.strictEqual(plan.selectedRouteId, "A");
    assert.strictEqual(plan.days.length, 7);
    assert(plan.days.every((day, index) => (
      day.day === index + 1
      && day.goal
      && day.minimumAction
      && day.estimatedTime
      && day.completionEvidence
      && day.fallback
    )));
    assert(plan.days.some((day) => /付费|报价|购买/.test(`${day.goal}${day.minimumAction}`)));
    assert.strictEqual(aiMeta.model, "deepseek-v4-flash");

    console.log(JSON.stringify({
      success: true,
      model: aiMeta.model,
      attempts: aiMeta.attempts,
      planSource: plan.source,
      selectedRouteId: plan.selectedRouteId,
      planDayCount: plan.days.length,
      containsPaidValidation: true,
    }, null, 2));
  } finally {
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
