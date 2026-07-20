const { CONTRACT_VERSION } = require("./dataContract");
const { QUESTIONS } = require("./questions");

const ERROR_MESSAGES = {
  ANSWERS_INCOMPLETE: "还有题目未填写，请返回问答页补充后再试。",
  CLOUD_UNAVAILABLE: "当前环境无法使用云函数，请检查微信开发者工具的云开发环境。",
  AI_NOT_CONFIGURED: "AI服务尚未配置，请返回首页或联系开发者。",
  AI_TIMEOUT: "AI分析超时，请重试或返回首页。",
  AI_NETWORK_ERROR: "AI服务暂时无法连接，请重试或返回首页。",
  AI_INVALID_JSON: "AI返回的内容不是有效JSON。",
  AI_SCHEMA_INVALID: "AI返回的数据没有通过结构校验。",
  AI_ANALYSIS_FAILED: "AI分析失败，请重试或返回首页。",
};

function translateSchemaDetail(details) {
  return String(details || "")
    .replace(/flowEvidence/g, "心流证据")
    .replace(/strengthEvidence/g, "优势证据")
    .replace(/marketInitialSignals/g, "市场初步信号")
    .replace(/evidenceSufficiency/g, "证据充分度")
    .replace(/informationGaps/g, "待补信息")
    .replace(/sourceAnswerId/g, "来源题号")
    .replace(/sourceQuote/g, "原文引用")
    .replace(/routes\[(\d+)\]/g, (match, index) => `第${Number(index) + 1}条路线`)
    .replace(/\.claim/g, "的结论")
    .replace(/\.routeId/g, "的路线编号")
    .replace(/\.routeName/g, "的路线名称")
    .replace(/不是用户原文/g, "无法对应到你的原回答")
    .replace(/为空/g, "缺失")
    .replace(/无效/g, "格式不正确")
    .slice(0, 120);
}

function describeAnalysisError(error, stageLabel) {
  const code = error && error.code;
  const detail = code === "AI_SCHEMA_INVALID"
    ? translateSchemaDetail(error && error.details)
    : "";
  return {
    stage: stageLabel || "AI分析",
    reason: detail || ERROR_MESSAGES[code] || "AI分析暂时不可用。",
    action: error && error.retryable === false
      ? "当前问题无法通过重试解决，请返回首页或联系开发者。"
      : "系统已自动重试2次；你可以手动重试，或返回首页稍后再试。",
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildAnswerItems(session) {
  const answers = session && session.answers ? session.answers : {};
  const items = QUESTIONS.map((question) => ({
    questionId: question.questionId,
    questionText: question.questionText,
    intent: question.intent,
    answer: typeof answers[question.questionId] === "string"
      ? answers[question.questionId].trim()
      : "",
  }));
  const missing = items.filter((item) => !item.answer).map((item) => item.questionId);
  if (missing.length > 0) {
    const error = new Error(`以下题目尚未填写：${missing.join("、")}`);
    error.code = "ANSWERS_INCOMPLETE";
    throw error;
  }
  return items;
}

async function callAnalysisAction(action, payload) {
  if (!wx.cloud || typeof wx.cloud.callFunction !== "function") {
    const error = new Error("当前微信环境不支持云函数");
    error.code = "CLOUD_UNAVAILABLE";
    throw error;
  }
  const response = await wx.cloud.callFunction({
    name: "opcApi",
    data: { action, payload },
  });
  const result = response && response.result;
  if (!result || !result.ok) {
    const source = result && result.error ? result.error : {};
    const error = new Error(source.message || "AI分析失败，请重试或返回首页。");
    error.code = source.code || "AI_ANALYSIS_FAILED";
    error.retryable = source.retryable !== false;
    error.details = source.details || "";
    throw error;
  }
  return result.data;
}

function createStartupConditions(session) {
  const existing = session.startupConditions || {};
  return {
    incomeFloor: {
      latestFirstRevenue: "3个月内",
      minimumMeaningfulAmount: "100—1000元",
      ...(existing.incomeFloor || {}),
    },
    weeklyAvailableTime: existing.weeklyAvailableTime
      || (session.context && session.context.weeklyAvailableTime)
      || "3—7小时",
    reachableUsersByRoute: {
      A: "0人",
      B: "0人",
      C: "0人",
      ...(existing.reachableUsersByRoute || {}),
    },
    validationResources: {
      budget: "0元",
      supplementMethod: "更愿意投入时间",
      ...(existing.validationResources || {}),
    },
  };
}

function buildAnalysisResult({
  session,
  answerItems,
  evidence,
  routes,
  routeDifferentiation,
  aiMeta,
}) {
  const context = session.context || {};
  const answerMap = answerItems.reduce((map, item) => {
    map[item.questionId] = item.answer;
    return map;
  }, {});
  const normalizedEvidence = clone(evidence);
  normalizedEvidence.sessionId = session.sessionId;
  normalizedEvidence.background = {
    ...(normalizedEvidence.background || {}),
    ageStage: answerMap.Q18,
    careerStatus: answerMap.Q19,
    dailyAvailableTime: answerMap.Q20,
    weeklyAvailableTime: context.weeklyAvailableTime
      || normalizedEvidence.background.weeklyAvailableTime,
  };

  return {
    contractVersion: CONTRACT_VERSION,
    demoMode: false,
    session: {
      ...clone(session),
      status: "in_progress",
      currentStep: "evidence",
      startupConditions: createStartupConditions(session),
      updatedAt: new Date().toISOString(),
    },
    answers: {
      sessionId: session.sessionId,
      items: clone(answerItems),
    },
    evidence: normalizedEvidence,
    routes: clone(routes),
    routeDifferentiation,
    plan: null,
    aiMeta: clone(aiMeta),
  };
}

module.exports = {
  buildAnalysisResult,
  buildAnswerItems,
  callAnalysisAction,
  createStartupConditions,
  describeAnalysisError,
};
