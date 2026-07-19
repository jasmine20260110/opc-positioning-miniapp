const assert = require("assert");

global.Page = () => {};
global.wx = {};
const {
  getResumeDestination,
  INTRO_URL,
  PRIMARY_BUTTON_TEXT,
} = require("../miniprogram/pages/index/index.js");

const result = {
  routes: [{ routeId: "A" }, { routeId: "B" }, { routeId: "C" }],
  plan: { selectedRouteId: "B" },
};
const plan = { selectedRouteId: "B" };

function main() {
  assert.deepStrictEqual(getResumeDestination(null, null, null), {
    url: "/pages/question/index",
    label: "开启定位",
  });
  assert.strictEqual(PRIMARY_BUTTON_TEXT, "开启定位");
  assert.strictEqual(INTRO_URL, "/pages/positioning-intro/index");
  assert.deepStrictEqual(getResumeDestination({
    currentStep: "questions",
    currentQuestionIndex: 2,
    answers: { Q1: "a", Q2: "b" },
  }, null, null), {
    url: "/pages/question/index",
    label: "继续第3题",
  });
  assert.deepStrictEqual(getResumeDestination({
    currentStep: "analyzing",
    answers: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`Q${index + 1}`, "回答"])),
  }, null, null), {
    url: "/pages/loading/index",
    label: "继续AI分析",
  });
  assert.deepStrictEqual(getResumeDestination({
    currentStep: "market",
    currentQuestionIndex: 19,
  }, result, null), {
    url: "/pages/report/index?mode=market",
    label: "继续查看定位结果",
  });
  assert.deepStrictEqual(getResumeDestination({
    currentStep: "startup_fit",
    currentQuestionIndex: 19,
  }, result, null), {
    url: "/pages/report/index?mode=fit",
    label: "继续查看启动适配",
  });
  assert.deepStrictEqual(getResumeDestination({
    currentStep: "plan",
    currentQuestionIndex: 19,
    selectedRouteId: "B",
  }, result, plan), {
    url: "/pages/plan/index?routeId=B",
    label: "继续7天计划",
  });

  console.log(JSON.stringify({
    success: true,
    unfinishedQuestionResume: true,
    analyzingResume: true,
    reportResume: true,
    fitResume: true,
    completedQuestionDoesNotReturnToQ20: true,
  }, null, 2));
}

main();
