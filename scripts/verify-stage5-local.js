const assert = require("assert");
const { DEMO_DATA } = require("../miniprogram/utils/demoData");
const { calculateStartupFit } = require("../miniprogram/utils/startupFitRules");

const SESSION_KEY = "opc_mvp_session";
const RESULT_KEY = "opc_mvp_result";
const PLAN_KEY = "opc_mvp_plan";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setByPath(target, path, value) {
  const keys = path.split(".");
  let cursor = target;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] = cursor[key] || {};
    cursor = cursor[key];
  });
  cursor[keys[keys.length - 1]] = value;
}

function createPageInstance(definition) {
  const instance = {
    ...definition,
    data: clone(definition.data),
    setData(patch, callback) {
      Object.entries(patch).forEach(([path, value]) => setByPath(this.data, path, value));
      if (callback) callback();
    },
  };
  return instance;
}

function loadPageDefinition(modulePath) {
  let definition;
  global.Page = (value) => {
    definition = value;
  };
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  return definition;
}

async function waitFor(condition, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("等待页面异步操作超时");
}

async function main() {
  const duplicatedRequirementRoutes = clone(DEMO_DATA.routes);
  duplicatedRequirementRoutes.forEach((route) => {
    route.launchRequirements = clone(DEMO_DATA.routes[0].launchRequirements);
  });
  const sameReachableConditions = clone(DEMO_DATA.session.startupConditions);
  sameReachableConditions.reachableUsersByRoute = { A: "0人", B: "0人", C: "0人" };
  const differentiatedFits = calculateStartupFit(duplicatedRequirementRoutes, sameReachableConditions);
  assert.strictEqual(new Set(differentiatedFits.map((route) => route.startupFit.conclusion)).size, 3);
  assert.strictEqual(new Set(differentiatedFits.map((route) => route.startupFit.maxGap)).size, 3);
  assert.strictEqual(new Set(differentiatedFits.map((route) => route.startupFit.recommendation)).size, 3);

  const storage = new Map();
  const ui = { navigationUrl: "", toast: "", modal: null, loading: false };
  let cloudShouldFail = false;

  global.wx = {
    cloud: {
      async callFunction({ data }) {
        if (cloudShouldFail) {
          return {
            result: {
              ok: false,
              error: { code: "AI_TIMEOUT", message: "AI分析超时", retryable: true },
            },
          };
        }
        const route = data.payload.selectedRoute;
        const plan = clone(DEMO_DATA.plan);
        plan.source = "ai_generated";
        plan.selectedRouteId = route.routeId;
        plan.planName = `7天验证计划：${route.routeName}`;
        return {
          result: {
            ok: true,
            data: {
              plan,
              aiMeta: { label: "generatePlan", model: "deepseek-v4-flash", attempts: 1 },
            },
          },
        };
      },
    },
    getStorageSync(key) {
      return storage.has(key) ? clone(storage.get(key)) : undefined;
    },
    setStorageSync(key, value) {
      storage.set(key, clone(value));
    },
    pageScrollTo() {},
    showLoading() {
      ui.loading = true;
    },
    hideLoading() {
      ui.loading = false;
    },
    showToast({ title }) {
      ui.toast = title;
    },
    showModal(options) {
      ui.modal = options;
    },
    navigateTo({ url, success }) {
      ui.navigationUrl = url;
      if (success) success();
    },
    redirectTo({ url }) {
      ui.navigationUrl = url;
    },
    reLaunch({ url }) {
      ui.navigationUrl = url;
    },
    navigateBack() {},
  };

  const result = clone(DEMO_DATA);
  result.demoMode = false;
  const session = clone(DEMO_DATA.session);
  session.sessionId = "stage5-local-test";
  session.selectedRouteId = null;
  session.behavior = { startupFitViewed: true };
  storage.set(RESULT_KEY, result);
  storage.set(SESSION_KEY, session);

  const reportDefinition = loadPageDefinition("../miniprogram/pages/report/index.js");
  const reportPage = createPageInstance(reportDefinition);
  reportPage.onLoad({ mode: "fit" });
  reportPage.onSelectRoute({ currentTarget: { dataset: { route: "B" } } });
  await waitFor(() => ui.navigationUrl.includes("/pages/plan/index"));

  const aiPlan = storage.get(PLAN_KEY);
  assert.strictEqual(aiPlan.source, "ai_generated");
  assert.strictEqual(aiPlan.selectedRouteId, "B");
  assert.strictEqual(aiPlan.days.length, 7);
  assert.strictEqual(ui.loading, false);

  const planDefinition = loadPageDefinition("../miniprogram/pages/plan/index.js");
  const planPage = createPageInstance(planDefinition);
  planPage.onLoad({ routeId: "B" });
  assert.strictEqual(planPage.data.day1Started, false);
  planPage.onStartDay1();

  const startedSession = storage.get(SESSION_KEY);
  const startedPlan = storage.get(PLAN_KEY);
  assert.strictEqual(startedSession.behavior.day1Started, true);
  assert.strictEqual(startedSession.behavior.day1RouteId, "B");
  assert.ok(startedSession.behavior.day1StartedAt);
  assert.strictEqual(startedPlan.day1Started, true);
  assert.strictEqual(planPage.data.day1Started, true);
  assert.strictEqual(ui.modal.title, "Day 1 已开始");

  const reopenedPlanPage = createPageInstance(planDefinition);
  reopenedPlanPage.onLoad({ routeId: "B" });
  assert.strictEqual(reopenedPlanPage.data.day1Started, true);

  cloudShouldFail = true;
  ui.navigationUrl = "";
  ui.toast = "";
  const fallbackSession = storage.get(SESSION_KEY);
  fallbackSession.behavior.startupFitViewed = true;
  storage.set(SESSION_KEY, fallbackSession);
  const fallbackReportPage = createPageInstance(reportDefinition);
  fallbackReportPage.onLoad({ mode: "fit" });
  fallbackReportPage.onSelectRoute({ currentTarget: { dataset: { route: "C" } } });
  await waitFor(() => ui.navigationUrl.includes("routeId=C"));

  const fallbackPlan = storage.get(PLAN_KEY);
  assert.strictEqual(fallbackPlan.source, "fixed_local_fallback");
  assert.strictEqual(fallbackPlan.selectedRouteId, "C");
  assert.strictEqual(fallbackPlan.days.length, 7);
  assert.strictEqual(fallbackPlan.fallbackReason, "AI_TIMEOUT");
  assert.strictEqual(ui.toast, "AI计划生成失败，已使用本地计划");

  console.log(JSON.stringify({
    success: true,
    aiPlanGenerated: true,
    aiPlanDayCount: aiPlan.days.length,
    day1StartPersisted: true,
    day1StateRestored: true,
    fallbackPlanGenerated: true,
    fallbackPlanDayCount: fallbackPlan.days.length,
    duplicatedRequirementsStillDifferentiated: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
