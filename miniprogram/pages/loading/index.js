const { DEMO_DATA } = require("../../utils/demoData");
const {
  buildAnalysisResult,
  buildAnswerItems,
  callAnalysisAction,
} = require("../../utils/analysisService");

const RESULT_KEY = "opc_mvp_result";
const SESSION_KEY = "opc_mvp_session";

function getFriendlyErrorMessage(error) {
  const messages = {
    ANSWERS_INCOMPLETE: "还有题目未填写，请返回问答页补充后再试。",
    CLOUD_UNAVAILABLE: "当前环境无法使用云函数，请检查微信开发者工具的云开发环境。",
    AI_NOT_CONFIGURED: "AI服务尚未配置，请先使用演示数据继续。",
    AI_TIMEOUT: "AI分析超时，请重试或使用演示数据。",
    AI_NETWORK_ERROR: "AI服务暂时无法连接，请重试或使用演示数据。",
    AI_INVALID_JSON: "AI返回格式不正确，请重试或使用演示数据。",
    AI_SCHEMA_INVALID: "AI结果字段不完整，请重试或使用演示数据。",
    AI_ANALYSIS_FAILED: "AI分析失败，请重试或使用演示数据。",
  };
  return messages[error && error.code]
    || "AI分析暂时不可用，请重试或使用演示数据。";
}

Page({
  data: {
    stages: [
      { label: "提取心流与优势证据", status: "active" },
      { label: "生成3条候选路线", status: "pending" },
      { label: "分析市场机会和启动要求", status: "pending" },
    ],
    note: "20题回答将通过云函数发送至阿里百炼，由DeepSeek V4 Flash分析。",
    hasError: false,
    errorMessage: "",
    busy: true,
  },

  onLoad() {
    this.runId = 0;
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
      errorMessage: "",
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
      this.setData({
        busy: false,
        hasError: true,
        errorMessage: getFriendlyErrorMessage(error),
        note: "真实AI分析未完成。你的答案仍保存在本机。",
      });
    }
  },

  onRetry() {
    if (this.data.busy) return;
    this.runAnalysis();
  },

  onUseDemoNow() {
    this.runId += 1;
    const session = wx.getStorageSync(SESSION_KEY) || {};
    session.currentStep = "evidence";
    session.demoMode = true;
    session.updatedAt = new Date().toISOString();
    wx.setStorageSync(SESSION_KEY, session);
    wx.setStorageSync(RESULT_KEY, DEMO_DATA);
    wx.redirectTo({ url: "/pages/report/index?mode=evidence" });
  },
});
