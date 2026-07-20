const assert = require("assert");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadIndexPage(wxMock) {
  let definition;
  global.wx = wxMock;
  global.Page = (value) => {
    definition = value;
  };
  delete require.cache[require.resolve("../miniprogram/pages/index/index.js")];
  require("../miniprogram/pages/index/index.js");
  return {
    ...definition,
    data: clone(definition.data),
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
}

function createWxMock({ navigateFails = false, relaunchFails = false } = {}) {
  const storage = new Map([
    ["opc_mvp_result", { old: true }],
    ["opc_mvp_conditions", { old: true }],
    ["opc_mvp_plan", { old: true }],
  ]);
  const calls = { navigateTo: [], reLaunch: [], modal: null };
  return {
    storage,
    calls,
    api: {
      getStorageSync(key) {
        return storage.get(key);
      },
      setStorageSync(key, value) {
        storage.set(key, clone(value));
      },
      removeStorageSync(key) {
        storage.delete(key);
      },
      navigateTo({ url, fail }) {
        calls.navigateTo.push(url);
        if (navigateFails && fail) fail({ errMsg: "navigate failed" });
      },
      reLaunch({ url, fail }) {
        calls.reLaunch.push(url);
        if (relaunchFails && fail) fail({ errMsg: "relaunch failed" });
      },
      showModal(options) {
        calls.modal = options;
      },
    },
  };
}

function main() {
  const normal = createWxMock();
  const normalPage = loadIndexPage(normal.api);
  normalPage.onUseDemo();
  const session = normal.storage.get("opc_mvp_session");
  assert.strictEqual(session.demoMode, true);
  assert.strictEqual(Object.keys(session.answers).length, 20);
  assert.strictEqual(normal.storage.get("opc_mvp_result").routes.length, 3);
  assert.strictEqual(normal.storage.get("opc_mvp_conditions").weeklyAvailableTime, "7—14小时");
  assert.strictEqual(normal.storage.get("opc_mvp_plan").days.length, 7);
  assert.deepStrictEqual(normal.calls.navigateTo, ["/pages/report/index?mode=evidence"]);
  assert.strictEqual(normalPage.data.demoStarting, true);

  const fallback = createWxMock({ navigateFails: true });
  const fallbackPage = loadIndexPage(fallback.api);
  fallbackPage.onUseDemo();
  assert.deepStrictEqual(fallback.calls.navigateTo, ["/pages/report/index?mode=evidence"]);
  assert.deepStrictEqual(fallback.calls.reLaunch, ["/pages/report/index?mode=evidence"]);
  assert.strictEqual(fallback.calls.modal, null);

  const failed = createWxMock({ navigateFails: true, relaunchFails: true });
  const failedPage = loadIndexPage(failed.api);
  failedPage.onUseDemo();
  assert.strictEqual(failedPage.data.demoStarting, false);
  assert.strictEqual(failed.calls.modal.title, "页面打开失败");

  console.log(JSON.stringify({
    success: true,
    demoRouteCount: normal.storage.get("opc_mvp_result").routes.length,
    defaultDataLoaded: true,
    navigateFallbackVerified: true,
    visibleFailureFeedbackVerified: true,
  }, null, 2));
}

main();
