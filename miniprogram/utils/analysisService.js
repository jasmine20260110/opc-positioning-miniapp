const { CONTRACT_VERSION } = require("./dataContract");
const { QUESTIONS } = require("./questions");

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
    const error = new Error(source.message || "AI分析失败，请重试或使用演示数据。");
    error.code = source.code || "AI_ANALYSIS_FAILED";
    error.retryable = source.retryable !== false;
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
};
