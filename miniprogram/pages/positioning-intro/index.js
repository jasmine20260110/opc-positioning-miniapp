const QUESTION_URL = "/pages/question/index?startAt=1";

Page({
  data: {
    entering: false,
  },

  onEnter() {
    if (this.data.entering) return;
    this.setData({ entering: true });
    wx.redirectTo({
      url: QUESTION_URL,
      fail: () => {
        wx.reLaunch({
          url: QUESTION_URL,
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

module.exports = { QUESTION_URL };
