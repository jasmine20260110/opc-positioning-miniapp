/**
 * OPC定位神器 P0 MVP 统一数据契约。
 *
 * 约定：
 * 1. 小程序和云函数内部统一使用 camelCase。
 * 2. AI 原始响应如使用 snake_case，必须在云函数内转换后再返回。
 * 3. 当前契约只服务内部 Demo，不代表数据库设计。
 */

const CONTRACT_VERSION = "p0-mvp-v1";

const ROUTE_IDS = Object.freeze(["A", "B", "C"]);
const EVIDENCE_TYPES = Object.freeze([
  "用户事实",
  "用户判断",
  "AI推测",
  "待验证",
]);
const MARKET_FIELDS = Object.freeze([
  "paidMarketMaturity",
  "competitorAndDifferentiation",
  "demandEvidenceStrength",
  "acquisitionChannel",
  "firstRevenueExpectation",
]);
const STARTUP_DIMENSIONS = Object.freeze([
  "首笔变现",
  "稳定投入时间",
  "首批用户资源",
  "验证预算",
]);
const SESSION_STEPS = Object.freeze([
  "questions",
  "analyzing",
  "evidence",
  "market",
  "startup",
  "fit",
  "startup_fit",
  "plan",
]);

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateP0DemoData(data) {
  const errors = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Demo数据必须是对象"] };
  }

  if (data.contractVersion !== CONTRACT_VERSION) {
    errors.push(`contractVersion 必须是 ${CONTRACT_VERSION}`);
  }

  if (!data.session || typeof data.session !== "object") {
    errors.push("缺少 session");
  } else {
    if (!data.session.sessionId) errors.push("session.sessionId 不能为空");
    if (!SESSION_STEPS.includes(data.session.currentStep)) {
      errors.push("session.currentStep 不在允许范围内");
    }
  }

  const answerItems = data.answers && data.answers.items;
  if (!Array.isArray(answerItems) || answerItems.length !== 20) {
    errors.push("answers.items 必须正好包含20题答案");
  }

  if (!data.evidence || typeof data.evidence !== "object") {
    errors.push("缺少 evidence");
  } else {
    if (!isNonEmptyArray(data.evidence.flowEvidence)) {
      errors.push("evidence.flowEvidence 至少需要1条");
    }
    if (!isNonEmptyArray(data.evidence.strengthEvidence)) {
      errors.push("evidence.strengthEvidence 至少需要1条");
    }
    if (!isText(data.evidence.flowSummary)) {
      errors.push("evidence.flowSummary 不能为空");
    }
    if (!isText(data.evidence.strengthSummary)) {
      errors.push("evidence.strengthSummary 不能为空");
    }
  }

  if (!Array.isArray(data.routes) || data.routes.length !== 3) {
    errors.push("routes 必须正好包含3条路线");
  } else {
    const routeIds = data.routes.map((route) => route.routeId);
    ROUTE_IDS.forEach((routeId) => {
      if (!routeIds.includes(routeId)) errors.push(`缺少路线 ${routeId}`);
    });

    data.routes.forEach((route, index) => {
      const label = route.routeId || `第${index + 1}条路线`;
      if (!route.routeName) errors.push(`${label} 缺少 routeName`);
      if (!isNonEmptyArray(route.matchEvidence)) {
        errors.push(`${label} 至少需要1条 matchEvidence`);
      }

      const marketOpportunity = route.marketOpportunity || {};
      const marketKeys = Object.keys(marketOpportunity);
      if (
        marketKeys.length !== MARKET_FIELDS.length ||
        !MARKET_FIELDS.every((field) => marketKeys.includes(field))
      ) {
        errors.push(`${label} 的 marketOpportunity 必须正好包含5个固定字段`);
      }

      if (!route.launchRequirements) {
        errors.push(`${label} 缺少 launchRequirements`);
      }

      const dimensions = route.startupFit && route.startupFit.dimensions;
      if (!Array.isArray(dimensions) || dimensions.length !== 4) {
        errors.push(`${label} 的 startupFit.dimensions 必须正好包含4项`);
      }
    });
  }

  if (!data.plan || typeof data.plan !== "object") {
    errors.push("缺少 plan");
  } else if (!Array.isArray(data.plan.days) || data.plan.days.length !== 7) {
    errors.push("plan.days 必须正好包含Day 1—Day 7");
  } else {
    data.plan.days.forEach((day, index) => {
      const expectedDay = index + 1;
      if (day.day !== expectedDay) errors.push(`计划第${expectedDay}项的 day 必须是${expectedDay}`);
      ["goal", "minimumAction", "estimatedTime", "completionEvidence", "fallback"].forEach(
        (field) => {
          if (!day[field]) errors.push(`Day ${expectedDay} 缺少 ${field}`);
        },
      );
    });
  }

  if (
    data.session &&
    data.session.selectedRouteId &&
    data.plan &&
    data.plan.selectedRouteId !== data.session.selectedRouteId
  ) {
    errors.push("session.selectedRouteId 与 plan.selectedRouteId 不一致");
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  CONTRACT_VERSION,
  ROUTE_IDS,
  EVIDENCE_TYPES,
  MARKET_FIELDS,
  STARTUP_DIMENSIONS,
  SESSION_STEPS,
  validateP0DemoData,
};
