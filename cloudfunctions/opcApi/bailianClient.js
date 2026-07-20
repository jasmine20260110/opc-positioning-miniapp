const https = require("https");
const { URL } = require("url");
const { snakeToCamel } = require("./caseConverter");

const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

class BailianError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "BailianError";
    this.code = code;
    this.statusCode = options.statusCode;
    this.retryable = Boolean(options.retryable);
  }
}

function resolveEndpoint(baseUrl = DEFAULT_BASE_URL) {
  const cleanBase = String(baseUrl).replace(/\/+$/, "");
  return cleanBase.endsWith("/chat/completions")
    ? cleanBase
    : `${cleanBase}/chat/completions`;
}

function getConfig() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new BailianError(
      "AI_NOT_CONFIGURED",
      "云函数尚未配置DASHSCOPE_API_KEY",
      { retryable: false },
    );
  }

  const defaultModel = process.env.DASHSCOPE_MODEL || "deepseek-v4-flash";
  return {
    apiKey,
    endpoint: resolveEndpoint(process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL),
    fastModel: process.env.DASHSCOPE_MODEL_FAST || defaultModel,
    qualityModel: process.env.DASHSCOPE_MODEL_QUALITY || defaultModel,
    // 小程序同步调用的云函数按60秒配置；两次尝试需共同留在该预算内。
    timeoutMs: Math.min(Math.max(Number(process.env.DASHSCOPE_TIMEOUT_MS) || 25000, 5000), 25000),
    maxCompletionTokens: Math.min(
      Math.max(Number(process.env.DASHSCOPE_MAX_COMPLETION_TOKENS) || 6000, 1000),
      12000,
    ),
  };
}

function supportsJsonObject(model) {
  return !String(model).startsWith("deepseek-v4-");
}

function requestCompletion(config, payload) {
  return new Promise((resolve, reject) => {
    const endpoint = new URL(config.endpoint);
    const body = JSON.stringify(payload);
    const request = https.request({
      protocol: endpoint.protocol,
      hostname: endpoint.hostname,
      port: endpoint.port || 443,
      path: `${endpoint.pathname}${endpoint.search}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: config.timeoutMs,
    }, (response) => {
      let raw = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        raw += chunk;
        if (raw.length > 2 * 1024 * 1024) {
          request.destroy(new BailianError("AI_RESPONSE_TOO_LARGE", "AI响应超过2MB限制"));
        }
      });
      response.on("end", () => {
        let parsed;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch (error) {
          reject(new BailianError("AI_HTTP_INVALID_JSON", "百炼HTTP响应不是合法JSON", { retryable: true }));
          return;
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          const retryable = response.statusCode === 408
            || response.statusCode === 429
            || response.statusCode >= 500;
          const providerMessage = parsed.error && parsed.error.message
            ? String(parsed.error.message).slice(0, 300)
            : `HTTP ${response.statusCode}`;
          reject(new BailianError(
            `AI_HTTP_${response.statusCode}`,
            providerMessage,
            { statusCode: response.statusCode, retryable },
          ));
          return;
        }
        resolve(parsed);
      });
    });

    request.on("timeout", () => {
      request.destroy(new BailianError("AI_TIMEOUT", "百炼请求超时", { retryable: true }));
    });
    request.on("error", (error) => {
      if (error instanceof BailianError) reject(error);
      else reject(new BailianError("AI_NETWORK_ERROR", "百炼网络请求失败", { retryable: true }));
    });
    request.write(body);
    request.end();
  });
}

function parseModelJson(response) {
  const content = response
    && response.choices
    && response.choices[0]
    && response.choices[0].message
    && response.choices[0].message.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new BailianError("AI_EMPTY_CONTENT", "百炼没有返回有效内容", { retryable: true });
  }

  const cleanContent = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(cleanContent);
  } catch (error) {
    throw new BailianError("AI_INVALID_JSON", "模型输出不是合法JSON", { retryable: true });
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function callStructured({ label, model, systemPrompt, userPayload, validate }) {
  const config = getConfig();
  const startedAt = Date.now();
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const correction = attempt > 0
        && lastError
        && lastError.code === "AI_SCHEMA_INVALID"
        ? `\n上一次输出未通过字段校验：${String(lastError.message).slice(0, 160)}。请严格补齐该字段，并保持其余JSON结构不变。`
        : "";
      const requestPayload = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `请根据以下输入以JSON格式输出：\n${JSON.stringify(userPayload)}${correction}` },
        ],
        enable_thinking: false,
        temperature: 0.2,
        max_completion_tokens: config.maxCompletionTokens,
      };
      if (supportsJsonObject(model)) {
        requestPayload.response_format = { type: "json_object" };
      }
      const response = await requestCompletion(config, requestPayload);
      const converted = snakeToCamel(parseModelJson(response));
      const data = validate(converted);
      return {
        data,
        meta: {
          label,
          model: response.model || model,
          attempts: attempt + 1,
          durationMs: Date.now() - startedAt,
          usage: response.usage || null,
        },
      };
    } catch (error) {
      lastError = error;
      if (attempt === 1 || !error.retryable) break;
      await sleep(500);
    }
  }
  throw lastError;
}

function getPublicConfig() {
  const baseUrl = process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL;
  const defaultModel = process.env.DASHSCOPE_MODEL || "deepseek-v4-flash";
  return {
    configured: Boolean(process.env.DASHSCOPE_API_KEY),
    baseHost: new URL(resolveEndpoint(baseUrl)).hostname,
    fastModel: process.env.DASHSCOPE_MODEL_FAST || defaultModel,
    qualityModel: process.env.DASHSCOPE_MODEL_QUALITY || defaultModel,
  };
}

module.exports = {
  BailianError,
  callStructured,
  getConfig,
  getPublicConfig,
  parseModelJson,
  resolveEndpoint,
  supportsJsonObject,
};
