const { DEMO_DATA } = require("../../utils/demoData");
const { callAnalysisAction } = require("../../utils/analysisService");
const { PLAN_KEY, buildFixedPlan } = require("../../utils/fixedPlan");
const { calculateStartupFit } = require("../../utils/startupFitRules");

const RESULT_KEY = "opc_mvp_result";
const SESSION_KEY = "opc_mvp_session";
const CONDITIONS_KEY = "opc_mvp_conditions";

const MODE_META = {
  evidence: {
    step: "第二步 · AI证据提取",
    title: "先看依据，再看方向",
    subtitle: "以下结论来自你的原始回答；推测和缺口会被单独标记。",
  },
  market: {
    step: "第三步 · 市场机会分析",
    title: "三条路线，分别值得怎么验证？",
    subtitle: "Demo不接外部市场数据库，因此无法确认的市场判断会显示“待验证”。",
  },
  startup: {
    step: "第四步 · 启动条件确认",
    title: "什么方向适合现在的你？",
    subtitle: "确认4项现实条件，预计30—60秒。第20题的时间答案会自动预填。",
  },
  fit: {
    step: "第四步 · 个人启动适配",
    title: "不是最好，而是现在更容易开始",
    subtitle: "固定规则比较4项现实条件；页面不展示内部精确分数。",
  },
};

const STATUS_CLASS = {
  当前满足: "green",
  可以补足: "yellow",
  明显冲突: "red",
  待验证: "gray",
  优先验证: "green",
  补足后验证: "yellow",
  暂缓: "red",
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeConditions(result, session, storedRecord) {
  const defaults = result.session && result.session.startupConditions
    ? result.session.startupConditions
    : {};
  const stored = storedRecord
    && storedRecord.sessionId === session.sessionId
    && storedRecord.values
    ? storedRecord.values
    : {};

  return {
    incomeFloor: {
      latestFirstRevenue: "3个月内",
      minimumMeaningfulAmount: "100—1000元",
      ...(defaults.incomeFloor || {}),
      ...(stored.incomeFloor || {}),
    },
    weeklyAvailableTime: stored.weeklyAvailableTime
      || (session.context && session.context.weeklyAvailableTime)
      || defaults.weeklyAvailableTime
      || "3—7小时",
    reachableUsersByRoute: {
      A: "0人",
      B: "0人",
      C: "0人",
      ...(defaults.reachableUsersByRoute || {}),
      ...(stored.reachableUsersByRoute || {}),
    },
    validationResources: {
      budget: "0元",
      supplementMethod: "更愿意投入时间",
      ...(defaults.validationResources || {}),
      ...(stored.validationResources || {}),
    },
  };
}

function decorateRoute(route) {
  const market = route.marketOpportunity;
  const startupFit = route.startupFit || { dimensions: [], result: "待验证" };
  return {
    ...route,
    marketRows: [
      {
        label: "付费市场成熟度",
        value: market.paidMarketMaturity.result,
        basis: market.paidMarketMaturity.basis,
      },
      {
        label: "竞品与差异化",
        value: market.competitorAndDifferentiation.result,
        basis: market.competitorAndDifferentiation.basis,
      },
      {
        label: "需求证据强度",
        value: market.demandEvidenceStrength.result,
        basis: market.demandEvidenceStrength.basis,
      },
      {
        label: "主要获客渠道",
        value: market.acquisitionChannel.result,
        basis: market.acquisitionChannel.basis,
      },
      {
        label: "首笔变现预期",
        value: `${market.firstRevenueExpectation.cycle} · ${market.firstRevenueExpectation.amountRange}`,
        basis: market.firstRevenueExpectation.basis,
      },
    ],
    fitDimensions: startupFit.dimensions.map((dimension) => ({
      ...dimension,
      statusClass: STATUS_CLASS[dimension.status] || "gray",
    })),
    fitResultClass: STATUS_CLASS[startupFit.result] || "gray",
  };
}

Page({
  data: {
    mode: "evidence",
    meta: MODE_META.evidence,
    evidence: {},
    routes: [],
    conditions: {},
    latestRevenueOptions: ["1个月内", "3个月内", "6个月内", "可以更久"],
    amountOptions: ["100元以内", "100—1000元", "1000—5000元", "5000元以上"],
    weeklyTimeOptions: ["少于3小时", "3—7小时", "7—14小时", "14小时以上"],
    reachableOptions: ["0人", "1—5人", "6—20人", "20人以上"],
    budgetOptions: ["0元", "500元以内", "500—3000元", "3000元以上"],
    supplementOptions: ["愿意花钱", "更愿意投入时间", "可以找人合作", "暂时不补足"],
    routeSelectionBusy: false,
    generatingRouteId: "",
  },

  onLoad(options) {
    const result = wx.getStorageSync(RESULT_KEY) || DEMO_DATA;
    const session = wx.getStorageSync(SESSION_KEY) || {};
    const storedConditions = wx.getStorageSync(CONDITIONS_KEY) || {};
    this.result = clone(result);
    const conditions = mergeConditions(this.result, session, storedConditions);
    this.fitCalculated = Boolean(
      session.behavior
      && session.behavior.startupFitViewed
      && this.result.routes.every((route) => route.startupFit),
    );
    const requestedMode = options.mode || "evidence";
    if (requestedMode === "fit" && this.fitCalculated) {
      this.result.routes = calculateStartupFit(this.result.routes, conditions);
      wx.setStorageSync(RESULT_KEY, this.result);
    }
    this.setData({
      evidence: this.result.evidence,
      routes: this.result.routes.map(decorateRoute),
      conditions,
    });
    this.setMode(requestedMode === "fit" && !this.fitCalculated ? "startup" : requestedMode);
  },

  setMode(mode) {
    const safeMode = MODE_META[mode] ? mode : "evidence";
    this.setData({ mode: safeMode, meta: MODE_META[safeMode] });
    const session = wx.getStorageSync(SESSION_KEY) || {};
    session.currentStep = safeMode === "fit" ? "startup_fit" : safeMode;
    session.updatedAt = new Date().toISOString();
    wx.setStorageSync(SESSION_KEY, session);
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  persistConditions() {
    const session = wx.getStorageSync(SESSION_KEY) || {};
    const values = clone(this.data.conditions);
    session.startupConditions = values;
    session.updatedAt = new Date().toISOString();
    wx.setStorageSync(SESSION_KEY, session);
    wx.setStorageSync(CONDITIONS_KEY, {
      sessionId: session.sessionId,
      values,
      updatedAt: session.updatedAt,
    });
  },

  onEditAnswers() {
    wx.navigateBack({ delta: 1 });
  },

  onShowMarket() {
    this.setMode("market");
  },

  onShowStartup() {
    this.setMode("startup");
  },

  onShowFit() {
    this.persistConditions();
    this.result.routes = calculateStartupFit(this.result.routes, this.data.conditions);
    this.result.session = this.result.session || {};
    this.result.session.startupConditions = clone(this.data.conditions);
    wx.setStorageSync(RESULT_KEY, this.result);

    const session = wx.getStorageSync(SESSION_KEY) || {};
    session.currentStep = "startup_fit";
    session.startupConditions = clone(this.data.conditions);
    session.behavior = session.behavior || {};
    session.behavior.startupFitViewed = true;
    session.behavior.startupFitViewedAt = new Date().toISOString();
    session.updatedAt = session.behavior.startupFitViewedAt;
    wx.setStorageSync(SESSION_KEY, session);

    this.fitCalculated = true;
    this.setData({ routes: this.result.routes.map(decorateRoute) });
    this.setMode("fit");
  },

  onBackEvidence() {
    this.setMode("evidence");
  },

  onBackMarket() {
    this.setMode("market");
  },

  onBackStartup() {
    this.setMode("startup");
  },

  onRevenueCycleChange(e) {
    this.setData({
      "conditions.incomeFloor.latestFirstRevenue": this.data.latestRevenueOptions[e.detail.value],
    }, () => this.persistConditions());
  },

  onRevenueAmountChange(e) {
    this.setData({
      "conditions.incomeFloor.minimumMeaningfulAmount": this.data.amountOptions[e.detail.value],
    }, () => this.persistConditions());
  },

  onWeeklyTimeChange(e) {
    this.setData({
      "conditions.weeklyAvailableTime": this.data.weeklyTimeOptions[e.detail.value],
    }, () => this.persistConditions());
  },

  onReachableChange(e) {
    const routeId = e.currentTarget.dataset.route;
    this.setData({
      [`conditions.reachableUsersByRoute.${routeId}`]: this.data.reachableOptions[e.detail.value],
    }, () => this.persistConditions());
  },

  onBudgetChange(e) {
    this.setData({
      "conditions.validationResources.budget": this.data.budgetOptions[e.detail.value],
    }, () => this.persistConditions());
  },

  onSupplementChange(e) {
    this.setData({
      "conditions.validationResources.supplementMethod": this.data.supplementOptions[e.detail.value],
    }, () => this.persistConditions());
  },

  onSelectRoute(e) {
    if (this.data.routeSelectionBusy) return;
    const session = wx.getStorageSync(SESSION_KEY) || {};
    if (!this.fitCalculated || !session.behavior || !session.behavior.startupFitViewed) {
      wx.showToast({ title: "请先生成并查看启动适配", icon: "none" });
      return;
    }

    const routeId = e.currentTarget.dataset.route;
    const route = this.result.routes.find((item) => item.routeId === routeId);
    if (!route) {
      wx.showToast({ title: "路线不存在，请重新选择", icon: "none" });
      return;
    }

    this.generatePlanAndNavigate({ routeId, route, session });
  },

  async generatePlanAndNavigate({ routeId, route, session }) {
    this.setData({ routeSelectionBusy: true, generatingRouteId: routeId });
    wx.showLoading({ title: "正在生成7天计划", mask: true });

    let plan;
    let usedFallback = false;
    try {
      if (this.result.demoMode) {
        plan = buildFixedPlan(route, this.data.conditions);
      } else {
        const planResult = await callAnalysisAction("generatePlan", {
          selectedRoute: clone(route),
          startupConditions: clone(this.data.conditions),
        });
        plan = {
          ...planResult.plan,
          aiMeta: planResult.aiMeta,
        };
      }
    } catch (error) {
      usedFallback = true;
      plan = buildFixedPlan(route, this.data.conditions);
      plan.fallbackReason = error && error.code ? error.code : "AI_PLAN_FAILED";
    } finally {
      wx.hideLoading();
      this.setData({ routeSelectionBusy: false, generatingRouteId: "" });
    }

    const routeChanged = session.selectedRouteId && session.selectedRouteId !== routeId;
    session.selectedRouteId = routeId;
    session.currentStep = "plan";
    session.startupConditions = clone(this.data.conditions);
    session.behavior = session.behavior || {};
    if (routeChanged) {
      session.behavior.day1Started = false;
      session.behavior.day1StartedAt = "";
      session.behavior.day1RouteId = "";
    }
    session.updatedAt = new Date().toISOString();

    plan.sessionId = session.sessionId;
    plan.day1Started = Boolean(
      session.behavior.day1Started
      && session.behavior.day1RouteId === routeId,
    );
    plan.day1StartedAt = plan.day1Started ? session.behavior.day1StartedAt : "";

    this.result.plan = plan;
    this.result.session = this.result.session || {};
    this.result.session.selectedRouteId = routeId;
    this.result.session.currentStep = "plan";
    this.result.session.behavior = clone(session.behavior);
    wx.setStorageSync(SESSION_KEY, session);
    wx.setStorageSync(RESULT_KEY, this.result);
    wx.setStorageSync(PLAN_KEY, plan);
    wx.navigateTo({
      url: `/pages/plan/index?routeId=${routeId}`,
      success: () => {
        if (usedFallback) {
          wx.showToast({ title: "AI计划生成失败，已使用本地计划", icon: "none" });
        }
      },
    });
  },

  onSkipSelection() {
    const session = wx.getStorageSync(SESSION_KEY) || {};
    session.currentStep = "startup_fit";
    session.updatedAt = new Date().toISOString();
    wx.setStorageSync(SESSION_KEY, session);
    wx.showToast({ title: "已保留结果，可以稍后再选", icon: "none" });
  },
});
