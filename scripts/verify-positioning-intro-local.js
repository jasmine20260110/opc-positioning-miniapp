const assert = require("assert");

function loadPage(modulePath) {
  let pageConfig = null;
  global.Page = (config) => {
    pageConfig = config;
  };
  delete require.cache[require.resolve(modulePath)];
  const exports = require(modulePath);
  assert(pageConfig, `页面未注册：${modulePath}`);
  return { pageConfig, exports };
}

function main() {
  const storage = {};
  global.wx = {
    getStorageSync(key) {
      return storage[key];
    },
    setStorageSync(key, value) {
      storage[key] = value;
    },
  };

  const home = loadPage("../miniprogram/pages/index/index.js");
  let openedUrl = "";
  const homeContext = {
    openPage(url) {
      openedUrl = url;
    },
  };
  home.pageConfig.onStart.call(homeContext);
  assert.strictEqual(openedUrl, "/pages/positioning-intro/index");
  assert(storage.opc_mvp_session, "首页未创建问答会话");

  let redirectUrl = "";
  let redirectCount = 0;
  global.wx = {
    redirectTo({ url }) {
      redirectUrl = url;
      redirectCount += 1;
    },
    reLaunch() {},
    showModal() {},
  };

  const intro = loadPage("../miniprogram/pages/positioning-intro/index.js");
  const introContext = {
    data: { ...intro.pageConfig.data },
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
  assert.strictEqual(typeof intro.pageConfig.onShow, "undefined");
  intro.pageConfig.onEnter.call(introContext);
  assert.strictEqual(redirectUrl, "/pages/question/index?startAt=1");
  assert.strictEqual(redirectCount, 1);
  assert.strictEqual(introContext.data.entering, true);
  intro.pageConfig.onEnter.call(introContext);
  assert.strictEqual(redirectCount, 1);

  storage.opc_mvp_session = {
    sessionId: "keep-existing-answers",
    status: "in_progress",
    currentStep: "questions",
    currentIndex: 2,
    currentQuestionIndex: 2,
    answers: { Q1: "已保存的第一题回答", Q2: "已保存的第二题回答" },
    context: {},
    behavior: {},
  };
  global.wx = {
    getStorageSync(key) {
      return storage[key];
    },
    setStorageSync(key, value) {
      storage[key] = value;
    },
  };

  const question = loadPage("../miniprogram/pages/question/index.js");
  const questionContext = {
    data: { ...question.pageConfig.data },
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
    loadQuestion: question.pageConfig.loadQuestion,
  };
  question.pageConfig.onLoad.call(questionContext, { startAt: "1" });
  assert.strictEqual(questionContext.data.currentIndex, 0);
  assert.strictEqual(questionContext.data.question.questionId, "Q1");
  assert.strictEqual(storage.opc_mvp_session.answers.Q1, "已保存的第一题回答");
  assert.strictEqual(storage.opc_mvp_session.currentQuestionIndex, 0);

  console.log(JSON.stringify({
    success: true,
    homeButtonDestination: openedUrl,
    introRequiresTap: true,
    questionDestination: redirectUrl,
    questionId: questionContext.data.question.questionId,
    preservedAnswers: true,
  }, null, 2));
}

main();
