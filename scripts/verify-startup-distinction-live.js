const assert = require("assert");
const { DEMO_DATA, SAMPLE_ANSWERS } = require("../miniprogram/utils/demoData");
const { QUESTIONS } = require("../miniprogram/utils/questions");
const { calculateStartupFit } = require("../miniprogram/utils/startupFitRules");
const { validateMarket } = require("../cloudfunctions/opcApi/validators");

const automatorPath = process.env.MINIPROGRAM_AUTOMATOR_PATH;
const wsEndpoint = process.env.WECHAT_AUTOMATION_WS;

if (!automatorPath || !wsEndpoint) {
  throw new Error("缺少环境变量：MINIPROGRAM_AUTOMATOR_PATH、WECHAT_AUTOMATION_WS");
}

const automator = require(automatorPath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function requirementSignature(route) {
  const requirements = route.launchRequirements;
  return [
    requirements.firstRevenueCycle,
    requirements.firstRevenueAmountRange,
    requirements.minimumWeeklyTime,
    requirements.minimumValidationBudget,
    requirements.firstValidationUsers.count,
    requirements.firstValidationUsers.channel,
  ].join("|");
}

async function main() {
  const miniProgram = await automator.connect({ wsEndpoint });
  const storageKey = `opc_startup_distinction_${Date.now()}`;

  try {
    const answerItems = QUESTIONS.map((question) => ({
      questionId: question.questionId,
      questionText: question.questionText,
      intent: question.intent,
      answer: SAMPLE_ANSWERS[question.questionId],
    }));
    const routes = DEMO_DATA.routes.map((route) => {
      const copy = clone(route);
      delete copy.marketOpportunity;
      delete copy.launchRequirements;
      delete copy.startupFit;
      return copy;
    });

    await miniProgram.callWxMethod("removeStorageSync", storageKey);
    await miniProgram.evaluate((request) => {
      wx.cloud.callFunction({
        name: "opcApi",
        data: {
          action: "analyzeMarket",
          payload: request.payload,
        },
      }).then((response) => {
        wx.setStorageSync(request.storageKey, response.result);
      }).catch((error) => {
        wx.setStorageSync(request.storageKey, {
          ok: false,
          error: { code: "CLOUD_CALL_REJECTED", message: String(error && error.errMsg ? error.errMsg : error) },
        });
      });
      return true;
    }, {
      storageKey,
      payload: {
        answerItems,
        evidence: clone(DEMO_DATA.evidence),
        routes,
        routeDifferentiation: "三条路线的目标用户、交付方式和商业化路径不同。",
      },
    });

    const deadline = Date.now() + 70000;
    let response;
    while (Date.now() < deadline) {
      response = await miniProgram.callWxMethod("getStorageSync", storageKey);
      if (response && typeof response.ok === "boolean") break;
      await sleep(1500);
    }

    assert(response && response.ok, response && response.error
      ? `${response.error.code}: ${response.error.message}`
      : "云函数在70秒内没有返回");
    validateMarket({ routes: response.data.routes }, ["A", "B", "C"]);

    const signatures = response.data.routes.map(requirementSignature);
    assert(new Set(signatures).size >= 2, "真实AI仍返回完全相同的启动要求");

    const fittedRoutes = calculateStartupFit(
      response.data.routes,
      clone(DEMO_DATA.session.startupConditions),
    );
    assert.strictEqual(new Set(fittedRoutes.map((route) => route.startupFit.conclusion)).size, 3);
    assert.strictEqual(new Set(fittedRoutes.map((route) => route.startupFit.maxGap)).size, 3);
    assert.strictEqual(new Set(fittedRoutes.map((route) => route.startupFit.recommendation)).size, 3);

    console.log(JSON.stringify({
      success: true,
      model: response.data.aiMeta.model,
      attempts: response.data.aiMeta.attempts,
      uniqueRequirementGroups: new Set(signatures).size,
      fitResults: fittedRoutes.map((route) => route.startupFit.result),
      conclusionsDifferentiated: true,
      maxGapsDifferentiated: true,
      recommendationsDifferentiated: true,
    }, null, 2));
  } finally {
    await miniProgram.callWxMethod("removeStorageSync", storageKey).catch(() => {});
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
