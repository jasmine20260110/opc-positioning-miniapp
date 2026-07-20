const assert = require("assert");
const { DEMO_DATA, SAMPLE_ANSWERS } = require("../miniprogram/utils/demoData");
const {
  buildAnalysisResult,
  buildAnswerItems,
  callAnalysisAction,
} = require("../miniprogram/utils/analysisService");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const session = {
  sessionId: "stage4-local-test",
  status: "in_progress",
  currentStep: "analyzing",
  currentQuestionIndex: 19,
  answers: clone(SAMPLE_ANSWERS),
  context: {
    ageStage: SAMPLE_ANSWERS.Q18,
    careerStatus: SAMPLE_ANSWERS.Q19,
    dailyAvailableTime: SAMPLE_ANSWERS.Q20,
    weeklyAvailableTime: "7—14小时",
  },
  startupConditions: { weeklyAvailableTime: "7—14小时" },
};

const baseRoutes = DEMO_DATA.routes.map((route) => {
  const copy = clone(route);
  delete copy.marketOpportunity;
  delete copy.launchRequirements;
  delete copy.startupFit;
  return copy;
});

const responses = {
  extractEvidence: {
    evidence: clone(DEMO_DATA.evidence),
    aiMeta: { label: "extractEvidence", model: "deepseek-v4-flash", attempts: 1 },
  },
  generateRoutes: {
    routes: baseRoutes,
    routeDifferentiation: "三条路线的目标用户和交付方式不同。",
    aiMeta: { label: "generateRoutes", model: "deepseek-v4-flash", attempts: 1 },
  },
  analyzeMarket: {
    routes: DEMO_DATA.routes.map((route, index) => ({
      ...baseRoutes[index],
      marketOpportunity: clone(route.marketOpportunity),
      launchRequirements: clone(route.launchRequirements),
    })),
    aiMeta: { label: "analyzeMarket", model: "deepseek-v4-flash", attempts: 1 },
  },
};

global.wx = {
  cloud: {
    async callFunction({ data }) {
      return { result: { ok: true, data: clone(responses[data.action]) } };
    },
  },
};

async function main() {
  const answerItems = buildAnswerItems(session);
  assert.strictEqual(answerItems.length, 20);
  const evidenceResult = await callAnalysisAction("extractEvidence", { answerItems });
  const routeResult = await callAnalysisAction("generateRoutes", {
    answerItems,
    evidence: evidenceResult.evidence,
  });
  const marketResult = await callAnalysisAction("analyzeMarket", {
    answerItems,
    evidence: evidenceResult.evidence,
    routes: routeResult.routes,
  });
  const result = buildAnalysisResult({
    session,
    answerItems,
    evidence: evidenceResult.evidence,
    routes: marketResult.routes,
    routeDifferentiation: routeResult.routeDifferentiation,
    aiMeta: [evidenceResult.aiMeta, routeResult.aiMeta, marketResult.aiMeta],
  });

  assert.strictEqual(result.demoMode, false);
  assert.strictEqual(result.answers.items.length, 20);
  assert.strictEqual(result.routes.length, 3);
  assert.ok(result.routes.every((route) => Object.keys(route.marketOpportunity).length === 5));
  assert.ok(result.routes.every((route) => !route.startupFit));
  assert.ok(result.aiMeta.every((meta) => meta.model === "deepseek-v4-flash"));
  assert.strictEqual(result.evidence.background.weeklyAvailableTime, "7—14小时");

  global.wx.cloud.callFunction = async () => ({
    result: {
      ok: false,
      error: { code: "AI_TIMEOUT", message: "AI分析超时，请重试或返回首页。", retryable: true },
    },
  });
  await assert.rejects(
    () => callAnalysisAction("extractEvidence", { answerItems }),
    (error) => error.code === "AI_TIMEOUT" && error.retryable === true,
  );

  console.log(JSON.stringify({
    success: true,
    answerCount: result.answers.items.length,
    routeCount: result.routes.length,
    marketFieldsPerRoute: 5,
    defaultModel: result.aiMeta[0].model,
    aiFailureHandled: true,
    demoMode: result.demoMode,
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
