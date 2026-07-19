/**
 * OPC定位神器 P0 的20题配置。
 * 开放题 suggestedChars 只用于提示，不能作为提交门槛。
 */

const ABSTRACT_ANSWER_HINT = "建议补充一个最近发生的具体经历；你也可以继续下一题。";

const QUESTIONS = Object.freeze([
  {
    questionId: "Q1",
    module: "passion",
    questionText: "如果暂时不用考虑收入、身份和他人的期待，你最愿意把时间投入到什么事情上？",
    intent: "识别剥离外部评价后的真实兴趣与自主选择",
    questionType: "text",
    suggestedChars: 30,
  },
  {
    questionId: "Q2",
    module: "passion",
    questionText: "过去一年，你做什么事情时最容易忘记时间，甚至结束后仍意犹未尽？",
    intent: "识别可能产生心流体验与高投入感的活动",
    questionType: "text",
    suggestedChars: 50,
  },
  {
    questionId: "Q3",
    module: "passion",
    questionText: "回顾过去十年，有哪些主题或领域你不断学习、不断回到它身边？",
    intent: "区分短期兴趣与长期热爱",
    questionType: "text",
    suggestedChars: 30,
  },
  {
    questionId: "Q4",
    module: "passion",
    questionText: "有哪些事情，即使没人要求、没人奖励，你也愿意主动去做？",
    intent: "识别无需外部奖励的内在驱动力",
    questionType: "text",
    suggestedChars: 30,
  },
  {
    questionId: "Q5",
    module: "passion",
    questionText: "如果未来十年只能深耕一个主题，你最想持续研究什么？为什么？",
    intent: "探索长期投入意愿",
    questionType: "text",
    suggestedChars: 50,
  },
  {
    questionId: "Q6",
    module: "passion",
    questionText: "哪些经历会让你觉得『今天过得特别值得』？",
    intent: "寻找意义感来源",
    questionType: "text",
    suggestedChars: 30,
  },
  {
    questionId: "Q7",
    module: "passion",
    questionText: "你最希望别人因为什么而记住你？",
    intent: "探索理想身份与影响力期待",
    questionType: "text",
    suggestedChars: 30,
  },
  {
    questionId: "Q8",
    module: "strength",
    questionText: "别人最常因为什么问题向你请教、求助或征求意见？",
    intent: "寻找被别人反复验证的优势",
    questionType: "text",
    suggestedChars: 30,
  },
  {
    questionId: "Q9",
    module: "strength",
    questionText: "过去你应用什么技能赚钱最多？如尚未工作，你最容易因为什么获得认可或重要机会？",
    intent: "寻找已被现实验证的能力",
    questionType: "text",
    suggestedChars: 30,
  },
  {
    questionId: "Q10",
    module: "strength",
    questionText: "哪些事情对别人来说比较困难，但对你来说却相对自然或轻松？",
    intent: "识别自然形成的优势能力",
    questionType: "text",
    suggestedChars: 30,
  },
  {
    questionId: "Q11",
    module: "strength",
    questionText: "哪三个项目或成果最让你有成就感？你发挥了什么关键作用？",
    intent: "从真实成果中提炼可迁移能力",
    questionType: "text",
    suggestedChars: 90,
  },
  {
    questionId: "Q12",
    module: "strength",
    questionText: "在什么样的工作方式或环境中，你最容易发挥最佳水平？",
    intent: "识别最适合的工作模式",
    questionType: "choice",
    options: [
      "稳定企业，朝九晚五，有明确职责边界",
      "自由职业，自己掌控节奏和项目",
      "工作组合：主业+副业，多元收入来源",
      "自主创业：组建团队，打造品牌和公司",
      "OPC一人公司：轻装上阵，独立经营",
      "其他",
    ],
  },
  {
    questionId: "Q13",
    module: "strength",
    questionText: "如果明天需要你开设一门课程或做一次公开分享，你最有信心讲什么？",
    intent: "识别可输出和可教授的能力",
    questionType: "text",
    suggestedChars: 30,
  },
  {
    questionId: "Q14",
    module: "strength",
    questionText: "如果未来有人持续为你的某项能力付费，你认为最可能是哪项能力？有哪些证据支持？",
    intent: "连接个人能力与商业价值",
    questionType: "text",
    suggestedChars: 50,
  },
  {
    questionId: "Q15",
    module: "market",
    questionText: "你心中大概想服务哪类人群？他们有什么共同特征？",
    intent: "了解用户对目标客户的初步判断",
    questionType: "text",
    suggestedChars: 30,
  },
  {
    questionId: "Q16",
    module: "market",
    questionText: "你觉得这类人群目前面临的最大困扰或痛点是什么？",
    intent: "了解用户对市场问题的初步判断",
    questionType: "text",
    suggestedChars: 30,
  },
  {
    questionId: "Q17",
    module: "market",
    questionText: "你认为他们愿意为解决这个问题付费吗？为什么？",
    intent: "了解付费意愿判断及依据",
    questionType: "mixed",
    options: ["确定会", "可能会", "不确定", "可能不会"],
    suggestedChars: 20,
  },
  {
    questionId: "Q18",
    module: "basic",
    questionText: "你的年龄阶段是？",
    intent: "了解用户所处人生阶段",
    questionType: "choice",
    options: ["25岁以下", "25—35岁", "35—45岁", "45岁以上"],
  },
  {
    questionId: "Q19",
    module: "basic",
    questionText: "你当前的职业状态是？",
    intent: "了解用户当前职业与转型阶段",
    questionType: "choice",
    options: [
      "全职工作，考虑转型",
      "自由职业/独立接单",
      "已离职，正在探索",
      "已在经营一人公司，想重新定位",
      "在校/刚毕业",
      "其他",
    ],
  },
  {
    questionId: "Q20",
    module: "basic",
    questionText: "你每天大概可以投入多少时间用于OPC探索和验证？",
    intent: "确认可支配时间和现实约束",
    questionType: "choice",
    options: [
      "不到1小时（碎片时间为主）",
      "1—2小时（早晚或周末）",
      "2—4小时（有较稳定的整块时间）",
      "4小时以上（目前主要精力在此）",
    ],
  },
]);

function getQuestionById(questionId) {
  return QUESTIONS.find((question) => question.questionId === questionId) || null;
}

module.exports = {
  ABSTRACT_ANSWER_HINT,
  QUESTIONS,
  getQuestionById,
};
