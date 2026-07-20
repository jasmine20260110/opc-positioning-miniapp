const { DEMO_DATA } = require("../../utils/demoData");
const { createQuestionSession } = require("../../utils/questionSession");

const SESSION_KEY = "opc_mvp_session";
const RESULT_KEY = "opc_mvp_result";
const CONDITIONS_KEY = "opc_mvp_conditions";
const PLAN_KEY = "opc_mvp_plan";
const QUESTION_URL = "/pages/question/index";
const INTRO_URL = "/pages/positioning-intro/index";
const REPORT_URL = "/pages/report/index?mode=evidence";
const PRIMARY_BUTTON_TEXT = "开启定位";

function getResumeDestination(session, result, plan) {
  if (!session) return { url: QUESTION_URL, label: PRIMARY_BUTTON_TEXT };

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
    label: currentIndex > 0 ? `继续第${currentIndex + 1}题` : PRIMARY_BUTTON_TEXT,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSession() {
  return createQuestionSession({
    demoMode: false,
    answers: {},
  });
}

function buildDemoSession() {
  const session = clone(DEMO_DATA.session);
  session.demoMode = true;
  session.answers = DEMO_DATA.answers.items.reduce((answers, item) => {
    answers[item.questionId] = item.answer;
    return answers;
  }, {});
  return session;
}

Page({
  data: {
    hasSavedSession: false,
    demoStarting: false,
    primaryButtonText: PRIMARY_BUTTON_TEXT,
  },

  onShow() {
    const session = wx.getStorageSync(SESSION_KEY);
    this.setData({
      hasSavedSession: Boolean(session),
      demoStarting: false,
      primaryButtonText: PRIMARY_BUTTON_TEXT,
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
      session = createSession();
      wx.setStorageSync(SESSION_KEY, session);
    }
    this.openPage(INTRO_URL);
  },

  onViewReport() {
    const result = wx.getStorageSync(RESULT_KEY);
    if (!result || !Array.isArray(result.routes) || result.routes.length === 0) {
      wx.showToast({
        title: "完成定位后即可查看报告",
        icon: "none",
      });
      return;
    }
    this.openPage(REPORT_URL);
  },

  onUseDemo() {
    if (this.data.demoStarting) return;
    this.setData({ demoStarting: true });
    wx.removeStorageSync(RESULT_KEY);
    wx.removeStorageSync(CONDITIONS_KEY);
    wx.removeStorageSync(PLAN_KEY);
    wx.setStorageSync(SESSION_KEY, buildDemoSession());
    wx.setStorageSync(RESULT_KEY, clone(DEMO_DATA));
    wx.setStorageSync(CONDITIONS_KEY, clone(DEMO_DATA.session.startupConditions));
    wx.setStorageSync(PLAN_KEY, clone(DEMO_DATA.plan));
    this.openPage(REPORT_URL);
  },
});

module.exports = { getResumeDestination, INTRO_URL, PRIMARY_BUTTON_TEXT };
