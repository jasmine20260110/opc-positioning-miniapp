const { DEMO_DATA } = require("../../utils/demoData");

const RESULT_KEY = "opc_mvp_result";
const SESSION_KEY = "opc_mvp_session";
const FEEDBACKS_KEY = "opc_mvp_feedbacks";

function getFeedbackRecords() {
  const records = wx.getStorageSync(FEEDBACKS_KEY);
  return records && typeof records === "object" && !Array.isArray(records) ? records : {};
}

function trimText(value) {
  return typeof value === "string" ? value.trim() : "";
}

Page({
  data: {
    form: {
      mostResonantDirection: "",
      resonanceReason: "",
      experienceFeedback: "",
      day1Willingness: "",
      otherSuggestions: "",
    },
    submitting: false,
  },

  onLoad(options) {
    const result = wx.getStorageSync(RESULT_KEY) || DEMO_DATA;
    const session = wx.getStorageSync(SESSION_KEY) || {};
    const resultSession = result.session || {};
    this.sessionId = session.sessionId || resultSession.sessionId || `local-${Date.now()}`;
    this.routeId = options.routeId || session.selectedRouteId || resultSession.selectedRouteId || "A";

    const records = getFeedbackRecords();
    const existing = records[this.sessionId];
    this.feedbackCreatedAt = existing && existing.createdAt ? existing.createdAt : "";
    const legacyDirection = existing && existing.mostResonantRouteNameSnapshot
      ? `路线${existing.mostResonantRouteId || ""} · ${existing.mostResonantRouteNameSnapshot}`
      : "";
    const legacyExperience = existing && Number.isInteger(existing.experienceScore)
      ? `${existing.experienceScore}分`
      : "";

    this.setData({
      form: existing ? {
        mostResonantDirection: existing.mostResonantDirection || legacyDirection,
        resonanceReason: existing.resonanceReason || "",
        experienceFeedback: existing.experienceFeedback || legacyExperience,
        day1Willingness: existing.day1Willingness || "",
        otherSuggestions: existing.otherSuggestions || "",
      } : this.data.form,
    });
  },

  onMostResonantDirectionInput(e) {
    this.setData({ "form.mostResonantDirection": e.detail.value });
  },

  onResonanceReasonInput(e) {
    this.setData({ "form.resonanceReason": e.detail.value });
  },

  onExperienceFeedbackInput(e) {
    this.setData({ "form.experienceFeedback": e.detail.value });
  },

  onDay1WillingnessInput(e) {
    this.setData({ "form.day1Willingness": e.detail.value });
  },

  onOtherSuggestionsInput(e) {
    this.setData({ "form.otherSuggestions": e.detail.value });
  },

  onBackToPlan() {
    wx.navigateBack({
      delta: 1,
      fail: () => wx.redirectTo({ url: `/pages/plan/index?routeId=${this.routeId}` }),
    });
  },

  onSubmit() {
    if (this.data.submitting) return;
    const form = this.data.form;

    if (!trimText(form.mostResonantDirection)) {
      wx.showToast({ title: "请填写最打动你的方向", icon: "none" });
      return;
    }
    if (!trimText(form.experienceFeedback)) {
      wx.showToast({ title: "请填写整体体验感受", icon: "none" });
      return;
    }
    if (!trimText(form.day1Willingness)) {
      wx.showToast({ title: "请填写是否愿意执行Day1", icon: "none" });
      return;
    }

    this.setData({ submitting: true });
    const now = new Date().toISOString();
    const records = getFeedbackRecords();
    const previous = records[this.sessionId] || {};
    const feedback = {
      feedbackId: previous.feedbackId || `feedback-${this.sessionId}`,
      schemaVersion: "feedback-v2",
      sessionId: this.sessionId,
      mostResonantDirection: trimText(form.mostResonantDirection),
      resonanceReason: trimText(form.resonanceReason),
      experienceFeedback: trimText(form.experienceFeedback),
      day1Willingness: trimText(form.day1Willingness),
      otherSuggestions: trimText(form.otherSuggestions),
      createdAt: this.feedbackCreatedAt || previous.createdAt || now,
      updatedAt: now,
    };
    records[this.sessionId] = feedback;

    const session = wx.getStorageSync(SESSION_KEY) || {};
    session.behavior = session.behavior || {};
    session.behavior.feedbackSubmittedAt = session.behavior.feedbackSubmittedAt || now;
    session.updatedAt = now;

    wx.setStorageSync(FEEDBACKS_KEY, records);
    wx.setStorageSync(SESSION_KEY, session);
    this.feedbackCreatedAt = feedback.createdAt;

    wx.showToast({ title: "感谢你的反馈", icon: "success" });
    setTimeout(() => {
      wx.navigateBack({
        delta: 1,
        fail: () => wx.redirectTo({ url: `/pages/plan/index?routeId=${this.routeId}` }),
      });
    }, 700);
  },
});
