const { SAMPLE_ANSWERS } = require("../miniprogram/utils/demoData");
const { QUESTIONS } = require("../miniprogram/utils/questions");

const automatorPath = process.env.MINIPROGRAM_AUTOMATOR_PATH;
const wsEndpoint = process.env.WECHAT_AUTOMATION_WS;

if (!automatorPath || !wsEndpoint) {
  throw new Error("缺少环境变量：MINIPROGRAM_AUTOMATOR_PATH、WECHAT_AUTOMATION_WS");
}

const automator = require(automatorPath);

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const miniProgram = await automator.connect({ wsEndpoint });
  const storageKey = `opc_evidence_diagnosis_${Date.now()}`;
  try {
    const answerItems = QUESTIONS.map((question) => ({
      questionId: question.questionId,
      questionText: question.questionText,
      intent: question.intent,
      answer: SAMPLE_ANSWERS[question.questionId],
    }));
    await miniProgram.callWxMethod("removeStorageSync", storageKey);
    await miniProgram.evaluate((request) => {
      wx.cloud.callFunction({
        name: "opcApi",
        data: {
          action: "extractEvidence",
          payload: { answerItems: request.answerItems },
        },
      }).then((cloudResponse) => {
        wx.setStorageSync(request.storageKey, cloudResponse.result);
      }).catch((error) => {
        wx.setStorageSync(request.storageKey, {
          ok: false,
          error: {
            code: "CLOUD_CALL_REJECTED",
            message: String(error && error.errMsg ? error.errMsg : error),
          },
        });
      });
      return true;
    }, { answerItems, storageKey });

    const deadline = Date.now() + 70000;
    let response;
    while (Date.now() < deadline) {
      response = await miniProgram.callWxMethod("getStorageSync", storageKey);
      if (response && typeof response.ok === "boolean") break;
      await sleep(1500);
    }

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
      fallback: response.data.aiMeta.fallback || null,
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
    await miniProgram.callWxMethod("removeStorageSync", storageKey).catch(() => {});
    miniProgram.disconnect();
  }
}

main();
