const cloud = require("wx-server-sdk");
const {
  analyzeMarket,
  extractEvidence,
  generatePlan,
  generateRoutes,
  runAnalysis,
} = require("./analysis");
const { getPublicConfig } = require("./bailianClient");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const ACTIONS = {
  analyzeMarket,
  extractEvidence,
  generatePlan,
  generateRoutes,
  runAnalysis,
};

function publicError(error) {
  const knownCodes = [
    "AI_NOT_CONFIGURED",
    "AI_TIMEOUT",
    "AI_NETWORK_ERROR",
    "AI_INVALID_JSON",
    "AI_SCHEMA_INVALID",
    "AI_EMPTY_CONTENT",
    "AI_RESPONSE_TOO_LARGE",
  ];
  const code = knownCodes.includes(error.code) || /^AI_HTTP_\d+$/.test(error.code || "")
    ? error.code
    : "AI_ANALYSIS_FAILED";
  const messages = {
    AI_NOT_CONFIGURED: "AI服务尚未配置，请返回首页或联系开发者。",
    AI_TIMEOUT: "AI分析超时，请重试或返回首页。",
    AI_NETWORK_ERROR: "AI服务暂时无法连接，请重试或返回首页。",
    AI_INVALID_JSON: "AI返回格式不正确，请重试或返回首页。",
    AI_SCHEMA_INVALID: "AI结果字段不完整，请重试或返回首页。",
    AI_EMPTY_CONTENT: "AI没有返回有效结果，请重试或返回首页。",
    AI_RESPONSE_TOO_LARGE: "AI返回内容过长，请重试或返回首页。",
  };
  return {
    code,
    message: messages[code] || "AI分析失败，请重试或返回首页。",
    retryable: error.retryable !== false,
    details: code === "AI_SCHEMA_INVALID"
      ? String(error.message || "结构校验失败").slice(0, 160)
      : undefined,
  };
}

exports.main = async (event = {}) => {
  const action = event.action;
  if (action === "health") {
    return { ok: true, data: getPublicConfig() };
  }
  if (!ACTIONS[action]) {
    return {
      ok: false,
      error: { code: "INVALID_ACTION", message: "不支持的云函数操作", retryable: false },
    };
  }

  try {
    const data = await ACTIONS[action](event.payload || {});
    return { ok: true, data };
  } catch (error) {
    const safeError = publicError(error);
    console.error("[opcApi] action failed", {
      action,
      code: safeError.code,
      retryable: safeError.retryable,
      details: safeError.details,
    });
    return { ok: false, error: safeError };
  }
};
