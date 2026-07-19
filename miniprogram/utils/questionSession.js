const SESSION_KEY = "opc_mvp_session";

const DAILY_TO_WEEKLY_TIME = Object.freeze({
  "不到1小时（碎片时间为主）": "3—7小时",
  "1—2小时（早晚或周末）": "7—14小时",
  "2—4小时（有较稳定的整块时间）": "14小时以上",
  "4小时以上（目前主要精力在此）": "14小时以上",
});

const ABSTRACT_PATTERNS = [
  /^不知道[。！!]?$/,
  /^没想过[。！!]?$/,
  /^都可以[。！!]?$/,
  /^随便[。！!]?$/,
  /^没有[。！!]?$/,
  /^一般[。！!]?$/,
  /^还好[。！!]?$/,
  /^看情况[。！!]?$/,
  /^差不多[。！!]?$/,
  /^什么都行[。！!]?$/,
];

function getWeeklyAvailableTime(dailyAvailableTime) {
  return DAILY_TO_WEEKLY_TIME[dailyAvailableTime] || "";
}

function createQuestionSession({ demoMode = false, answers = {} } = {}) {
  const now = new Date().toISOString();
  return normalizeQuestionSession({
    sessionId: `local-${Date.now()}`,
    status: "in_progress",
    currentStep: "questions",
    currentIndex: 0,
    currentQuestionIndex: 0,
    answers,
    context: {},
    demoMode,
    createdAt: now,
    updatedAt: now,
  });
}

function normalizeQuestionSession(rawSession = {}) {
  const answers = rawSession.answers && typeof rawSession.answers === "object"
    ? { ...rawSession.answers }
    : {};
  const rawIndex = Number.isInteger(rawSession.currentQuestionIndex)
    ? rawSession.currentQuestionIndex
    : rawSession.currentIndex;
  const currentIndex = Number.isInteger(rawIndex) ? Math.max(0, Math.min(rawIndex, 19)) : 0;
  const dailyAvailableTime = answers.Q20 || rawSession.context?.dailyAvailableTime || "";
  const weeklyAvailableTime = getWeeklyAvailableTime(dailyAvailableTime)
    || rawSession.context?.weeklyAvailableTime
    || "";

  return {
    ...rawSession,
    sessionId: rawSession.sessionId || `local-${Date.now()}`,
    status: rawSession.status || "in_progress",
    currentStep: rawSession.currentStep || "questions",
    currentIndex,
    currentQuestionIndex: currentIndex,
    answers,
    context: {
      ...(rawSession.context || {}),
      ageStage: answers.Q18 || rawSession.context?.ageStage || "",
      careerStatus: answers.Q19 || rawSession.context?.careerStatus || "",
      dailyAvailableTime,
      weeklyAvailableTime,
    },
    startupConditions: weeklyAvailableTime
      ? {
          ...(rawSession.startupConditions || {}),
          weeklyAvailableTime,
        }
      : rawSession.startupConditions,
    demoMode: Boolean(rawSession.demoMode),
    updatedAt: rawSession.updatedAt || new Date().toISOString(),
  };
}

function saveAnswerToSession(session, { questionId, answer, currentIndex }) {
  const normalized = normalizeQuestionSession(session);
  const nextAnswers = { ...normalized.answers };
  const cleanAnswer = typeof answer === "string" ? answer.trim() : "";

  if (cleanAnswer) nextAnswers[questionId] = cleanAnswer;
  else delete nextAnswers[questionId];

  return normalizeQuestionSession({
    ...normalized,
    answers: nextAnswers,
    currentIndex,
    currentQuestionIndex: currentIndex,
    updatedAt: new Date().toISOString(),
  });
}

function isAbstractAnswer(answer, questionType = "text") {
  if (questionType !== "text") return false;
  const cleanAnswer = typeof answer === "string" ? answer.trim() : "";
  if (!cleanAnswer) return false;
  return ABSTRACT_PATTERNS.some((pattern) => pattern.test(cleanAnswer));
}

module.exports = {
  DAILY_TO_WEEKLY_TIME,
  SESSION_KEY,
  createQuestionSession,
  getWeeklyAvailableTime,
  isAbstractAnswer,
  normalizeQuestionSession,
  saveAnswerToSession,
};
