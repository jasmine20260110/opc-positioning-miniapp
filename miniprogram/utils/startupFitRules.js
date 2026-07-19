const SCORE_STATUS = Object.freeze({
  0: "明显冲突",
  1: "可以补足",
  2: "当前满足",
});

function hasUnknownRequirement(value) {
  return !value || String(value).includes("待验证");
}

function numberRange(value) {
  const numbers = String(value || "")
    .match(/\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length === 0) return null;
  const parsed = numbers.map(Number);
  return {
    min: parsed[0],
    max: String(value).includes("以上") ? Infinity : parsed[parsed.length - 1],
  };
}

function weeklyTimeRange(value) {
  if (value === "少于3小时") return { min: 0, max: 3 };
  return numberRange(value);
}

function reachableRange(value) {
  if (value === "0人") return { min: 0, max: 0 };
  return numberRange(value);
}

function availableBudget(value) {
  const map = {
    "0元": 0,
    "500元以内": 500,
    "500—3000元": 3000,
    "3000元以上": Infinity,
  };
  return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : null;
}

function latestRevenueMonths(value) {
  if (value === "可以更久") return Infinity;
  const range = numberRange(value);
  return range ? range.max : null;
}

function minimumMeaningfulAmount(value) {
  const map = {
    "100元以内": 100,
    "100—1000元": 100,
    "1000—5000元": 1000,
    "5000元以上": 5000,
  };
  return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : null;
}

function makeDimension(name, score, reason, recommendation) {
  return {
    name,
    internalScore: score,
    status: score === null ? "待验证" : SCORE_STATUS[score],
    reason,
    recommendation,
  };
}

function compareRevenue(requirements, conditions) {
  const routeCycle = requirements && requirements.firstRevenueCycle;
  const routeAmount = requirements && requirements.firstRevenueAmountRange;
  const incomeFloor = conditions && conditions.incomeFloor;
  const latestMonths = latestRevenueMonths(incomeFloor && incomeFloor.latestFirstRevenue);
  const minimumAmount = minimumMeaningfulAmount(incomeFloor && incomeFloor.minimumMeaningfulAmount);

  if (
    hasUnknownRequirement(routeCycle)
    || hasUnknownRequirement(routeAmount)
    || latestMonths === null
    || minimumAmount === null
  ) {
    return makeDimension(
      "首笔变现",
      null,
      "收入期限或路线变现要求缺少可比较信息。",
      "先确认可接受的收入期限，再验证一次真实付费信号。",
    );
  }

  const cycleRange = numberRange(routeCycle);
  const amountRange = numberRange(routeAmount);
  if (!cycleRange || !amountRange) {
    return makeDimension("首笔变现", null, "路线变现要求无法解析。", "补充预计周期和金额区间。");
  }

  const cycleScore = cycleRange.max <= latestMonths
    ? 2
    : cycleRange.min <= latestMonths
      ? 1
      : 0;
  const amountScore = amountRange.min >= minimumAmount
    ? 2
    : amountRange.max >= minimumAmount
      ? 1
      : 0;
  const score = Math.min(cycleScore, amountScore);
  const reason = score === 2
    ? `路线预计${routeCycle}获得${routeAmount}，符合当前收入底线。`
    : score === 1
      ? `路线预计${routeCycle}获得${routeAmount}，与当前收入底线只有部分重合。`
      : `路线预计${routeCycle}获得${routeAmount}，难以满足当前收入期限或金额底线。`;

  return makeDimension(
    "首笔变现",
    score,
    reason,
    score === 2 ? "先用低价版本验证真实付费。" : "缩小交付范围，测试更快获得首笔收入的版本。",
  );
}

function compareTime(requirements, conditions) {
  const requiredValue = requirements && requirements.minimumWeeklyTime;
  const availableValue = conditions && conditions.weeklyAvailableTime;
  if (hasUnknownRequirement(requiredValue) || !availableValue) {
    return makeDimension("稳定投入时间", null, "每周时间要求缺少可比较信息。", "先记录一周真实可用时间。");
  }

  const required = numberRange(requiredValue);
  const available = weeklyTimeRange(availableValue);
  if (!required || !available) {
    return makeDimension("稳定投入时间", null, "时间区间无法解析。", "重新确认每周可稳定投入的小时数。");
  }

  const requiredHours = required.max;
  const score = available.min >= requiredHours ? 2 : available.max >= requiredHours ? 1 : 0;
  const reason = score === 2
    ? `每周可投入${availableValue}，达到路线最低${requiredValue}要求。`
    : score === 1
      ? `每周可投入${availableValue}，区间上限可覆盖最低${requiredValue}要求。`
      : `每周可投入${availableValue}，低于路线最低${requiredValue}要求。`;

  return makeDimension(
    "稳定投入时间",
    score,
    reason,
    score === 2 ? "固定两个可执行时间块，避免只靠碎片时间。" : "把验证动作缩小，或先腾出一个固定时间块。",
  );
}

function compareUsers(route, requirements, conditions) {
  const requiredUsers = requirements && requirements.firstValidationUsers;
  const availableValue = conditions
    && conditions.reachableUsersByRoute
    && conditions.reachableUsersByRoute[route.routeId];
  if (!requiredUsers || hasUnknownRequirement(requiredUsers.count) || !availableValue) {
    return makeDimension("首批用户资源", null, "首批用户要求缺少可比较信息。", "先列出可以直接联系的人和渠道。");
  }

  const required = numberRange(requiredUsers.count);
  const available = reachableRange(availableValue);
  if (!required || !available) {
    return makeDimension("首批用户资源", null, "用户数量区间无法解析。", "重新确认可直接联系人数。");
  }

  const requiredCount = required.max;
  const supplementMethod = conditions.validationResources && conditions.validationResources.supplementMethod;
  let score = 0;
  if (available.min >= requiredCount) score = 2;
  else if (available.max >= requiredCount) score = 1;
  else if (available.max > 0 && supplementMethod !== "暂时不补足") score = 1;
  else if (available.max === 0 && supplementMethod === "可以找人合作") score = 1;

  const reason = score === 2
    ? `可直接联系${availableValue}，覆盖首轮${requiredUsers.count}验证。`
    : score === 1
      ? `可直接联系${availableValue}，需要通过${requiredUsers.channel || "新增渠道"}补足。`
      : `当前可直接联系${availableValue}，无法覆盖首轮${requiredUsers.count}验证。`;

  return makeDimension(
    "首批用户资源",
    score,
    reason,
    score === 2 ? "先联系最容易获得真实反馈的3人。" : `先通过${requiredUsers.channel || "一个明确渠道"}找到第1位验证用户。`,
  );
}

function compareBudget(requirements, conditions) {
  const requiredValue = requirements && requirements.minimumValidationBudget;
  const resources = conditions && conditions.validationResources;
  const availableValue = resources && resources.budget;
  if (hasUnknownRequirement(requiredValue) || !availableValue) {
    return makeDimension("验证预算", null, "验证预算要求缺少可比较信息。", "先确认最小验证需要的真实支出。");
  }

  const required = numberRange(requiredValue);
  const available = availableBudget(availableValue);
  if (!required || available === null) {
    return makeDimension("验证预算", null, "预算区间无法解析。", "重新确认可投入预算。");
  }

  const requiredAmount = required.max;
  const supplementMethod = resources.supplementMethod;
  const canSupplement = supplementMethod === "愿意花钱" || supplementMethod === "可以找人合作";
  const score = available >= requiredAmount ? 2 : canSupplement ? 1 : 0;
  const reason = score === 2
    ? `可投入${availableValue}，覆盖最低${requiredValue}验证预算。`
    : score === 1
      ? `可投入${availableValue}，需要按“${supplementMethod}”补足预算。`
      : `可投入${availableValue}，低于最低${requiredValue}验证预算。`;

  return makeDimension(
    "验证预算",
    score,
    reason,
    score === 2 ? "先使用免费工具，只为关键验证环节付费。" : "改用免费工具或进一步缩小验证范围。",
  );
}

function summarizeFit(dimensions) {
  const scores = dimensions.map((item) => item.internalScore);
  let result;
  if (scores.includes(0)) result = "暂缓";
  else if (scores.includes(null)) result = "待验证";
  else if (scores.includes(1)) result = "补足后验证";
  else result = "优先验证";

  const gap = dimensions.find((item) => item.internalScore === 0)
    || dimensions.find((item) => item.internalScore === 1)
    || dimensions.find((item) => item.internalScore === null);

  return {
    result,
    maxGap: gap ? `${gap.name}：${gap.reason}` : "暂无明显启动条件缺口；市场需求仍待验证。",
    recommendation: gap ? gap.recommendation : "保持低投入，先完成一次需求和付费验证。",
  };
}

function calculateRouteStartupFit(route, conditions) {
  const requirements = route.launchRequirements || {};
  const dimensions = [
    compareRevenue(requirements, conditions),
    compareTime(requirements, conditions),
    compareUsers(route, requirements, conditions),
    compareBudget(requirements, conditions),
  ];
  const summary = summarizeFit(dimensions);

  return {
    dimensions: dimensions.map(({ recommendation, ...dimension }) => dimension),
    ...summary,
  };
}

function calculateStartupFit(routes, conditions) {
  return routes.map((route) => ({
    ...route,
    startupFit: calculateRouteStartupFit(route, conditions),
  }));
}

module.exports = {
  calculateRouteStartupFit,
  calculateStartupFit,
};
