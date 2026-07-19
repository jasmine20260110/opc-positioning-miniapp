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
  const calls = { navigateTo: 0, reLaunch: 0, modal: null };
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
      navigateTo({ fail }) {
        calls.navigateTo += 1;
        if (navigateFails && fail) fail({ errMsg: "navigate failed" });
      },
      reLaunch({ fail }) {
        calls.reLaunch += 1;
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
  assert.strictEqual(normal.storage.has("opc_mvp_result"), false);
  assert.strictEqual(normal.storage.has("opc_mvp_conditions"), false);
  assert.strictEqual(normal.storage.has("opc_mvp_plan"), false);
  assert.strictEqual(normal.calls.navigateTo, 1);
  assert.strictEqual(normalPage.data.demoStarting, true);

  const fallback = createWxMock({ navigateFails: true });
  const fallbackPage = loadIndexPage(fallback.api);
  fallbackPage.onUseDemo();
  assert.strictEqual(fallback.calls.navigateTo, 1);
  assert.strictEqual(fallback.calls.reLaunch, 1);
  assert.strictEqual(fallback.calls.modal, null);

  const failed = createWxMock({ navigateFails: true, relaunchFails: true });
  const failedPage = loadIndexPage(failed.api);
  failedPage.onUseDemo();
  assert.strictEqual(failedPage.data.demoStarting, false);
  assert.strictEqual(failed.calls.modal.title, "页面打开失败");

  console.log(JSON.stringify({
    success: true,
    demoAnswerCount: Object.keys(session.answers).length,
    staleDataCleared: true,
    navigateFallbackVerified: true,
    visibleFailureFeedbackVerified: true,
  }, null, 2));
}

main();
