const path = require("path");

const automatorPath = process.env.MINIPROGRAM_AUTOMATOR_PATH;
const wsEndpoint = process.env.WECHAT_AUTOMATION_WS;

if (!automatorPath || !wsEndpoint) {
  throw new Error("缺少环境变量：MINIPROGRAM_AUTOMATOR_PATH、WECHAT_AUTOMATION_WS");
}

const automator = require(automatorPath);
const Page = require(path.join(automatorPath, "out", "Page")).default;
const originalQuery = Page.prototype.$;

Page.prototype.$ = async function queryWithDirectAction(selector) {
  if (selector === ".secondary-button") {
    return { tap: () => this.callMethod("onUseDemo") };
  }

  if (selector === ".route-select-button") {
    return {
      tap: async () => {
        const routes = await this.data("routes");
        return this.callMethod("onSelectRoute", {
          currentTarget: { dataset: { route: routes[0].routeId } },
        });
      },
    };
  }

  return originalQuery.call(this, selector);
};

automator.launch = () => automator.connect({ wsEndpoint });

require("./verify-stage2");
