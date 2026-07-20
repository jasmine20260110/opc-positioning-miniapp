const {
  buildAnalysisResult,
  buildAnswerItems,
  callAnalysisAction,
  describeAnalysisError,
} = require("../../utils/analysisService");

const RESULT_KEY = "opc_mvp_result";
const SESSION_KEY = "opc_mvp_session";
const MAX_MANUAL_RETRIES = 3;
const RETRY_LIMIT_MESSAGE = "AI 分析已重试3次，建议稍后再试，请点击稍后返回首页，系统会保留全部答案并跳转至首页";

Page({
  data: {
    stages: [
      { label: "提取心流与优势证据", status: "active" },
      { label: "生成3条候选路线", status: "pending" },
      { label: "分析市场机会和启动要求", status: "pending" },
    ],
    note: "20题回答将通过云函数发送至阿里百炼，由DeepSeek V4 Flash分析。",
    hasError: false,
    errorStage: "",
    errorReason: "",
    errorAction: "",
    manualRetryCount: 0,
    retryLimitReached: false,
    busy: true,
  },

  onLoad() {
    this.runId = 0;
    this.manualRetryCount = 0;
    this.runAnalysis();
  },

  onUnload() {
    this.runId += 1;
  },

  markStage(index) {
    this.setData({ [`stages[${index}].status`]: "done" });
  },

  activateStage(index) {
    this.setData({ [`stages[${index}].status`]: "active" });
  },

  resetStages() {
    this.setData({
      stages: [
        { label: "提取心流与优势证据", status: "active" },
        { label: "生成3条候选路线", status: "pending" },
        { label: "分析市场机会和启动要求", status: "pending" },
      ],
      hasError: false,
      errorStage: "",
      errorReason: "",
      errorAction: "",
      manualRetryCount: this.manualRetryCount || 0,
      retryLimitReached: false,
      busy: true,
      note: "20题回答将通过云函数发送至阿里百炼，由DeepSeek V4 Flash分析。",
    });
  },

  async runAnalysis() {
    const currentRunId = this.runId + 1;
    this.runId = currentRunId;
    this.resetStages();

    try {
      const session = wx.getStorageSync(SESSION_KEY) || {};
      const answerItems = buildAnswerItems(session);
      const evidenceResult = await callAnalysisAction("extractEvidence", { answerItems });
      if (this.runId !== currentRunId) return;
      this.markStage(0);
      this.activateStage(1);

      const routeResult = await callAnalysisAction("generateRoutes", {
        answerItems,
        evidence: evidenceResult.evidence,
      });
      if (this.runId !== currentRunId) return;
      this.markStage(1);
      this.activateStage(2);

      const marketResult = await callAnalysisAction("analyzeMarket", {
        answerItems,
        evidence: evidenceResult.evidence,
        routes: routeResult.routes,
        routeDifferentiation: routeResult.routeDifferentiation,
      });
      if (this.runId !== currentRunId) return;
      this.markStage(2);

      const result = buildAnalysisResult({
        session,
        answerItems,
        evidence: evidenceResult.evidence,
        routes: marketResult.routes,
        routeDifferentiation: routeResult.routeDifferentiation,
        aiMeta: [evidenceResult.aiMeta, routeResult.aiMeta, marketResult.aiMeta],
      });
      wx.setStorageSync(RESULT_KEY, result);
      wx.setStorageSync(SESSION_KEY, result.session);
      this.setData({ busy: false, note: "分析完成，正在打开结果。" });
      wx.redirectTo({ url: "/pages/report/index?mode=evidence" });
    } catch (error) {
      if (this.runId !== currentRunId) return;
      const activeIndex = this.data.stages.findIndex((stage) => stage.status === "active");
      console.warn("[loading] AI分析失败", {
        stageIndex: activeIndex,
        code: error && error.code,
        details: error && error.details,
      });
      if (activeIndex >= 0) {
        this.setData({ [`stages[${activeIndex}].status`]: "error" });
      }
      const errorDescription = describeAnalysisError(
        error,
        activeIndex >= 0 ? this.data.stages[activeIndex].label : "AI分析",
      );
      const retryLimitReached = this.manualRetryCount >= MAX_MANUAL_RETRIES;
      this.setData({
        busy: false,
        hasError: true,
        errorStage: errorDescription.stage,
        errorReason: errorDescription.reason,
        errorAction: retryLimitReached ? RETRY_LIMIT_MESSAGE : errorDescription.action,
        manualRetryCount: this.manualRetryCount,
        retryLimitReached,
        note: "真实AI分析未完成。你的答案仍保存在本机。",
      });
    }
  },

  onRetry() {
    if (this.data.busy || this.data.retryLimitReached) return;
    this.manualRetryCount += 1;
    this.runAnalysis();
  },

  onReturnHome() {
    this.runId += 1;
    const session = wx.getStorageSync(SESSION_KEY) || {};
    session.updatedAt = new Date().toISOString();
    wx.setStorageSync(SESSION_KEY, session);
    wx.reLaunch({ url: "/pages/index/index" });
  },
});

module.exports = { MAX_MANUAL_RETRIES, RETRY_LIMIT_MESSAGE };
