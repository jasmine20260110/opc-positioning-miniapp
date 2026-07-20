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
  let openedUrl = "";
  global.wx = {
    navigateTo({ url }) {
      openedUrl = url;
    },
    redirectTo() {},
    showModal() {},
  };

  const report = loadPage("../miniprogram/pages/report/index.js");
  report.pageConfig.onShowStartup.call({});
  assert.strictEqual(openedUrl, "/pages/opc-transition/index");
  assert.strictEqual(report.exports.OPC_TRANSITION_URL, openedUrl);

  let startupUrl = "";
  let redirectCount = 0;
  global.wx = {
    redirectTo({ url }) {
      startupUrl = url;
      redirectCount += 1;
    },
    reLaunch() {},
    showModal() {},
  };

  const transition = loadPage("../miniprogram/pages/opc-transition/index.js");
  const transitionContext = {
    data: { ...transition.pageConfig.data },
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
  assert.strictEqual(typeof transition.pageConfig.onShow, "undefined");
  transition.pageConfig.onContinue.call(transitionContext);
  assert.strictEqual(startupUrl, "/pages/report/index?mode=startup");
  assert.strictEqual(transition.exports.STARTUP_URL, startupUrl);
  assert.strictEqual(redirectCount, 1);
  assert.strictEqual(transitionContext.data.entering, true);
  transition.pageConfig.onContinue.call(transitionContext);
  assert.strictEqual(redirectCount, 1);

  console.log(JSON.stringify({
    success: true,
    marketDestination: openedUrl,
    transitionRequiresTap: true,
    startupDestination: startupUrl,
  }, null, 2));
}

main();
