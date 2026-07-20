const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DEMO_DATA } = require("../miniprogram/utils/demoData");

const FEEDBACK_PAGE_PATH = path.join(__dirname, "../miniprogram/pages/feedback/index.js");
const FEEDBACK_WXML_PATH = path.join(__dirname, "../miniprogram/pages/feedback/index.wxml");
const PLAN_WXML_PATH = path.join(__dirname, "../miniprogram/pages/plan/index.wxml");
const APP_JSON_PATH = path.join(__dirname, "../miniprogram/app.json");

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function setNestedValue(target, key, value) {
  const parts = key.split(".");
  let current = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    current[parts[index]] = current[parts[index]] || {};
    current = current[parts[index]];
  }
  current[parts[parts.length - 1]] = value;
}

function createWxMock() {
  const session = clone(DEMO_DATA.session);
  session.sessionId = "feedback-local-test";
  session.selectedRouteId = "B";
  session.behavior = {};
  const result = clone(DEMO_DATA);
  result.session.sessionId = session.sessionId;
  result.session.selectedRouteId = "B";

  const storage = new Map([
    ["opc_mvp_session", session],
    ["opc_mvp_result", result],
  ]);
  const calls = { toasts: [], navigateBack: 0, redirectTo: 0 };

  return {
    storage,
    calls,
    api: {
      getStorageSync(key) {
        return clone(storage.get(key));
      },
      setStorageSync(key, value) {
        storage.set(key, clone(value));
      },
      showToast(options) {
        calls.toasts.push(options);
      },
      navigateBack() {
        calls.navigateBack += 1;
      },
      redirectTo() {
        calls.redirectTo += 1;
      },
    },
  };
}

function loadFeedbackPage(wxMock) {
  let definition;
  global.wx = wxMock;
  global.Page = (value) => {
    definition = value;
  };
  delete require.cache[require.resolve(FEEDBACK_PAGE_PATH)];
  require(FEEDBACK_PAGE_PATH);
  const page = {
    ...definition,
    data: clone(definition.data),
    setData(patch) {
      Object.entries(patch).forEach(([key, value]) => setNestedValue(this.data, key, value));
    },
  };
  page.onLoad({ routeId: "B" });
  return page;
}

function main() {
  const feedbackWxml = fs.readFileSync(FEEDBACK_WXML_PATH, "utf8");
  const planWxml = fs.readFileSync(PLAN_WXML_PATH, "utf8");
  const appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, "utf8"));
  const requiredQuestions = [
    "这三个方向中，有没有哪个最打动你？",
    "这条为什么打动你？",
    "如果对整体使用体验，打个分（0-10分，分值越大体验越好），你打几分？",
    "你现在是否愿意执行Day1？",
    "其他建议",
  ];
  requiredQuestions.forEach((question) => assert(feedbackWxml.includes(question), `反馈页缺少问题：${question}`));
  assert.strictEqual((feedbackWxml.match(/<textarea/g) || []).length, 5, "5个问题都应使用文本输入框");
  assert(!feedbackWxml.includes("option-button"), "反馈页不应再包含选择按钮");
  assert(!feedbackWxml.includes("score-grid"), "反馈页不应再包含评分选项");
  assert(planWxml.includes('bindtap="onOpenFeedback">填写反馈</button>'), "计划页缺少填写反馈入口");
  assert(appJson.pages.includes("pages/feedback/index"), "app.json没有注册反馈页");

  const wxMock = createWxMock();
  const page = loadFeedbackPage(wxMock.api);

  page.onSubmit();
  assert.strictEqual(wxMock.calls.toasts.at(-1).title, "请填写最打动你的方向");

  page.onMostResonantDirectionInput({ detail: { value: "  路线A · 思维整理师  " } });
  page.onResonanceReasonInput({ detail: { value: "  因为它最符合我的经历。  " } });
  page.onExperienceFeedbackInput({ detail: { value: "  8分，整体清晰。  " } });
  page.onDay1WillingnessInput({ detail: { value: "  愿意，但需要控制在30分钟内。  " } });
  page.onOtherSuggestionsInput({ detail: { value: "  希望说明更短。  " } });

  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (callback) => {
    callback();
    return 1;
  };
  try {
    page.onSubmit();
  } finally {
    global.setTimeout = originalSetTimeout;
  }

  const records = wxMock.storage.get("opc_mvp_feedbacks");
  const feedback = records["feedback-local-test"];
  assert.strictEqual(feedback.schemaVersion, "feedback-v2");
  assert.strictEqual(feedback.mostResonantDirection, "路线A · 思维整理师");
  assert.strictEqual(feedback.resonanceReason, "因为它最符合我的经历。");
  assert.strictEqual(feedback.experienceFeedback, "8分，整体清晰。");
  assert.strictEqual(feedback.otherSuggestions, "希望说明更短。");
  assert.strictEqual(feedback.day1Willingness, "愿意，但需要控制在30分钟内。");
  assert.strictEqual(wxMock.calls.navigateBack, 1, "提交后没有返回计划页");

  const storedSession = wxMock.storage.get("opc_mvp_session");
  assert(storedSession.behavior.feedbackSubmittedAt, "会话没有记录反馈提交时间");

  const restoredPage = loadFeedbackPage(wxMock.api);
  assert.strictEqual(restoredPage.data.form.mostResonantDirection, "路线A · 思维整理师");
  assert.strictEqual(restoredPage.data.form.experienceFeedback, "8分，整体清晰。");
  assert.strictEqual(restoredPage.data.form.otherSuggestions, "希望说明更短。");

  console.log(JSON.stringify({
    success: true,
    feedbackEntryRegistered: true,
    questionCount: requiredQuestions.length,
    allQuestionsAreFreeText: true,
    requiredValidationVerified: true,
    localPersistenceVerified: true,
    restoreVerified: true,
  }, null, 2));
}

main();
