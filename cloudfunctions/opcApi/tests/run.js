const assert = require("assert");
const { DEMO_DATA, SAMPLE_ANSWERS } = require("../../../miniprogram/utils/demoData");
const { QUESTIONS } = require("../../../miniprogram/utils/questions");
const { generatePlan, runAnalysis } = require("../analysis");
const { getConfig, resolveEndpoint, supportsJsonObject } = require("../bailianClient");
const { snakeToCamel } = require("../caseConverter");
const {
  validateEvidence,
  validateMarket,
  validatePlan,
  validateRoutes,
} = require("../validators");

process.env.DASHSCOPE_API_KEY = "local-test-placeholder";
process.env.DASHSCOPE_MODEL = "deepseek-v4-flash";

const answerItems = QUESTIONS.map((question) => ({
  questionId: question.questionId,
  questionText: question.questionText,
  intent: question.intent,
  answer: SAMPLE_ANSWERS[question.questionId],
}));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseRoutes() {
  return DEMO_DATA.routes.map((route) => {
    const copy = clone(route);
    delete copy.marketOpportunity;
    delete copy.launchRequirements;
    delete copy.startupFit;
    return copy;
  });
}

async function fakeCaller(options) {
  let data;
  if (options.label === "extractEvidence") {
    data = clone(DEMO_DATA.evidence);
  } else if (options.label === "generateRoutes") {
    data = {
      routes: baseRoutes(),
      routeDifferentiation: "目标用户、交付形态和商业化路径不同。",
    };
  } else if (options.label === "analyzeMarket") {
    data = {
      routes: DEMO_DATA.routes.map((route) => ({
        routeId: route.routeId,
        marketOpportunity: clone(route.marketOpportunity),
        launchRequirements: clone(route.launchRequirements),
      })),
    };
  } else if (options.label === "generatePlan") {
    data = clone(DEMO_DATA.plan);
  } else {
    throw new Error(`unknown label:${options.label}`);
  }
  return {
    data: options.validate(data),
    meta: {
      label: options.label,
      model: options.model,
      attempts: 1,
      durationMs: 1,
      usage: null,
    },
  };
}

async function main() {
  assert.strictEqual(
    resolveEndpoint("https://dashscope.aliyuncs.com/compatible-mode/v1"),
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  );
  assert.strictEqual(supportsJsonObject("deepseek-v4-flash"), false);
  assert.strictEqual(supportsJsonObject("qwen-flash"), true);
  assert.strictEqual(getConfig().timeoutMs, 25000);
  assert.deepStrictEqual(snakeToCamel({ route_id: "A", nested_value: { max_gap: "x" } }), {
    routeId: "A",
    nestedValue: { maxGap: "x" },
  });

  const result = await runAnalysis({ answerItems }, fakeCaller);
  assert.strictEqual(result.routes.length, 3);
  assert.deepStrictEqual(result.routes.map((route) => route.routeId), ["A", "B", "C"]);
  assert.ok(result.evidence.flowEvidence.length > 0);
  assert.ok(result.routes.every((route) => route.marketOpportunity && route.launchRequirements));
  assert.ok(result.aiMeta.every((meta) => meta.model === "deepseek-v4-flash"));

  const planResult = await generatePlan({
    selectedRoute: clone(DEMO_DATA.routes[0]),
    startupConditions: clone(DEMO_DATA.session.startupConditions),
  }, fakeCaller);
  assert.strictEqual(planResult.plan.source, "ai_generated");
  assert.strictEqual(planResult.plan.selectedRouteId, "A");
  assert.strictEqual(planResult.plan.days.length, 7);
  assert.ok(planResult.plan.days.some((day) => /付费/.test(`${day.goal}${day.minimumAction}`)));

  assert.throws(() => validateRoutes({
    routes: baseRoutes().slice(0, 2),
    routeDifferentiation: "不同",
  }, answerItems), /正好包含3条路线/);

  const emptyEvidence = clone(DEMO_DATA.evidence);
  emptyEvidence.flowEvidence = [];
  assert.throws(() => validateEvidence(emptyEvidence, answerItems), /至少包含1条证据/);

  const duplicateRoutes = baseRoutes();
  duplicateRoutes[1].routeName = duplicateRoutes[0].routeName;
  assert.throws(() => validateRoutes({
    routes: duplicateRoutes,
    routeDifferentiation: "不同",
  }, answerItems), /路线名称必须不同/);

  const invalidMarket = {
    routes: DEMO_DATA.routes.map((route) => ({
      routeId: route.routeId,
      marketOpportunity: clone(route.marketOpportunity),
      launchRequirements: clone(route.launchRequirements),
    })),
  };
  invalidMarket.routes[0].marketOpportunity.demandEvidenceStrength.result = "非常强";
  assert.throws(() => validateMarket(invalidMarket, ["A", "B", "C"]), /demandEvidenceStrength.result无效/);

  const invalidPlan = clone(DEMO_DATA.plan);
  invalidPlan.days = invalidPlan.days.slice(0, 6);
  assert.throws(() => validatePlan(invalidPlan), /正好包含Day 1—Day 7/);

  console.log(JSON.stringify({
    success: true,
    defaultModel: result.aiMeta[0].model,
    structuredOutputNative: supportsJsonObject(result.aiMeta[0].model),
    evidenceValidated: true,
    routeCount: result.routes.length,
    marketFieldsPerRoute: 5,
    planDayCount: planResult.plan.days.length,
    snakeToCamelValidated: true,
    invalidSchemaRejected: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
