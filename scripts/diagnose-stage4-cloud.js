const { SAMPLE_ANSWERS } = require("../miniprogram/utils/demoData");
const { QUESTIONS } = require("../miniprogram/utils/questions");

const automatorPath = process.env.MINIPROGRAM_AUTOMATOR_PATH;
const wsEndpoint = process.env.WECHAT_AUTOMATION_WS;

if (!automatorPath || !wsEndpoint) {
  throw new Error("缺少环境变量：MINIPROGRAM_AUTOMATOR_PATH、WECHAT_AUTOMATION_WS");
}

const automator = require(automatorPath);

async function main() {
  const miniProgram = await automator.connect({ wsEndpoint });
  try {
    const answerItems = QUESTIONS.map((question) => ({
      questionId: question.questionId,
      questionText: question.questionText,
      intent: question.intent,
      answer: SAMPLE_ANSWERS[question.questionId],
    }));
    const response = await miniProgram.evaluate(async (items) => {
      const cloudResponse = await wx.cloud.callFunction({
        name: "opcApi",
        data: {
          action: "extractEvidence",
          payload: { answerItems: items },
        },
      });
      return cloudResponse.result;
    }, answerItems);

    if (!response || !response.ok) {
      const safeError = response && response.error ? response.error : {};
      console.log(JSON.stringify({
        success: false,
        code: safeError.code || "NO_CLOUD_RESULT",
        message: safeError.message || "云函数没有返回结果",
        retryable: safeError.retryable !== false,
      }, null, 2));
      process.exitCode = 2;
      return;
    }

    console.log(JSON.stringify({
      success: true,
      model: response.data.aiMeta.model,
      attempts: response.data.aiMeta.attempts,
      flowEvidenceCount: response.data.evidence.flowEvidence.length,
      strengthEvidenceCount: response.data.evidence.strengthEvidence.length,
    }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({
      success: false,
      code: "CLOUD_CALL_REJECTED",
      message: String(error && error.message ? error.message : error).slice(0, 500),
    }, null, 2));
    process.exitCode = 2;
  } finally {
    miniProgram.disconnect();
  }
}

main();
