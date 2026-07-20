const EVIDENCE_TYPES = ["用户事实", "用户判断", "AI推测", "待验证"];
const SUFFICIENCY = ["高", "中", "低"];
const PAID_MARKET_MATURITY = ["明确付费", "付费较弱", "只有兴趣", "待验证"];
const DEMAND_EVIDENCE_STRENGTH = ["强", "中", "弱", "待验证"];
const DAILY_TO_WEEKLY_TIME = {
  "不到1小时（碎片时间为主）": "3—7小时",
  "1—2小时（早晚或周末）": "7—14小时",
  "2—4小时（有较稳定的整块时间）": "14小时以上",
  "4小时以上（目前主要精力在此）": "14小时以上",
};

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

function normalizeSufficiency(value) {
  if (SUFFICIENCY.includes(value)) return value;
  if (["较高", "很好", "充分"].includes(value)) return "高";
  if (["一般", "较为充分", "中等"].includes(value)) return "中";
  return "低";
}

function normalizeEvidenceItems(items, answerMap, fallbackAnswerId) {
  const normalized = (Array.isArray(items) ? items : [])
    .filter((item) => item && isText(item.sourceAnswerId) && answerMap[item.sourceAnswerId])
    .map((item) => {
      const answer = answerMap[item.sourceAnswerId];
      const normalizedQuote = normalizeText(item.sourceQuote);
      const quoteIsGrounded = isText(item.sourceQuote)
        && normalizedQuote.length > 0
        && normalizeText(answer).includes(normalizedQuote);
      return {
        ...item,
        claim: isText(item.claim) ? item.claim : answer,
        sourceQuote: quoteIsGrounded ? item.sourceQuote : answer,
        evidenceType: EVIDENCE_TYPES.includes(item.evidenceType)
          ? item.evidenceType
          : "AI推测",
      };
    });

  if (normalized.length > 0 || !answerMap[fallbackAnswerId]) return normalized;
  return [{
    claim: answerMap[fallbackAnswerId],
    sourceAnswerId: fallbackAnswerId,
    sourceQuote: answerMap[fallbackAnswerId],
    evidenceType: "用户事实",
  }];
}

function normalizeEvidence(data, answerItems) {
  const source = data && typeof data === "object" ? data : {};
  const answerMap = createAnswerMap(answerItems);
  const marketSignals = source.marketInitialSignals || {};
  const sufficiency = source.evidenceSufficiency || {};

  return {
    ...source,
    flowEvidence: normalizeEvidenceItems(source.flowEvidence, answerMap, "Q2"),
    strengthEvidence: normalizeEvidenceItems(source.strengthEvidence, answerMap, "Q10"),
    marketInitialSignals: {
      ...marketSignals,
      targetAudience: isText(marketSignals.targetAudience)
        ? marketSignals.targetAudience
        : answerMap.Q15,
      problem: isText(marketSignals.problem) ? marketSignals.problem : answerMap.Q16,
      paymentJudgment: isText(marketSignals.paymentJudgment)
        ? marketSignals.paymentJudgment
        : answerMap.Q17,
      evidenceType: EVIDENCE_TYPES.includes(marketSignals.evidenceType)
        ? marketSignals.evidenceType
        : "用户判断",
    },
    background: {
      ...(source.background || {}),
      ageStage: answerMap.Q18,
      careerStatus: answerMap.Q19,
      dailyAvailableTime: answerMap.Q20,
      weeklyAvailableTime: DAILY_TO_WEEKLY_TIME[answerMap.Q20]
        || (source.background && source.background.weeklyAvailableTime)
        || "待确认",
    },
    evidenceSufficiency: {
      ...sufficiency,
      flow: normalizeSufficiency(sufficiency.flow),
      strength: normalizeSufficiency(sufficiency.strength),
      market: normalizeSufficiency(sufficiency.market),
      reason: isText(sufficiency.reason)
        ? sufficiency.reason
        : "已依据原始回答补齐结构，仍需通过真实行动继续验证。",
    },
    informationGaps: Array.isArray(source.informationGaps)
      ? source.informationGaps
      : [],
  };
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
  assert(quote.length > 0 && answer.includes(quote), `${label}.sourceQuote不是用户原文`);
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

function parseEstimatedMinutes(value, label) {
  assert(isText(value) && /分钟/.test(value), `${label}必须使用分钟`);
  const matches = String(value).match(/\d+(?:\.\d+)?/g);
  assert(matches && matches.length > 0, `${label}必须包含预计分钟数`);
  const numbers = matches.map(Number);
  assert(numbers.every((number) => Number.isFinite(number) && number > 0), `${label}包含无效时间`);
  if (numbers.length > 1) {
    assert(numbers[0] <= numbers[numbers.length - 1], `${label}时间区间顺序错误`);
  }
  const maximum = numbers[numbers.length - 1];
  assert(maximum <= 60, `${label}单日预计用时不能超过60分钟`);
  return maximum;
}

function weeklyAvailableMinutes(value) {
  if (!isText(value)) return null;
  if (value === "少于3小时") return 180;
  if (String(value).includes("以上")) return Infinity;
  const matches = String(value).match(/\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  return Number(matches[matches.length - 1]) * 60;
}

function validatePlan(data, startupConditions = {}) {
  assert(data && typeof data === "object", "计划输出不是对象");
  ["planName", "planGoal", "planNote"].forEach((key) => {
    assert(isText(data[key]), `计划输出${key}为空`);
  });
  assert(/基于当前信息|待验证/.test(data.planNote), "planNote必须说明计划基于当前信息或关键假设待验证");
  assert(Array.isArray(data.days) && data.days.length === 7, "计划必须正好包含Day 1—Day 7");
  let totalMaximumMinutes = 0;
  data.days.forEach((day, index) => {
    const expectedDay = index + 1;
    assert(day && day.day === expectedDay, `计划第${expectedDay}项的day必须是${expectedDay}`);
    ["goal", "minimumAction", "estimatedTime", "completionEvidence", "fallback"].forEach((key) => {
      assert(isText(day[key]), `Day ${expectedDay}.${key}为空`);
    });
    totalMaximumMinutes += parseEstimatedMinutes(day.estimatedTime, `Day ${expectedDay}.estimatedTime`);
  });

  const weeklyLimit = weeklyAvailableMinutes(startupConditions.weeklyAvailableTime);
  if (isText(startupConditions.weeklyAvailableTime)) {
    assert(weeklyLimit !== null, "计划输入weeklyAvailableTime无法解析");
  }
  if (weeklyLimit !== null && weeklyLimit !== Infinity) {
    assert(
      totalMaximumMinutes <= weeklyLimit,
      `计划7天预计用时上限${totalMaximumMinutes}分钟超过用户每周可投入上限${weeklyLimit}分钟`,
    );
  }

  const validationText = data.days
    .map((day) => `${day.goal}${day.minimumAction}${day.completionEvidence}`)
    .join("");
  assert(
    /访谈|联系|真实用户|目标用户|用户反馈|需求验证|需求场景|体验邀请|试用/.test(validationText),
    "计划缺少真实用户或市场验证",
  );
  assert(/付费|报价|购买|预售|成交|支付|价格/.test(validationText), "计划缺少付费信号验证");
  return data;
}

module.exports = {
  SchemaError,
  normalizeEvidence,
  validateAnswerItems,
  validateEvidence,
  validateMarket,
  validatePlan,
  validatePlanRequest,
  validateRoutes,
};
