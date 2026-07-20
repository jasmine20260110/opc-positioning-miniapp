const STARTUP_URL = "/pages/report/index?mode=startup";

Page({
  data: {
    entering: false,
  },

  onContinue() {
    if (this.data.entering) return;
    this.setData({ entering: true });
    wx.redirectTo({
      url: STARTUP_URL,
      fail: () => {
        wx.reLaunch({
          url: STARTUP_URL,
          fail: () => {
            this.setData({ entering: false });
            wx.showModal({
              title: "页面打开失败",
              content: "请在微信开发者工具中重新编译后再试。",
              showCancel: false,
            });
          },
        });
      },
    });
  },
});

module.exports = { STARTUP_URL };
