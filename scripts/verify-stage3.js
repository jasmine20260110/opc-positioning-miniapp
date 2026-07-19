const automator = require(process.env.MINIPROGRAM_AUTOMATOR_PATH);

const SESSION_KEY = "opc_mvp_session";
const ABSTRACT_HINT = "建议补充一个最近发生的具体经历；你也可以继续下一题。";
const Q20_ANSWER = "1—2小时（早晚或周末）";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function currentQuestionPage(miniProgram) {
  const page = await miniProgram.currentPage();
  assert(page.path === "pages/question/index", `当前不是问答页：${page.path}`);
  return page;
}

async function fillCurrentQuestion(page, index) {
  const question = await page.data("question");
  assert(question.questionId === `Q${index + 1}`, `题号错位：${question.questionId}`);

  if (question.questionType === "text") {
    await page.callMethod("onTextInput", {
      detail: { value: `第${index + 1}题的具体测试回答，包含最近发生的真实经历和我的关键作用。` },
    });
  } else if (question.questionType === "choice") {
    const value = question.questionId === "Q20" ? Q20_ANSWER : question.options[0];
    await page.callMethod("onSelectOption", {
      currentTarget: { dataset: { value } },
    });
  } else {
    await page.callMethod("onSelectOption", {
      currentTarget: { dataset: { value: question.options[0] } },
    });
    await page.callMethod("onDetailInput", {
      detail: { value: "我愿意先访谈三位目标用户验证付费意愿。" },
    });
  }
}

async function main() {
  const miniProgram = await automator.connect({
    wsEndpoint: process.env.WECHAT_AUTOMATION_WS,
  });
  const exceptions = [];
  const errorLogs = [];
  miniProgram.on("exception", (error) => exceptions.push(error));
  miniProgram.on("console", (entry) => {
    if (entry && (entry.type === "error" || entry.level === "error")) errorLogs.push(entry);
  });

  try {
    await miniProgram.callWxMethod("clearStorageSync");
    let page = await miniProgram.reLaunch("/pages/index/index");
    await page.callMethod("onStart");
    await sleep(1600);
    page = await currentQuestionPage(miniProgram);

    await page.callMethod("onTextInput", { detail: { value: "不知道" } });
    assert((await page.data("suggestion")) === ABSTRACT_HINT, "抽象回答没有显示固定建议");
    let session = await miniProgram.callWxMethod("getStorageSync", SESSION_KEY);
    assert(session.answers.Q1 === "不知道", "Q1输入后没有立即保存");

    await page.callMethod("onTextInput", {
      detail: { value: "我最近持续整理AI工具，并把复杂步骤讲给小白照着完成。" },
    });
    assert((await page.data("suggestion")) === "", "具体回答后提示没有消失");

    await page.callMethod("onNext");
    await page.callMethod("onTextInput", {
      detail: { value: "我整理AI工作流时经常忘记时间，结束后仍想继续优化。" },
    });
    await page.callMethod("onNext");
    await page.callMethod("onTextInput", {
      detail: { value: "这是尚未点击下一题就退出的Q3草稿。" },
    });

    await miniProgram.reLaunch("/pages/index/index");
    page = await miniProgram.currentPage();
    await page.callMethod("onStart");
    await sleep(1600);
    page = await currentQuestionPage(miniProgram);
    assert((await page.data("currentIndex")) === 2, "退出重开后没有恢复到Q3");
    assert((await page.data("answer")) === "这是尚未点击下一题就退出的Q3草稿。", "Q3草稿没有恢复");

    for (let index = 2; index < 20; index += 1) {
      await fillCurrentQuestion(page, index);
      if (index < 19) await page.callMethod("onNext");
    }

    session = await miniProgram.callWxMethod("getStorageSync", SESSION_KEY);
    assert(Object.keys(session.answers).length === 20, "提交前本地答案不是20题");
    assert(session.currentQuestionIndex === 19, "Q20当前题号没有保存");
    assert(session.context.dailyAvailableTime === Q20_ANSWER, "Q20没有写入每日时间上下文");
    assert(session.context.weeklyAvailableTime === "7—14小时", "Q20没有换算每周可投入时间");
    assert(session.startupConditions.weeklyAvailableTime === "7—14小时", "启动条件没有预填每周时间");

    await miniProgram.reLaunch("/pages/question/index");
    page = await currentQuestionPage(miniProgram);
    assert((await page.data("currentIndex")) === 19, "重开问答页后没有恢复到Q20");
    assert((await page.data("choiceValue")) === Q20_ANSWER, "Q20选项没有恢复");

    await page.callMethod("onNext");
    await sleep(1600);
    const loadingPage = await miniProgram.currentPage();
    assert(loadingPage.path === "pages/loading/index", "20题提交后没有进入Loading页");
    session = await miniProgram.callWxMethod("getStorageSync", SESSION_KEY);
    assert(session.currentStep === "analyzing", "提交后当前步骤不是analyzing");
    assert(Object.keys(session.answers).length === 20, "提交后20题答案不完整");
    assert(exceptions.length === 0, `运行期间出现异常：${JSON.stringify(exceptions)}`);
    assert(errorLogs.length === 0, `运行期间出现console error：${JSON.stringify(errorLogs)}`);

    console.log(JSON.stringify({
      success: true,
      restoredDraft: true,
      answerCount: Object.keys(session.answers).length,
      currentStep: session.currentStep,
      q20Daily: session.context.dailyAvailableTime,
      q20Weekly: session.context.weeklyAvailableTime,
      startupWeeklyPrefill: session.startupConditions.weeklyAvailableTime,
      abstractHintNonBlocking: true,
      exceptions: 0,
      consoleErrors: 0,
    }, null, 2));
  } finally {
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
