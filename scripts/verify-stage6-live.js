const assert = require("assert");
const { QUESTIONS } = require("../miniprogram/utils/questions");
const { calculateStartupFit } = require("../miniprogram/utils/startupFitRules");
const { CONTRACT_VERSION, MARKET_FIELDS, validateP0DemoData } = require("../miniprogram/utils/dataContract");
const {
  validateAnswerItems,
  validateEvidence,
  validateMarket,
  validatePlan,
  validateRoutes,
} = require("../cloudfunctions/opcApi/validators");
const { SCENARIOS } = require("./fixtures/stage6-scenarios");

const automatorPath = process.env.MINIPROGRAM_AUTOMATOR_PATH;
const wsEndpoint = process.env.WECHAT_AUTOMATION_WS;

if (!automatorPath || !wsEndpoint) {
  throw new Error("缺少环境变量：MINIPROGRAM_AUTOMATOR_PATH、WECHAT_AUTOMATION_WS");
}

const automator = require(automatorPath);

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function buildAnswerItems(answers) {
  return QUESTIONS.map((question) => ({
    questionId: question.questionId,
    questionText: question.questionText,
    intent: question.intent,
    answer: answers[question.questionId],
  }));
}

async function callCloud(miniProgram, scenarioId, action, payload) {
  const storageKey = `opc_stage6_${scenarioId}_${action}_${Date.now()}`;
  await miniProgram.callWxMethod("removeStorageSync", storageKey);
  const started = await miniProgram.evaluate((key, cloudAction, cloudPayload) => {
    wx.cloud.callFunction({
      name: "opcApi",
      data: { action: cloudAction, payload: cloudPayload },
    }).then((cloudResponse) => {
      wx.setStorageSync(key, cloudResponse.result || {
        ok: false,
        error: { code: "NO_CLOUD_RESULT", message: "云函数没有返回结果" },
      });
    }).catch((error) => {
      wx.setStorageSync(key, {
        ok: false,
        error: {
          code: "CLOUD_CALL_REJECTED",
          message: String(error && error.errMsg ? error.errMsg : error).slice(0, 300),
        },
      });
    });
    return true;
  }, storageKey, action, payload);
  assert.strictEqual(started, true, `${scenarioId}.${action}未发起`);

  const deadline = Date.now() + 70000;
  let response;
  while (Date.now() < deadline) {
    await sleep(3000);
    try {
      response = await miniProgram.callWxMethod("getStorageSync", storageKey);
      if (response && typeof response.ok === "boolean") break;
    } catch (error) {
      // 开发者工具忙碌时允许一次读取失败，继续轮询。
    }
  }
  await miniProgram.callWxMethod("removeStorageSync", storageKey).catch(() => {});
  assert(response && typeof response.ok === "boolean", `${scenarioId}.${action}在70秒内没有返回`);
  assert(response.ok, response.error
    ? `${scenarioId}.${action}失败 ${response.error.code}: ${response.error.message}${response.error.details ? ` (${response.error.details})` : ""}`
    : `${scenarioId}.${action}失败`);
  return response.data;
}

function chooseRoute(routes) {
  return routes.find((route) => route.startupFit.result === "优先验证")
    || routes.find((route) => route.startupFit.result === "补足后验证")
    || routes[0];
}

async function verifyScenario(miniProgram, scenario) {
  const answerItems = validateAnswerItems(buildAnswerItems(scenario.answers));
  console.log(`STAGE6 ${scenario.id} evidence:start`);
  const evidenceResult = await callCloud(miniProgram, scenario.id, "extractEvidence", { answerItems });
  validateEvidence(evidenceResult.evidence, answerItems);
  console.log(`STAGE6 ${scenario.id} evidence:pass`);

  const routeResult = await callCloud(miniProgram, scenario.id, "generateRoutes", {
    answerItems,
    evidence: evidenceResult.evidence,
  });
  validateRoutes(routeResult, answerItems);
  console.log(`STAGE6 ${scenario.id} routes:pass`);

  const marketResult = await callCloud(miniProgram, scenario.id, "analyzeMarket", {
    answerItems,
    evidence: evidenceResult.evidence,
    routes: routeResult.routes,
    routeDifferentiation: routeResult.routeDifferentiation,
  });
  validateMarket({ routes: marketResult.routes }, ["A", "B", "C"]);
  assert(marketResult.routes.every((route) => (
    Object.keys(route.marketOpportunity).length === MARKET_FIELDS.length
  )));
  console.log(`STAGE6 ${scenario.id} market:pass`);

  const fittedRoutes = calculateStartupFit(marketResult.routes, scenario.startupConditions);
  assert(fittedRoutes.every((route) => route.startupFit.dimensions.length === 4));
  const selectedRoute = chooseRoute(fittedRoutes);

  const planResult = await callCloud(miniProgram, scenario.id, "generatePlan", {
    selectedRoute,
    startupConditions: scenario.startupConditions,
  });
  validatePlan(planResult.plan);
  assert.strictEqual(planResult.plan.selectedRouteId, selectedRoute.routeId);
  console.log(`STAGE6 ${scenario.id} plan:pass`);

  const contractResult = validateP0DemoData({
    contractVersion: CONTRACT_VERSION,
    demoMode: false,
    session: {
      sessionId: `stage6-${scenario.id}`,
      currentStep: "plan",
      selectedRouteId: selectedRoute.routeId,
      startupConditions: scenario.startupConditions,
    },
    answers: { sessionId: `stage6-${scenario.id}`, items: answerItems },
    evidence: evidenceResult.evidence,
    routes: fittedRoutes,
    plan: planResult.plan,
  });
  assert(contractResult.valid, `${scenario.id}契约失败：${contractResult.errors.join("；")}`);

  const models = [
    evidenceResult.aiMeta.model,
    routeResult.aiMeta.model,
    marketResult.aiMeta.model,
    planResult.aiMeta.model,
  ];
  assert(models.every((model) => model === "deepseek-v4-flash"));

  return {
    id: scenario.id,
    name: scenario.name,
    evidenceCount: evidenceResult.evidence.flowEvidence.length
      + evidenceResult.evidence.strengthEvidence.length,
    routeCount: fittedRoutes.length,
    marketFieldCount: fittedRoutes.reduce(
      (count, route) => count + Object.keys(route.marketOpportunity).length,
      0,
    ),
    fitResults: fittedRoutes.map((route) => route.startupFit.result),
    selectedRouteId: selectedRoute.routeId,
    planDayCount: planResult.plan.days.length,
    model: planResult.aiMeta.model,
  };
}

async function main() {
  const miniProgram = await automator.connect({ wsEndpoint });
  try {
    const summaries = [];
    for (const scenario of SCENARIOS) {
      summaries.push(await verifyScenario(miniProgram, scenario));
    }
    console.log(JSON.stringify({ success: true, scenarioCount: summaries.length, summaries }, null, 2));
  } finally {
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
