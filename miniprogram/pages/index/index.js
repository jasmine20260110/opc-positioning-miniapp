const { SAMPLE_ANSWERS } = require("../../utils/demoData");
const { createQuestionSession } = require("../../utils/questionSession");

const SESSION_KEY = "opc_mvp_session";
const RESULT_KEY = "opc_mvp_result";
const CONDITIONS_KEY = "opc_mvp_conditions";
const PLAN_KEY = "opc_mvp_plan";
const QUESTION_URL = "/pages/question/index";

function getResumeDestination(session, result, plan) {
  if (!session) return { url: QUESTION_URL, label: "开始定位" };

  const step = session.currentStep;
  if (step === "plan" && result && result.routes && (plan || result.plan)) {
    const routeId = session.selectedRouteId
      || (plan && plan.selectedRouteId)
      || (result.plan && result.plan.selectedRouteId)
      || "A";
    return { url: `/pages/plan/index?routeId=${routeId}`, label: "继续7天计划" };
  }
  if (["fit", "startup_fit"].includes(step) && result && result.routes) {
    return { url: "/pages/report/index?mode=fit", label: "继续查看启动适配" };
  }
  if (["evidence", "market", "startup"].includes(step) && result && result.routes) {
    return { url: `/pages/report/index?mode=${step}`, label: "继续查看定位结果" };
  }
  if (step === "analyzing" && session.answers && Object.keys(session.answers).length === 20) {
    return { url: "/pages/loading/index", label: "继续AI分析" };
  }

  if (session.selectedRouteId && result && result.routes && (plan || result.plan)) {
    return {
      url: `/pages/plan/index?routeId=${session.selectedRouteId}`,
      label: "继续7天计划",
    };
  }
  if (result && result.routes) {
    return { url: "/pages/report/index?mode=evidence", label: "继续查看定位结果" };
  }

  const currentIndex = Number.isInteger(session.currentQuestionIndex)
    ? session.currentQuestionIndex
    : Number.isInteger(session.currentIndex) ? session.currentIndex : 0;
  return {
    url: QUESTION_URL,
    label: currentIndex > 0 ? `继续第${currentIndex + 1}题` : "继续定位",
  };
}

function createSession(demoMode) {
  return createQuestionSession({
    demoMode,
    answers: demoMode ? { ...SAMPLE_ANSWERS } : {},
  });
}

Page({
  data: {
    hasSavedSession: false,
    demoStarting: false,
    primaryButtonText: "开始定位",
  },

  onShow() {
    const session = wx.getStorageSync(SESSION_KEY);
    const result = wx.getStorageSync(RESULT_KEY);
    const plan = wx.getStorageSync(PLAN_KEY);
    const destination = getResumeDestination(session, result, plan);
    this.setData({
      hasSavedSession: Boolean(session),
      demoStarting: false,
      primaryButtonText: destination.label,
    });
  },

  openPage(url) {
    wx.navigateTo({
      url,
      fail: () => {
        wx.reLaunch({
          url,
          fail: () => {
            this.setData({ demoStarting: false });
            wx.showModal({
              title: "页面打开失败",
              content: "请在微信开发者工具中重新编译后再试。",
              showCancel: false,
            });
          },
        });
      },
    });
  },

  onStart() {
    let session = wx.getStorageSync(SESSION_KEY);
    if (!session) {
      session = createSession(false);
      wx.setStorageSync(SESSION_KEY, session);
    }
    const destination = getResumeDestination(
      session,
      wx.getStorageSync(RESULT_KEY),
      wx.getStorageSync(PLAN_KEY),
    );
    this.openPage(destination.url);
  },

  onUseDemo() {
    if (this.data.demoStarting) return;
    this.setData({ demoStarting: true });
    wx.removeStorageSync(RESULT_KEY);
    wx.removeStorageSync(CONDITIONS_KEY);
    wx.removeStorageSync(PLAN_KEY);
    wx.setStorageSync(SESSION_KEY, createSession(true));
    this.openPage(QUESTION_URL);
  },
});

module.exports = { getResumeDestination };
