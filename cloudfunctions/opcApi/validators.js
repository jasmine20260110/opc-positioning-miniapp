const EVIDENCE_TYPES = ["用户事实", "用户判断", "AI推测", "待验证"];
const SUFFICIENCY = ["高", "中", "低"];
const PAID_MARKET_MATURITY = ["明确付费", "付费较弱", "只有兴趣", "待验证"];
const DEMAND_EVIDENCE_STRENGTH = ["强", "中", "弱", "待验证"];

class SchemaError extends Error {
  constructor(message) {
    super(message);
    this.name = "SchemaError";
    this.code = "AI_SCHEMA_INVALID";
    this.retryable = true;
  }
}

function assert(condition, message) {
  if (!condition) throw new SchemaError(message);
}

function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeText(value) {
  return String(value || "").replace(/[\s“”‘’'"，。！？、；：,.!?;:]/g, "").toLowerCase();
}

function createAnswerMap(answerItems) {
  return answerItems.reduce((map, item) => {
    map[item.questionId] = item.answer;
    return map;
  }, {});
}

function validateAnswerItems(answerItems) {
  assert(Array.isArray(answerItems) && answerItems.length === 20, "answers必须正好包含20题");
  const ids = new Set();
  answerItems.forEach((item, index) => {
    assert(item && isText(item.questionId), `第${index + 1}题缺少questionId`);
    assert(/^Q(?:[1-9]|1\d|20)$/.test(item.questionId), `题号不合法:${item.questionId}`);
    assert(!ids.has(item.questionId), `题号重复:${item.questionId}`);
    assert(isText(item.questionText), `${item.questionId}缺少题目`);
    assert(isText(item.answer), `${item.questionId}答案为空`);
    ids.add(item.questionId);
  });
  assert(ids.size === 20, "20题题号不完整");
  return answerItems;
}

function validateEvidenceItem(item, answerMap, label) {
  assert(item && isText(item.claim), `${label}.claim为空`);
  assert(isText(item.sourceAnswerId) && answerMap[item.sourceAnswerId], `${label}.sourceAnswerId无效`);
  assert(isText(item.sourceQuote), `${label}.sourceQuote为空`);
  const answer = normalizeText(answerMap[item.sourceAnswerId]);
  const quote = normalizeText(item.sourceQuote);
  assert(quote.length >= 2 && answer.includes(quote), `${label}.sourceQuote不是用户原文`);
  assert(EVIDENCE_TYPES.includes(item.evidenceType), `${label}.evidenceType无效`);
}

function validateEvidence(data, answerItems) {
  const answerMap = createAnswerMap(answerItems);
  assert(data && typeof data === "object", "证据输出不是对象");
  assert(Array.isArray(data.flowEvidence) && data.flowEvidence.length > 0, "flowEvidence至少包含1条证据");
  assert(Array.isArray(data.strengthEvidence) && data.strengthEvidence.length > 0, "strengthEvidence至少包含1条证据");
  data.flowEvidence.forEach((item, index) => validateEvidenceItem(item, answerMap, `flowEvidence[${index}]`));
  data.strengthEvidence.forEach((item, index) => validateEvidenceItem(item, answerMap, `strengthEvidence[${index}]`));
  assert(data.marketInitialSignals && typeof data.marketInitialSignals === "object", "缺少marketInitialSignals");
  ["targetAudience", "problem", "paymentJudgment", "evidenceType"].forEach((key) => {
    assert(isText(data.marketInitialSignals[key]), `marketInitialSignals.${key}为空`);
  });
  assert(data.background && typeof data.background === "object", "缺少background");
  ["ageStage", "careerStatus", "dailyAvailableTime", "weeklyAvailableTime"].forEach((key) => {
    assert(isText(data.background[key]), `background.${key}为空`);
  });
  assert(data.evidenceSufficiency && typeof data.evidenceSufficiency === "object", "缺少evidenceSufficiency");
  ["flow", "strength", "market"].forEach((key) => {
    assert(SUFFICIENCY.includes(data.evidenceSufficiency[key]), `evidenceSufficiency.${key}无效`);
  });
  assert(isText(data.evidenceSufficiency.reason), "evidenceSufficiency.reason为空");
  assert(Array.isArray(data.informationGaps), "informationGaps必须是数组");
  return data;
}

function validateRouteBase(route, answerMap, index) {
  const label = `routes[${index}]`;
  ["routeId", "routeName", "oneLiner", "targetAudience", "problemSolved", "monetizationPath", "maxRisk", "minValidationAction"].forEach((key) => {
    assert(isText(route[key]), `${label}.${key}为空`);
  });
  assert(Array.isArray(route.matchEvidence) && route.matchEvidence.length > 0, `${label}.matchEvidence为空`);
  route.matchEvidence.forEach((item, evidenceIndex) => validateEvidenceItem(item, answerMap, `${label}.matchEvidence[${evidenceIndex}]`));
  assert(Array.isArray(route.capabilitiesToLeverage), `${label}.capabilitiesToLeverage必须是数组`);
  assert(Array.isArray(route.capabilitiesToDevelop), `${label}.capabilitiesToDevelop必须是数组`);
  assert(SUFFICIENCY.includes(route.evidenceSufficiency), `${label}.evidenceSufficiency无效`);
  assert(Array.isArray(route.informationGaps), `${label}.informationGaps必须是数组`);
}

function validateRoutes(data, answerItems) {
  const answerMap = createAnswerMap(answerItems);
  assert(data && Array.isArray(data.routes) && data.routes.length === 3, "routes必须正好包含3条路线");
  const ids = data.routes.map((route) => route.routeId).sort();
  assert(ids.join("") === "ABC", "routeId必须正好是A、B、C");
  data.routes.forEach((route, index) => validateRouteBase(route, answerMap, index));
  const routeNames = new Set(data.routes.map((route) => normalizeText(route.routeName)));
  assert(routeNames.size === 3, "3条路线名称必须不同");
  const routeSignatures = new Set(data.routes.map((route) => normalizeText(
    `${route.targetAudience}|${route.problemSolved}|${route.monetizationPath}`,
  )));
  assert(routeSignatures.size === 3, "3条路线的目标用户、问题或商业化路径必须有明显差异");
  assert(isText(data.routeDifferentiation), "routeDifferentiation为空");
  return data;
}

function validateMarketField(field, label) {
  assert(field && isText(field.result), `${label}.result为空`);
  assert(isText(field.basis), `${label}.basis为空`);
}

function validateComparableRequirement(value, label, unitPattern, maximum) {
  assert(isText(value), `${label}为空`);
  const text = String(value).trim();
  assert(!text.includes("待验证"), `${label}不能使用待验证，必须提供可计算的启动门槛假设`);
  assert(unitPattern.test(text), `${label}缺少规定单位`);
  const matches = text.match(/\d+(?:\.\d+)?/g);
  assert(matches && matches.length > 0, `${label}必须包含阿拉伯数字`);
  const numbers = matches.map(Number);
  assert(numbers.every((number) => Number.isFinite(number) && number >= 0), `${label}包含无效数字`);
  assert(numbers.every((number) => number <= maximum), `${label}数值超出合理范围`);
  if (numbers.length > 1) {
    assert(numbers[0] <= numbers[numbers.length - 1], `${label}区间顺序错误`);
  }
}

function validateMarket(data, routeIds) {
  assert(data && Array.isArray(data.routes) && data.routes.length === 3, "市场输出必须正好包含3条路线");
  const expectedIds = [...routeIds].sort().join("");
  const actualIds = data.routes.map((route) => route.routeId).sort().join("");
  assert(actualIds === expectedIds, "市场输出routeId与候选路线不一致");
  data.routes.forEach((route, index) => {
    const market = route.marketOpportunity;
    const requirements = route.launchRequirements;
    assert(market && typeof market === "object", `routes[${index}]缺少marketOpportunity`);
    validateMarketField(market.paidMarketMaturity, `routes[${index}].paidMarketMaturity`);
    assert(PAID_MARKET_MATURITY.includes(market.paidMarketMaturity.result), `routes[${index}].paidMarketMaturity.result无效`);
    assert(EVIDENCE_TYPES.includes(market.paidMarketMaturity.evidenceType), `routes[${index}].paidMarketMaturity.evidenceType无效`);
    validateMarketField(market.competitorAndDifferentiation, `routes[${index}].competitorAndDifferentiation`);
    validateMarketField(market.demandEvidenceStrength, `routes[${index}].demandEvidenceStrength`);
    assert(DEMAND_EVIDENCE_STRENGTH.includes(market.demandEvidenceStrength.result), `routes[${index}].demandEvidenceStrength.result无效`);
    validateMarketField(market.acquisitionChannel, `routes[${index}].acquisitionChannel`);
    assert(market.firstRevenueExpectation && isText(market.firstRevenueExpectation.cycle), `routes[${index}].firstRevenueExpectation.cycle为空`);
    assert(isText(market.firstRevenueExpectation.amountRange), `routes[${index}].firstRevenueExpectation.amountRange为空`);
    assert(isText(market.firstRevenueExpectation.basis), `routes[${index}].firstRevenueExpectation.basis为空`);
    assert(requirements && typeof requirements === "object", `routes[${index}]缺少launchRequirements`);
    validateComparableRequirement(requirements.firstRevenueCycle, `routes[${index}].launchRequirements.firstRevenueCycle`, /个月/, 120);
    validateComparableRequirement(requirements.firstRevenueAmountRange, `routes[${index}].launchRequirements.firstRevenueAmountRange`, /元/, 10000000);
    validateComparableRequirement(requirements.minimumWeeklyTime, `routes[${index}].launchRequirements.minimumWeeklyTime`, /小时/, 168);
    validateComparableRequirement(requirements.minimumValidationBudget, `routes[${index}].launchRequirements.minimumValidationBudget`, /元/, 1000000);
    assert(requirements.firstValidationUsers, `routes[${index}]缺少firstValidationUsers`);
    validateComparableRequirement(requirements.firstValidationUsers.count, `routes[${index}].firstValidationUsers.count`, /(人|个团队)/, 10000);
    assert(isText(requirements.firstValidationUsers.channel), `routes[${index}].firstValidationUsers.channel为空`);
    assert(!String(requirements.firstValidationUsers.channel).includes("待验证"), `routes[${index}].firstValidationUsers.channel不能使用待验证`);
  });
  const requirementSignatures = data.routes.map((route) => {
    const requirements = route.launchRequirements;
    return [
      requirements.firstRevenueCycle,
      requirements.firstRevenueAmountRange,
      requirements.minimumWeeklyTime,
      requirements.minimumValidationBudget,
      requirements.firstValidationUsers.count,
    ].map((value) => String(value).trim()).join("|");
  });
  assert(
    new Set(requirementSignatures).size === 3,
    "三条路线的可比较launchRequirements组合必须各不相同",
  );
  return data;
}

function validatePlanRequest(route, startupConditions) {
  assert(route && typeof route === "object", "计划输入缺少selectedRoute");
  assert(["A", "B", "C"].includes(route.routeId), "计划输入routeId无效");
  ["routeName", "oneLiner", "targetAudience", "problemSolved", "minValidationAction", "maxRisk"].forEach((key) => {
    assert(isText(route[key]), `计划输入selectedRoute.${key}为空`);
  });
  assert(route.startupFit && isText(route.startupFit.result), "计划输入缺少startupFit.result");
  assert(isText(route.startupFit.maxGap), "计划输入缺少startupFit.maxGap");
  assert(isText(route.startupFit.recommendation), "计划输入缺少startupFit.recommendation");
  assert(startupConditions && typeof startupConditions === "object", "计划输入缺少startupConditions");
  assert(isText(startupConditions.weeklyAvailableTime), "计划输入weeklyAvailableTime为空");
  assert(startupConditions.incomeFloor && typeof startupConditions.incomeFloor === "object", "计划输入缺少incomeFloor");
  assert(startupConditions.validationResources && typeof startupConditions.validationResources === "object", "计划输入缺少validationResources");
  return { route, startupConditions };
}

function validatePlan(data) {
  assert(data && typeof data === "object", "计划输出不是对象");
  ["planName", "planGoal", "planNote"].forEach((key) => {
    assert(isText(data[key]), `计划输出${key}为空`);
  });
  assert(Array.isArray(data.days) && data.days.length === 7, "计划必须正好包含Day 1—Day 7");
  data.days.forEach((day, index) => {
    const expectedDay = index + 1;
    assert(day && day.day === expectedDay, `计划第${expectedDay}项的day必须是${expectedDay}`);
    ["goal", "minimumAction", "estimatedTime", "completionEvidence", "fallback"].forEach((key) => {
      assert(isText(day[key]), `Day ${expectedDay}.${key}为空`);
    });
  });
  const validationText = data.days
    .map((day) => `${day.goal}${day.minimumAction}${day.completionEvidence}`)
    .join("");
  assert(/付费|报价|购买|市场|访谈|目标用户|需求/.test(validationText), "计划缺少市场或付费验证");
  return data;
}

module.exports = {
  SchemaError,
  validateAnswerItems,
  validateEvidence,
  validateMarket,
  validatePlan,
  validatePlanRequest,
  validateRoutes,
};
