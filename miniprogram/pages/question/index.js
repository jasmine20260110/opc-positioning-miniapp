const { ABSTRACT_ANSWER_HINT, QUESTIONS } = require("../../utils/questions");
const {
  SESSION_KEY,
  createQuestionSession,
  isAbstractAnswer,
  normalizeQuestionSession,
  saveAnswerToSession,
} = require("../../utils/questionSession");

Page({
  data: {
    currentIndex: 0,
    question: QUESTIONS[0],
    answer: "",
    choiceValue: "",
    detailValue: "",
    progressPercent: 5,
    isFirst: true,
    isLast: false,
    suggestion: "",
    demoMode: false,
  },

  onLoad(options = {}) {
    const storedSession = wx.getStorageSync(SESSION_KEY);
    this.session = storedSession
      ? normalizeQuestionSession(storedSession)
      : createQuestionSession();
    if (options.startAt === "1") {
      this.session.currentIndex = 0;
      this.session.currentQuestionIndex = 0;
      this.session.currentStep = "questions";
      this.session.status = "in_progress";
      this.session.updatedAt = new Date().toISOString();
    }
    wx.setStorageSync(SESSION_KEY, this.session);
    this.loadQuestion(this.session.currentQuestionIndex);
  },

  onHide() {
    this.persistCurrentDraft();
  },

  onUnload() {
    this.persistCurrentDraft();
  },

  loadQuestion(index) {
    const safeIndex = Math.max(0, Math.min(index, QUESTIONS.length - 1));
    const question = QUESTIONS[safeIndex];
    const savedAnswer = this.session.answers[question.questionId] || "";
    const mixedParts = question.questionType === "mixed" ? savedAnswer.split("｜") : [];
    this.setData({
      currentIndex: safeIndex,
      question,
      answer: question.questionType === "text" ? savedAnswer : "",
      choiceValue: question.questionType === "choice" ? savedAnswer : mixedParts[0] || "",
      detailValue: question.questionType === "mixed" ? mixedParts.slice(1).join("｜") : "",
      progressPercent: Math.round(((safeIndex + 1) / QUESTIONS.length) * 100),
      isFirst: safeIndex === 0,
      isLast: safeIndex === QUESTIONS.length - 1,
      suggestion: isAbstractAnswer(savedAnswer, question.questionType)
        ? ABSTRACT_ANSWER_HINT
        : "",
      demoMode: Boolean(this.session.demoMode),
    });
  },

  onTextInput(e) {
    const answer = e.detail.value;
    this.setData({
      answer,
      suggestion: isAbstractAnswer(answer, this.data.question.questionType)
        ? ABSTRACT_ANSWER_HINT
        : "",
    });
    this.persistCurrentDraft();
  },

  onDetailInput(e) {
    this.setData({ detailValue: e.detail.value });
    this.persistCurrentDraft();
  },

  onSelectOption(e) {
    this.setData({ choiceValue: e.currentTarget.dataset.value, suggestion: "" });
    this.persistCurrentDraft();
  },

  getCurrentAnswer() {
    const type = this.data.question.questionType;
    if (type === "text") return this.data.answer.trim();
    if (type === "choice") return this.data.choiceValue;
    return [this.data.choiceValue, this.data.detailValue.trim()].filter(Boolean).join("｜");
  },

  persistCurrentDraft() {
    if (!this.session || !this.data.question) return;
    this.session = saveAnswerToSession(this.session, {
      questionId: this.data.question.questionId,
      answer: this.getCurrentAnswer(),
      currentIndex: this.data.currentIndex,
    });
    wx.setStorageSync(SESSION_KEY, this.session);
  },

  saveCurrentAnswer() {
    const answer = this.getCurrentAnswer();
    if (!answer) {
      wx.showToast({ title: "请先填写这一题", icon: "none" });
      return false;
    }
    this.persistCurrentDraft();
    return true;
  },

  onPrevious() {
    if (this.data.isFirst) return;
    this.persistCurrentDraft();
    const previousIndex = this.data.currentIndex - 1;
    this.session.currentIndex = previousIndex;
    this.session.currentQuestionIndex = previousIndex;
    this.session.updatedAt = new Date().toISOString();
    wx.setStorageSync(SESSION_KEY, this.session);
    this.loadQuestion(previousIndex);
  },

  onNext() {
    if (!this.saveCurrentAnswer()) return;
    if (this.data.isLast) {
      this.session.status = "in_progress";
      this.session.currentStep = "analyzing";
      this.session.updatedAt = new Date().toISOString();
      wx.setStorageSync(SESSION_KEY, this.session);
      wx.navigateTo({ url: "/pages/loading/index" });
      return;
    }

    const nextIndex = this.data.currentIndex + 1;
    this.session.currentIndex = nextIndex;
    this.session.currentQuestionIndex = nextIndex;
    this.session.updatedAt = new Date().toISOString();
    wx.setStorageSync(SESSION_KEY, this.session);
    this.loadQuestion(nextIndex);
  },
});
