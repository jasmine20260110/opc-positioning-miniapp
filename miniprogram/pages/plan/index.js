const { DEMO_DATA } = require("../../utils/demoData");
const { PLAN_KEY, buildFixedPlan } = require("../../utils/fixedPlan");

const RESULT_KEY = "opc_mvp_result";
const SESSION_KEY = "opc_mvp_session";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

Page({
  data: {
    route: {},
    plan: {},
    day1Started: false,
    planSourceLabel: "",
  },

  onLoad(options) {
    const result = clone(wx.getStorageSync(RESULT_KEY) || DEMO_DATA);
    const session = wx.getStorageSync(SESSION_KEY) || {};
    const routeId = options.routeId || session.selectedRouteId || result.session.selectedRouteId || "A";
    const route = result.routes.find((item) => item.routeId === routeId) || result.routes[0];
    const storedPlan = wx.getStorageSync(PLAN_KEY);
    const plan = storedPlan && storedPlan.selectedRouteId === route.routeId
      ? storedPlan
      : buildFixedPlan(route, session.startupConditions || result.session.startupConditions);

    plan.sessionId = plan.sessionId || session.sessionId;
    const day1Started = Boolean(
      session.behavior
      && session.behavior.day1Started
      && session.behavior.day1RouteId === route.routeId,
    );
    plan.day1Started = day1Started;
    plan.day1StartedAt = day1Started ? session.behavior.day1StartedAt : "";

    if (!storedPlan || storedPlan.selectedRouteId !== route.routeId) {
      wx.setStorageSync(PLAN_KEY, plan);
    }

    this.routeId = route.routeId;
    this.setData({
      route,
      plan,
      day1Started,
      planSourceLabel: plan.source === "ai_generated"
        ? "本计划由DeepSeek V4 Flash根据所选路线和启动条件生成。"
        : "AI计划暂不可用，当前展示可继续执行的本地固定计划。",
    });
  },

  onStartDay1() {
    if (this.data.day1Started) return;
    const startedAt = new Date().toISOString();
    const session = wx.getStorageSync(SESSION_KEY) || {};
    const result = clone(wx.getStorageSync(RESULT_KEY) || DEMO_DATA);
    const plan = clone(this.data.plan);

    session.behavior = session.behavior || {};
    session.behavior.day1Started = true;
    session.behavior.day1StartedAt = startedAt;
    session.behavior.day1RouteId = this.routeId;
    session.currentStep = "plan";
    session.updatedAt = startedAt;

    plan.day1Started = true;
    plan.day1StartedAt = startedAt;
    result.plan = plan;
    result.session = result.session || {};
    result.session.selectedRouteId = this.routeId;
    result.session.currentStep = "plan";
    result.session.behavior = clone(session.behavior);
    result.session.updatedAt = startedAt;

    wx.setStorageSync(SESSION_KEY, session);
    wx.setStorageSync(PLAN_KEY, plan);
    wx.setStorageSync(RESULT_KEY, result);
    this.setData({ plan, day1Started: true });

    const firstAction = plan.days && plan.days[0] && plan.days[0].minimumAction;
    wx.showModal({
      title: "Day 1 已开始",
      content: firstAction
        ? `已记录在本机。今天先完成：${firstAction}`
        : "已记录在本机，可以开始执行今天的最小行动。",
      showCancel: false,
      confirmText: "开始行动",
    });
  },

  onBackToRoutes() {
    const url = "/pages/report/index?mode=fit";
    wx.redirectTo({
      url,
      fail: () => wx.reLaunch({ url }),
    });
  },

  onOpenFeedback() {
    wx.navigateTo({
      url: `/pages/feedback/index?routeId=${this.routeId}`,
      fail: () => {
        wx.showModal({
          title: "暂时无法打开反馈页",
          content: "请稍后重试。",
          showCancel: false,
        });
      },
    });
  },
});
