const assert = require("assert");
const { SAMPLE_ANSWERS } = require("../miniprogram/utils/demoData");

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function loadLoadingPage(wxMock) {
  let definition;
  global.wx = wxMock;
  global.Page = (value) => {
    definition = value;
  };
  delete require.cache[require.resolve("../miniprogram/pages/loading/index.js")];
  require("../miniprogram/pages/loading/index.js");
  return {
    ...definition,
    data: clone(definition.data),
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
}

async function main() {
  const session = {
    sessionId: "loading-retry-local",
    currentStep: "analyzing",
    currentQuestionIndex: 19,
    answers: clone(SAMPLE_ANSWERS),
  };
  const storage = new Map([["opc_mvp_session", clone(session)]]);
  const calls = { cloud: 0, reLaunch: [] };
  const page = loadLoadingPage({
    cloud: {
      async callFunction() {
        calls.cloud += 1;
        return {
          result: {
            ok: false,
            error: {
              code: "AI_TIMEOUT",
              message: "AI分析超时",
              retryable: true,
            },
          },
        };
      },
    },
    getStorageSync(key) {
      return clone(storage.get(key));
    },
    setStorageSync(key, value) {
      storage.set(key, clone(value));
    },
    reLaunch(options) {
      calls.reLaunch.push(options.url);
    },
    redirectTo() {},
  });

  page.onLoad();
  await flushPromises();
  assert.strictEqual(calls.cloud, 1, "首次分析没有发起请求");
  assert.strictEqual(page.data.manualRetryCount, 0);

  for (let retry = 1; retry <= 3; retry += 1) {
    page.onRetry();
    await flushPromises();
    assert.strictEqual(page.data.manualRetryCount, retry);
  }

  assert.strictEqual(calls.cloud, 4, "首次请求加3次手动重试的次数不正确");
  assert.strictEqual(page.data.retryLimitReached, true);
  assert.strictEqual(
    page.data.errorAction,
    "AI 分析已重试3次，建议稍后再试，请点击稍后返回首页，系统会保留全部答案并跳转至首页",
  );

  page.onRetry();
  await flushPromises();
  assert.strictEqual(calls.cloud, 4, "达到上限后仍发起了请求");

  page.onReturnHome();
  assert.strictEqual(Object.keys(storage.get("opc_mvp_session").answers).length, 20);
  assert.deepStrictEqual(calls.reLaunch, ["/pages/index/index"]);

  console.log(JSON.stringify({
    success: true,
    automaticRetriesPerRequest: 2,
    manualRetryLimit: 3,
    requestStoppedAfterLimit: true,
    answersPreserved: true,
    returnedHome: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
