const assert = require("assert");
const { DEMO_DATA, SAMPLE_ANSWERS } = require("../../../miniprogram/utils/demoData");
const { QUESTIONS } = require("../../../miniprogram/utils/questions");
const { extractEvidence, generatePlan, runAnalysis } = require("../analysis");
const {
  AUTOMATIC_RETRY_COUNT,
  getConfig,
  resolveEndpoint,
  supportsJsonObject,
} = require("../bailianClient");
const { snakeToCamel } = require("../caseConverter");
const { buildFixedPlan } = require("../../../miniprogram/utils/fixedPlan");
const { calculateRouteStartupFit } = require("../../../miniprogram/utils/startupFitRules");
const { describeAnalysisError } = require("../../../miniprogram/utils/analysisService");
const {
  normalizeEvidence,
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
  assert.strictEqual(AUTOMATIC_RETRY_COUNT, 2);
  assert.strictEqual(getConfig().timeoutMs, 18000);
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

  const fitRoute = {
    routeId: "A",
    routeName: "测试路线",
    targetAudience: "目标用户",
    minValidationAction: "完成一次目标用户访谈",
    launchRequirements: {
      firstRevenueCycle: "1—3个月",
      firstRevenueAmountRange: "100—1000元",
      minimumWeeklyTime: "5—7小时",
      minimumValidationBudget: "0—500元",
      firstValidationUsers: { count: "3—5人", channel: "目标社群" },
    },
  };
  const fitConditions = {
    incomeFloor: {
      latestFirstRevenue: "3个月内",
      minimumMeaningfulAmount: "100—1000元",
    },
    weeklyAvailableTime: "7—14小时",
    reachableUsersByRoute: { A: "6—20人" },
    validationResources: { budget: "500元以内", supplementMethod: "愿意花钱" },
  };
  const scoreEightFit = calculateRouteStartupFit(clone(fitRoute), clone(fitConditions));
  assert.strictEqual(scoreEightFit.result, "优先验证");

  const scoreSevenConditions = clone(fitConditions);
  scoreSevenConditions.validationResources.budget = "0元";
  const scoreSevenFit = calculateRouteStartupFit(clone(fitRoute), scoreSevenConditions);
  assert.deepStrictEqual(scoreSevenFit.dimensions.map((item) => item.internalScore), [2, 2, 2, 1]);
  assert.strictEqual(scoreSevenFit.result, "优先验证");
  assert.match(scoreSevenFit.conclusion, /Demo保守启动门槛假设/);

  const scoreSixConditions = clone(scoreSevenConditions);
  scoreSixConditions.reachableUsersByRoute.A = "1—5人";
  assert.strictEqual(
    calculateRouteStartupFit(clone(fitRoute), scoreSixConditions).result,
    "补足后验证",
  );

  const zeroScoreConditions = clone(fitConditions);
  zeroScoreConditions.validationResources = { budget: "0元", supplementMethod: "更愿意投入时间" };
  assert.strictEqual(
    calculateRouteStartupFit(clone(fitRoute), zeroScoreConditions).result,
    "暂缓",
  );

  const pendingFitRoute = clone(fitRoute);
  pendingFitRoute.launchRequirements.minimumWeeklyTime = "待验证";
  assert.strictEqual(
    calculateRouteStartupFit(pendingFitRoute, clone(fitConditions)).result,
    "待验证",
  );

  assert.throws(() => validateRoutes({
    routes: baseRoutes().slice(0, 2),
    routeDifferentiation: "不同",
  }, answerItems), /正好包含3条路线/);

  const emptyEvidence = clone(DEMO_DATA.evidence);
  emptyEvidence.flowEvidence = [];
  assert.throws(() => validateEvidence(emptyEvidence, answerItems), /至少包含1条证据/);

  const repairedEvidence = normalizeEvidence({
    flowEvidence: [{
      claim: "喜欢长时间整理AI教程",
      sourceAnswerId: "Q2",
      sourceQuote: "这是一段被改写的引用",
      evidenceType: "事实",
    }],
    strengthEvidence: [],
    marketInitialSignals: {},
    background: {},
    evidenceSufficiency: { flow: "较高", strength: "一般" },
  }, answerItems);
  assert.doesNotThrow(() => validateEvidence(repairedEvidence, answerItems));
  assert.strictEqual(repairedEvidence.flowEvidence[0].sourceQuote, SAMPLE_ANSWERS.Q2);
  assert.strictEqual(repairedEvidence.flowEvidence[0].evidenceType, "AI推测");
  assert.strictEqual(repairedEvidence.strengthEvidence[0].sourceAnswerId, "Q10");
  assert.strictEqual(repairedEvidence.marketInitialSignals.targetAudience, SAMPLE_ANSWERS.Q15);
  assert.strictEqual(repairedEvidence.background.weeklyAvailableTime, "7—14小时");
  assert.strictEqual(repairedEvidence.evidenceSufficiency.flow, "高");
  assert.strictEqual(repairedEvidence.evidenceSufficiency.strength, "中");

  const shortQuoteEvidence = normalizeEvidence({
    flowEvidence: [{
      claim: "短回答",
      sourceAnswerId: "Q2",
      sourceQuote: "我",
      evidenceType: "用户事实",
    }],
    strengthEvidence: [],
  }, answerItems);
  assert.doesNotThrow(() => validateEvidence(shortQuoteEvidence, answerItems));

  const schemaFailure = new Error("flowEvidence[0].sourceQuote不是用户原文");
  schemaFailure.code = "AI_SCHEMA_INVALID";
  const fallbackEvidenceResult = await extractEvidence(
    { answerItems },
    async () => { throw schemaFailure; },
  );
  assert.strictEqual(fallbackEvidenceResult.aiMeta.fallback, "direct_answer_evidence");
  assert.strictEqual(fallbackEvidenceResult.evidence.flowEvidence[0].sourceAnswerId, "Q2");
  assert.doesNotThrow(() => validateEvidence(fallbackEvidenceResult.evidence, answerItems));

  const errorDescription = describeAnalysisError({
    code: "AI_SCHEMA_INVALID",
    details: "flowEvidence[0].sourceQuote不是用户原文",
    retryable: true,
  }, "提取心流与优势证据");
  assert.strictEqual(errorDescription.stage, "提取心流与优势证据");
  assert.match(errorDescription.reason, /心流证据\[0\]\.原文引用无法对应到你的原回答/);

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

  const duplicatedRequirementsMarket = {
    routes: DEMO_DATA.routes.map((route) => ({
      routeId: route.routeId,
      marketOpportunity: clone(route.marketOpportunity),
      launchRequirements: clone(DEMO_DATA.routes[0].launchRequirements),
    })),
  };
  duplicatedRequirementsMarket.routes.forEach((route, index) => {
    route.launchRequirements.firstValidationUsers.channel = `路线${index + 1}渠道`;
  });
  assert.throws(
    () => validateMarket(duplicatedRequirementsMarket, ["A", "B", "C"]),
    /可比较launchRequirements组合必须各不相同/,
  );

  const pendingRequirementsMarket = {
    routes: DEMO_DATA.routes.map((route) => ({
      routeId: route.routeId,
      marketOpportunity: clone(route.marketOpportunity),
      launchRequirements: clone(route.launchRequirements),
    })),
  };
  pendingRequirementsMarket.routes[0].launchRequirements.minimumWeeklyTime = "待验证";
  assert.throws(
    () => validateMarket(pendingRequirementsMarket, ["A", "B", "C"]),
    /不能使用待验证/,
  );

  const invalidPlan = clone(DEMO_DATA.plan);
  invalidPlan.days = invalidPlan.days.slice(0, 6);
  assert.throws(
    () => validatePlan(invalidPlan, clone(DEMO_DATA.session.startupConditions)),
    /正好包含Day 1—Day 7/,
  );

  const tooLongPlan = clone(DEMO_DATA.plan);
  tooLongPlan.days[0].estimatedTime = "90分钟";
  assert.throws(
    () => validatePlan(tooLongPlan, clone(DEMO_DATA.session.startupConditions)),
    /单日预计用时不能超过60分钟/,
  );

  const noUserValidationPlan = clone(DEMO_DATA.plan);
  noUserValidationPlan.days = noUserValidationPlan.days.map((day) => ({
    ...day,
    goal: "整理已有资料",
    minimumAction: "整理一份已有资料清单",
    completionEvidence: "一份资料清单",
  }));
  assert.throws(
    () => validatePlan(noUserValidationPlan, clone(DEMO_DATA.session.startupConditions)),
    /缺少真实用户或市场验证/,
  );

  const noPaymentValidationPlan = clone(DEMO_DATA.plan);
  noPaymentValidationPlan.days = noPaymentValidationPlan.days.map((day) => ({
    ...day,
    goal: day.goal.replace(/付费|报价|购买|预售|成交|支付|价格/g, "商业"),
    minimumAction: day.minimumAction.replace(/付费|报价|购买|预售|成交|支付|价格/g, "商业"),
    completionEvidence: day.completionEvidence.replace(/付费|报价|购买|预售|成交|支付|价格/g, "商业"),
  }));
  assert.throws(
    () => validatePlan(noPaymentValidationPlan, clone(DEMO_DATA.session.startupConditions)),
    /缺少付费信号验证/,
  );

  const missingBoundaryPlan = clone(DEMO_DATA.plan);
  missingBoundaryPlan.planNote = "这是一个7天行动计划。";
  assert.throws(
    () => validatePlan(missingBoundaryPlan, clone(DEMO_DATA.session.startupConditions)),
    /planNote必须说明/,
  );

  const lowTimeConditions = clone(DEMO_DATA.session.startupConditions);
  lowTimeConditions.weeklyAvailableTime = "少于3小时";
  const weeklyOverflowPlan = clone(DEMO_DATA.plan);
  weeklyOverflowPlan.days.forEach((day) => {
    day.estimatedTime = "30分钟";
  });
  assert.throws(
    () => validatePlan(weeklyOverflowPlan, lowTimeConditions),
    /超过用户每周可投入上限/,
  );

  const lowTimeFixedPlan = buildFixedPlan(clone(DEMO_DATA.routes[0]), lowTimeConditions);
  assert.doesNotThrow(() => validatePlan(lowTimeFixedPlan, lowTimeConditions));
  const lowTimeTotalMaximum = lowTimeFixedPlan.days.reduce((sum, day) => {
    const minutes = day.estimatedTime.match(/\d+/g).map(Number);
    return sum + minutes[minutes.length - 1];
  }, 0);
  assert.ok(lowTimeTotalMaximum <= 180);

  console.log(JSON.stringify({
    success: true,
    defaultModel: result.aiMeta[0].model,
    structuredOutputNative: supportsJsonObject(result.aiMeta[0].model),
    evidenceValidated: true,
    routeCount: result.routes.length,
    marketFieldsPerRoute: 5,
    planDayCount: planResult.plan.days.length,
    snakeToCamelValidated: true,
    incompleteEvidenceRepaired: true,
    invalidSchemaRejected: true,
    startupFitThresholdsValidated: true,
    planTimeAndActionConstraintsValidated: true,
    lowTimeFallbackValidated: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
