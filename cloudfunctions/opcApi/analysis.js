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

async function extractEvidence(input, caller = callStructured) {
  const answerItems = validateAnswerItems(input.answerItems);
  const config = getConfig();
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
    validate: validatePlan,
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
  extractEvidence,
  generatePlan,
  generateRoutes,
  mergeMarketIntoRoutes,
  runAnalysis,
};
