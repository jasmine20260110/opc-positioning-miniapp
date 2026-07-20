const { callStructured, getConfig } = require("./bailianClient");
const { EVIDENCE_PROMPT, MARKET_PROMPT, PLAN_PROMPT, ROUTES_PROMPT } = require("./prompts");
const {
  normalizeEvidence,
  validateAnswerItems,
  validateEvidence,
  validateMarket,
  validatePlan,
  validatePlanRequest,
  validateRoutes,
} = require("./validators");

function mergeMarketIntoRoutes(routes, marketRoutes) {
  const marketMap = marketRoutes.reduce((map, route) => {
    map[route.routeId] = route;
    return map;
  }, {});
  return routes.map((route) => ({
    ...route,
    marketOpportunity: marketMap[route.routeId].marketOpportunity,
    launchRequirements: marketMap[route.routeId].launchRequirements,
  }));
}

function buildEvidenceFallback(answerItems, validationError) {
  const answerMap = answerItems.reduce((map, item) => {
    map[item.questionId] = item.answer;
    return map;
  }, {});
  const directEvidence = (questionIds) => questionIds.map((questionId) => ({
    claim: answerMap[questionId],
    sourceAnswerId: questionId,
    sourceQuote: answerMap[questionId],
    evidenceType: "用户事实",
  }));
  const fallback = normalizeEvidence({
    flowEvidence: directEvidence(["Q2", "Q3", "Q4"]),
    strengthEvidence: directEvidence(["Q8", "Q9", "Q10"]),
    marketInitialSignals: {
      targetAudience: answerMap.Q15,
      problem: answerMap.Q16,
      paymentJudgment: answerMap.Q17,
      evidenceType: "用户判断",
    },
    background: {},
    evidenceSufficiency: {
      flow: "低",
      strength: "低",
      market: "低",
      reason: "AI证据结构未通过校验，本次先直接引用原始回答，结论仍需核对和验证。",
    },
    informationGaps: ["AI证据提取结果结构异常，已改用原始回答生成可追溯证据。"],
  }, answerItems);
  return {
    evidence: validateEvidence(fallback, answerItems),
    aiMeta: {
      label: "extractEvidence",
      model: getConfig().fastModel,
      attempts: 3,
      fallback: "direct_answer_evidence",
      validationError: String(validationError && validationError.message || "结构校验失败").slice(0, 160),
    },
  };
}

async function extractEvidence(input, caller = callStructured) {
  const answerItems = validateAnswerItems(input.answerItems);
  const config = getConfig();
  try {
    const response = await caller({
      label: "extractEvidence",
      model: config.fastModel,
      systemPrompt: EVIDENCE_PROMPT,
      userPayload: { answers: answerItems },
      validate: (data) => validateEvidence(normalizeEvidence(data, answerItems), answerItems),
    });
    return {
      evidence: response.data,
      aiMeta: response.meta,
    };
  } catch (error) {
    if (!error || error.code !== "AI_SCHEMA_INVALID") throw error;
    console.warn("[opcApi] evidence schema fallback", {
      details: String(error.message || "结构校验失败").slice(0, 160),
    });
    return buildEvidenceFallback(answerItems, error);
  }
}

async function generateRoutes(input, caller = callStructured) {
  const answerItems = validateAnswerItems(input.answerItems);
  const evidence = validateEvidence(input.evidence, answerItems);
  const config = getConfig();
  const response = await caller({
    label: "generateRoutes",
    model: config.qualityModel,
    systemPrompt: ROUTES_PROMPT,
    userPayload: { evidence },
    validate: (data) => validateRoutes(data, answerItems),
  });
  return {
    routes: response.data.routes,
    routeDifferentiation: response.data.routeDifferentiation,
    aiMeta: response.meta,
  };
}

async function analyzeMarket(input, caller = callStructured) {
  const answerItems = validateAnswerItems(input.answerItems);
  const evidence = validateEvidence(input.evidence, answerItems);
  const routeData = validateRoutes({
    routes: input.routes,
    routeDifferentiation: input.routeDifferentiation || "三条路线在目标用户、能力或商业化路径上存在差异。",
  }, answerItems);
  const config = getConfig();
  const response = await caller({
    label: "analyzeMarket",
    model: config.qualityModel,
    systemPrompt: MARKET_PROMPT,
    userPayload: {
      marketSignals: evidence.marketInitialSignals,
      evidenceSummary: evidence,
      routes: routeData.routes,
    },
    validate: (data) => validateMarket(data, routeData.routes.map((route) => route.routeId)),
  });
  return {
    routes: mergeMarketIntoRoutes(routeData.routes, response.data.routes),
    aiMeta: response.meta,
  };
}

async function generatePlan(input, caller = callStructured) {
  const { route, startupConditions } = validatePlanRequest(
    input.selectedRoute,
    input.startupConditions,
  );
  const config = getConfig();
  const response = await caller({
    label: "generatePlan",
    model: config.qualityModel,
    systemPrompt: PLAN_PROMPT,
    userPayload: {
      selectedRoute: route,
      startupConditions,
    },
    validate: (data) => validatePlan(data, startupConditions),
  });
  return {
    plan: {
      ...response.data,
      source: "ai_generated",
      selectedRouteId: route.routeId,
      createdAt: new Date().toISOString(),
    },
    aiMeta: response.meta,
  };
}

async function runAnalysis(input, caller = callStructured) {
  const evidenceResult = await extractEvidence(input, caller);
  const routeResult = await generateRoutes({
    answerItems: input.answerItems,
    evidence: evidenceResult.evidence,
  }, caller);
  const marketResult = await analyzeMarket({
    answerItems: input.answerItems,
    evidence: evidenceResult.evidence,
    routes: routeResult.routes,
    routeDifferentiation: routeResult.routeDifferentiation,
  }, caller);
  return {
    evidence: evidenceResult.evidence,
    routes: marketResult.routes,
    routeDifferentiation: routeResult.routeDifferentiation,
    aiMeta: [evidenceResult.aiMeta, routeResult.aiMeta, marketResult.aiMeta],
  };
}

module.exports = {
  analyzeMarket,
  buildEvidenceFallback,
  extractEvidence,
  generatePlan,
  generateRoutes,
  mergeMarketIntoRoutes,
  runAnalysis,
};
