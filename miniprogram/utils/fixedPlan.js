const PLAN_KEY = "opc_mvp_plan";

function getTimeProfile(weeklyTime) {
  if (weeklyTime === "少于3小时") {
    return { normal: "15—20分钟", focused: "20—30分钟" };
  }
  if (weeklyTime === "3—7小时") {
    return { normal: "30—40分钟", focused: "45—60分钟" };
  }
  if (weeklyTime === "7—14小时") {
    return { normal: "30—45分钟", focused: "45—60分钟" };
  }
  if (weeklyTime === "14小时以上") {
    return { normal: "45—60分钟", focused: "60分钟" };
  }
  return { normal: "20—30分钟", focused: "30—45分钟" };
}

function buildFixedPlan(route, conditions = {}) {
  const fit = route.startupFit || {};
  const weeklyTime = conditions.weeklyAvailableTime || "待确认";
  const timeProfile = getTimeProfile(weeklyTime);
  const actions = [
    {
      goal: "锁定最小服务对象",
      action: `写出“${route.routeName}”最想服务的一类人和一个具体问题。`,
      evidence: "一段不超过100字的用户问题描述",
      fallback: "只写一个你最熟悉的具体人物",
      why: "先缩小服务对象，避免路线停留在泛泛方向。",
    },
    {
      goal: "验证问题是否真实",
      action: "联系2位目标用户，询问他们最近一次遇到这个问题的场景。",
      evidence: "两段访谈或聊天记录",
      fallback: "先联系1位最容易沟通的人",
      why: "用真实场景判断问题是否存在。",
    },
    {
      goal: "设计最小方案",
      action: "把解决方案缩小成一次可以交付的最小体验。",
      evidence: "一张包含输入、过程、输出的最小方案卡",
      fallback: "只写输入、过程、输出三个标题",
      why: "把想法变成可以被体验和反馈的交付物。",
    },
    {
      goal: "执行首次验证",
      action: route.minValidationAction || "向1位目标用户发出明确的体验邀请。",
      evidence: "一份真实执行记录",
      fallback: "先发出一个明确邀请",
      why: "验证用户是否愿意为这条路线投入时间。",
    },
    {
      goal: "根据反馈修改",
      action: "删除一个无用部分，补充一个用户最需要的部分。",
      evidence: "更新后的最小方案",
      fallback: "只记录一个必须修改的问题",
      why: "根据反馈修正方案，而不是继续凭想象完善。",
    },
    {
      goal: "测试付费信号",
      action: "提出一个低风险付费方案，询问对方是否愿意购买以及原因。",
      evidence: "明确的付费意向和理由",
      fallback: "只询问什么条件下愿意付费",
      why: "区分口头认可和真实付费信号。",
    },
    {
      goal: "决定继续、调整或暂停",
      action: "汇总本周证据，决定继续、调整还是暂停这条路线。",
      evidence: "一页包含三条关键证据的验证结论",
      fallback: "只写三条最重要的证据",
      why: "用一周证据决定下一步，控制继续投入的风险。",
    },
  ];

  return {
    source: "fixed_local_fallback",
    selectedRouteId: route.routeId,
    planName: `7天验证计划：${route.routeName}`,
    planGoal: `在每周可投入${weeklyTime}的条件下，验证“${route.routeName}”是否值得继续投入。`,
    planNote: `当前使用本地固定计划，内容基于当前信息，关键市场假设仍待验证。优先处理的启动缺口：${fit.maxGap || "待验证"}。本计划不建议辞职或进行大额投入。`,
    days: actions.map((item, index) => ({
      day: index + 1,
      goal: item.goal,
      minimumAction: item.action,
      estimatedTime: [1, 3, 5].includes(index) ? timeProfile.focused : timeProfile.normal,
      completionEvidence: item.evidence,
      fallback: item.fallback,
      whyThisMatters: item.why,
    })),
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  PLAN_KEY,
  buildFixedPlan,
};
