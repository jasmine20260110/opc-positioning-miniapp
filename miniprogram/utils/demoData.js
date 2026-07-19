/**
 * 内部演示专用固定数据。
 * 这些内容是虚构样例，不代表真实用户结论，也不能当作真实市场调研。
 */

const { CONTRACT_VERSION } = require("./dataContract");
const { QUESTIONS } = require("./questions");

const SAMPLE_ANSWERS = Object.freeze({
  Q1: "我愿意长期研究AI工具，并把复杂操作整理成普通人能照着完成的步骤。",
  Q2: "最近制作AI工作流教程时，我连续整理了三个小时，结束后还想继续优化。",
  Q3: "我一直会回到效率工具、知识管理、职业成长和内容表达这些主题。",
  Q4: "我会主动测试新工具、记录踩坑过程，并分享给遇到同样问题的朋友。",
  Q5: "我最想研究普通人如何利用AI建立稳定的个人工作系统，因为我自己也在实践。",
  Q6: "帮助朋友把一个模糊想法变成可以执行的步骤，会让我觉得这一天很值得。",
  Q7: "我希望别人记住我是一个能把复杂问题讲清楚、还能推动行动的人。",
  Q8: "朋友经常问我AI工具怎么选、提示词怎么写，以及怎样整理工作流程。",
  Q9: "我过去通过项目规划、内容整理和流程优化获得过收入与认可。",
  Q10: "我比较容易发现流程里的混乱点，并把它们重新整理成清晰步骤。",
  Q11: "我做过AI实践手册、个人项目管理台和小程序需求梳理，主要负责结构设计和落地推进。",
  Q12: "工作组合：主业+副业，多元收入来源",
  Q13: "我有信心分享普通人如何从零开始使用AI完成一个真实项目。",
  Q14: "最可能是AI工具落地辅导，因为已经有人持续向我咨询并使用我整理的方法。",
  Q15: "想服务正在转型、想做副业或一人公司，但不知道从哪里开始的职场人。",
  Q16: "他们信息很多、方向很多，却难以判断什么适合自己，也很难迈出第一步。",
  Q17: "可能会｜如果能得到具体路线和低成本验证步骤，他们可能愿意付费。",
  Q18: "25—35岁",
  Q19: "全职工作，考虑转型",
  Q20: "1—2小时（早晚或周末）",
});

function buildDemoAnswers() {
  return QUESTIONS.map((question) => ({
    questionId: question.questionId,
    module: question.module,
    questionText: question.questionText,
    intent: question.intent,
    questionType: question.questionType,
    answer: SAMPLE_ANSWERS[question.questionId],
    answeredAt: "2026-07-19T09:00:00.000Z",
  }));
}

const DEMO_DATA = Object.freeze({
  contractVersion: CONTRACT_VERSION,
  demoMode: true,
  session: {
    sessionId: "demo-session-001",
    status: "completed",
    currentStep: "plan",
    currentQuestionIndex: 19,
    context: {
      ageStage: "25—35岁",
      careerStatus: "全职工作，考虑转型",
      dailyAvailableTime: "1—2小时（早晚或周末）",
      weeklyAvailableTime: "7—14小时",
    },
    startupConditions: {
      incomeFloor: {
        latestFirstRevenue: "3个月内",
        minimumMeaningfulAmount: "100—1000元",
      },
      weeklyAvailableTime: "7—14小时",
      reachableUsersByRoute: {
        A: "6—20人",
        B: "1—5人",
        C: "0人",
      },
      validationResources: {
        budget: "500元以内",
        supplementMethod: "更愿意投入时间",
      },
    },
    selectedRouteId: "A",
    behavior: {
      day1Started: false,
    },
    createdAt: "2026-07-19T09:00:00.000Z",
    updatedAt: "2026-07-19T09:20:00.000Z",
  },
  answers: {
    sessionId: "demo-session-001",
    items: buildDemoAnswers(),
  },
  evidence: {
    sessionId: "demo-session-001",
    flowEvidence: [
      {
        claim: "喜欢研究AI并把复杂操作转化为可执行步骤",
        sourceAnswerId: "Q1",
        sourceQuote: SAMPLE_ANSWERS.Q1,
        evidenceType: "用户事实",
      },
      {
        claim: "制作AI工作流教程时容易进入长时间投入状态",
        sourceAnswerId: "Q2",
        sourceQuote: SAMPLE_ANSWERS.Q2,
        evidenceType: "用户事实",
      },
    ],
    strengthEvidence: [
      {
        claim: "能够发现流程混乱点并重新整理",
        sourceAnswerId: "Q10",
        sourceQuote: SAMPLE_ANSWERS.Q10,
        evidenceType: "用户事实",
      },
      {
        claim: "已有项目规划、内容整理和流程优化经验",
        sourceAnswerId: "Q11",
        sourceQuote: SAMPLE_ANSWERS.Q11,
        evidenceType: "用户事实",
      },
    ],
    marketInitialSignals: {
      targetAudience: "正在转型、探索副业或一人公司的职场人",
      problem: "信息和方向过多，难以选择并开始行动",
      paymentJudgment: "可能愿意为具体路线和验证步骤付费",
      evidenceType: "用户判断",
    },
    background: {
      ageStage: "25—35岁",
      careerStatus: "全职工作，考虑转型",
      dailyAvailableTime: "1—2小时（早晚或周末）",
      weeklyAvailableTime: "7—14小时",
    },
    evidenceSufficiency: {
      flow: "高",
      strength: "中",
      market: "低",
      reason: "心流经历较具体，能力有项目佐证，但尚无真实付费或访谈证据。",
    },
    informationGaps: ["尚未验证目标用户是否愿意付费", "尚未形成可重复交付的服务流程"],
    aiMeta: {
      model: "demo-fixed-data",
      success: true,
    },
  },
  routes: [
    {
      routeId: "A",
      routeName: "职场人的AI行动教练",
      oneLiner: "帮助想转型的职场人用AI把模糊方向变成一周行动。",
      targetAudience: "想转型或尝试副业，但迟迟没有开始的职场人",
      problemSolved: "方向过多、行动不足，不知道如何低成本验证",
      matchEvidence: [
        {
          claim: "擅长把复杂问题整理成可执行步骤",
          sourceAnswerId: "Q10",
          sourceQuote: SAMPLE_ANSWERS.Q10,
          evidenceType: "用户事实",
        },
      ],
      capabilitiesToLeverage: ["流程梳理", "AI工具实践", "行动计划设计"],
      capabilitiesToDevelop: ["用户访谈", "服务产品化"],
      monetizationPath: "低价定位诊断或7天行动陪跑",
      maxRisk: "用户可能认可建议但不愿意付费或执行",
      minValidationAction: "邀请5名目标用户体验一次30分钟定位梳理",
      evidenceSufficiency: "中",
      informationGaps: ["真实付费意愿", "陪跑完成率"],
      marketOpportunity: {
        paidMarketMaturity: {
          result: "待验证",
          basis: "目前只有用户自己的判断，缺少真实成交记录。",
          evidenceType: "待验证",
        },
        competitorAndDifferentiation: {
          result: "替代方案是职业咨询；差异点是强调AI辅助和7天小步验证。",
          basis: "基于产品形式的AI推测。",
          evidenceType: "AI推测",
        },
        demandEvidenceStrength: {
          result: "弱",
          basis: "存在朋友咨询，但尚无结构化访谈或付费证据。",
          evidenceType: "用户事实",
        },
        acquisitionChannel: {
          result: "朋友圈或职场社群，获客难度中等。",
          basis: "用户已有可直接联系的目标人群。",
          evidenceType: "用户判断",
        },
        firstRevenueExpectation: {
          cycle: "1—3个月",
          amountRange: "100—1000元",
          basis: "以低价体验服务测试首笔收入，金额和周期均待验证。",
        },
      },
      launchRequirements: {
        firstRevenueCycle: "1—3个月",
        firstRevenueAmountRange: "100—1000元",
        minimumWeeklyTime: "5小时",
        minimumValidationBudget: "0—200元",
        firstValidationUsers: {
          count: "5人",
          channel: "朋友圈或职场社群",
        },
      },
      startupFit: {
        dimensions: [
          { name: "首笔变现", internalScore: 2, status: "当前满足", reason: "期望周期和金额与低价体验服务匹配。" },
          { name: "稳定投入时间", internalScore: 2, status: "当前满足", reason: "每周7—14小时高于最低5小时。" },
          { name: "首批用户资源", internalScore: 2, status: "当前满足", reason: "可联系人数覆盖首轮5人测试。" },
          { name: "验证预算", internalScore: 2, status: "当前满足", reason: "可以使用免费工具和现有社群完成验证。" },
        ],
        result: "优先验证",
        maxGap: "尚无真实付费证据",
        recommendation: "先邀请5人体验，再测试一个100元以内的付费版本。",
      },
    },
    {
      routeId: "B",
      routeName: "AI实践内容产品作者",
      oneLiner: "把真实AI项目过程整理成小白可执行的教程和模板。",
      targetAudience: "想使用AI但缺少具体使用场景的普通职场人",
      problemSolved: "教程很多，但缺少从真实任务出发的完整示例",
      matchEvidence: [
        {
          claim: "制作AI工作流教程时容易进入心流",
          sourceAnswerId: "Q2",
          sourceQuote: SAMPLE_ANSWERS.Q2,
          evidenceType: "用户事实",
        },
      ],
      capabilitiesToLeverage: ["内容结构化", "工具测试", "小白表达"],
      capabilitiesToDevelop: ["持续分发", "产品定价"],
      monetizationPath: "模板包、微课或付费专栏",
      maxRisk: "内容被免费替代，难以形成持续付费",
      minValidationAction: "发布一篇真实案例并收集10条反馈",
      evidenceSufficiency: "中",
      informationGaps: ["内容触达能力", "付费内容差异化"],
      marketOpportunity: {
        paidMarketMaturity: {
          result: "付费较弱",
          basis: "免费教程很多，用户通常只为系统化成果或陪伴付费。",
          evidenceType: "AI推测",
        },
        competitorAndDifferentiation: {
          result: "替代方案是免费AI教程；差异点是真实项目和完整结果文件。",
          basis: "基于当前内容定位的比较。",
          evidenceType: "AI推测",
        },
        demandEvidenceStrength: {
          result: "弱",
          basis: "已有咨询信号，但没有内容转化数据。",
          evidenceType: "待验证",
        },
        acquisitionChannel: {
          result: "小红书或公众号，获客难度较高。",
          basis: "需要持续内容分发才能形成稳定触达。",
          evidenceType: "AI推测",
        },
        firstRevenueExpectation: {
          cycle: "1—3个月",
          amountRange: "100—1000元",
          basis: "先用低价模板包验证，实际转化率待验证。",
        },
      },
      launchRequirements: {
        firstRevenueCycle: "1—3个月",
        firstRevenueAmountRange: "100—1000元",
        minimumWeeklyTime: "7小时",
        minimumValidationBudget: "0—500元",
        firstValidationUsers: {
          count: "10人",
          channel: "内容平台或现有社交关系",
        },
      },
      startupFit: {
        dimensions: [
          { name: "首笔变现", internalScore: 1, status: "可以补足", reason: "低价产品可能满足金额，但需要先建立流量。" },
          { name: "稳定投入时间", internalScore: 2, status: "当前满足", reason: "每周投入时间达到最低要求。" },
          { name: "首批用户资源", internalScore: 1, status: "可以补足", reason: "现有可联系人数不足10人，可以通过公开发布补足。" },
          { name: "验证预算", internalScore: 2, status: "当前满足", reason: "内容验证可以使用免费工具。" },
        ],
        result: "补足后验证",
        maxGap: "缺少稳定内容分发渠道",
        recommendation: "先发布一篇真实案例，验证是否能获得10条有效反馈。",
      },
    },
    {
      routeId: "C",
      routeName: "小团队AI工作流顾问",
      oneLiner: "为小团队梳理重复工作，并设计可落地的AI工作流。",
      targetAudience: "缺少专职技术人员的小公司或小团队",
      problemSolved: "知道AI有用，但不知道如何嵌入实际业务流程",
      matchEvidence: [
        {
          claim: "有流程优化和项目规划经验",
          sourceAnswerId: "Q9",
          sourceQuote: SAMPLE_ANSWERS.Q9,
          evidenceType: "用户事实",
        },
      ],
      capabilitiesToLeverage: ["流程诊断", "项目规划", "AI工具选型"],
      capabilitiesToDevelop: ["企业销售", "行业案例"],
      monetizationPath: "流程诊断、实施服务或顾问包",
      maxRisk: "缺少企业客户资源和可证明的交付案例",
      minValidationAction: "找到1个小团队完成一次免费流程访谈",
      evidenceSufficiency: "低",
      informationGaps: ["企业客户资源", "可量化降本增效结果"],
      marketOpportunity: {
        paidMarketMaturity: {
          result: "明确付费",
          basis: "企业存在顾问和实施预算，但当前用户尚无成交证据。",
          evidenceType: "AI推测",
        },
        competitorAndDifferentiation: {
          result: "替代方案是软件服务商；差异点是先做轻量流程诊断。",
          basis: "基于服务模式的比较。",
          evidenceType: "AI推测",
        },
        demandEvidenceStrength: {
          result: "待验证",
          basis: "当前没有企业访谈或项目案例。",
          evidenceType: "待验证",
        },
        acquisitionChannel: {
          result: "行业关系或转介绍，获客难度高。",
          basis: "该服务依赖信任和企业决策链。",
          evidenceType: "AI推测",
        },
        firstRevenueExpectation: {
          cycle: "3—6个月",
          amountRange: "1000—5000元",
          basis: "顾问客单价可能更高，但成交周期也更长。",
        },
      },
      launchRequirements: {
        firstRevenueCycle: "3—6个月",
        firstRevenueAmountRange: "1000—5000元",
        minimumWeeklyTime: "10小时",
        minimumValidationBudget: "500元以内",
        firstValidationUsers: {
          count: "3个团队",
          channel: "行业关系或转介绍",
        },
      },
      startupFit: {
        dimensions: [
          { name: "首笔变现", internalScore: 0, status: "明显冲突", reason: "预计成交周期超过当前3个月期限。" },
          { name: "稳定投入时间", internalScore: 1, status: "可以补足", reason: "时间区间部分满足，但企业沟通需要整块时间。" },
          { name: "首批用户资源", internalScore: 0, status: "明显冲突", reason: "当前没有可直接联系的小团队客户。" },
          { name: "验证预算", internalScore: 2, status: "当前满足", reason: "首次访谈不需要额外预算。" },
        ],
        result: "暂缓",
        maxGap: "缺少企业客户资源",
        recommendation: "先积累个人用户案例，再通过转介绍寻找一个小团队。",
      },
    },
  ],
  plan: {
    sessionId: "demo-session-001",
    selectedRouteId: "A",
    planName: "7天验证计划：职场人的AI行动教练",
    planGoal: "验证目标用户是否需要一套AI辅助的7天方向行动服务。",
    planNote: "本计划只验证需求和行动意愿，不建议辞职或进行大额投入。",
    days: [
      {
        day: 1,
        goal: "确定最小服务对象",
        minimumAction: "写出一类最熟悉的目标用户及其一个具体困扰。",
        estimatedTime: "30分钟",
        completionEvidence: "一段不超过100字的用户和问题描述。",
        fallback: "只写一个你最近帮助过的具体人物。",
        whyThisMatters: "避免把服务对象写成所有想转型的人。",
      },
      {
        day: 2,
        goal: "验证问题是否真实存在",
        minimumAction: "联系2位目标用户，询问他们最近一次卡住的具体场景。",
        estimatedTime: "45分钟",
        completionEvidence: "两段访谈记录或聊天截图摘要。",
        fallback: "先联系1位最容易沟通的人。",
        whyThisMatters: "用真实经历替代自己的想象。",
      },
      {
        day: 3,
        goal: "形成最小服务流程",
        minimumAction: "把一次定位梳理拆成输入、分析、行动三个步骤。",
        estimatedTime: "40分钟",
        completionEvidence: "一张三步服务流程卡。",
        fallback: "只写三个步骤的标题。",
        whyThisMatters: "让服务变得可交付，而不是泛泛聊天。",
      },
      {
        day: 4,
        goal: "完成首次体验",
        minimumAction: "邀请1位目标用户完成一次30分钟免费体验。",
        estimatedTime: "60分钟",
        completionEvidence: "一份体验记录和对方的一条反馈。",
        fallback: "先约定具体体验时间。",
        whyThisMatters: "验证用户是否能理解并完成这套流程。",
      },
      {
        day: 5,
        goal: "修正交付内容",
        minimumAction: "根据反馈删除一个无用步骤，并补充一个最需要的步骤。",
        estimatedTime: "30分钟",
        completionEvidence: "更新后的三步流程。",
        fallback: "只记录一个必须修改的问题。",
        whyThisMatters: "让产品由真实反馈而不是个人想象驱动。",
      },
      {
        day: 6,
        goal: "测试付费意愿",
        minimumAction: "向1位体验者提出100元以内的下一步服务方案并询问是否愿意购买。",
        estimatedTime: "30分钟",
        completionEvidence: "明确的愿意、不愿意或有条件愿意及理由。",
        fallback: "只询问什么条件下对方愿意付费。",
        whyThisMatters: "区分口头认可和真实付费信号。",
      },
      {
        day: 7,
        goal: "决定是否继续",
        minimumAction: "汇总访谈、体验和付费信号，写出继续、调整或停止的决定。",
        estimatedTime: "40分钟",
        completionEvidence: "一页验证结论，包含证据和下一步。",
        fallback: "只写三条最重要的证据。",
        whyThisMatters: "用证据决定下一轮，而不是凭感觉继续投入。",
      },
    ],
    aiMeta: {
      model: "demo-fixed-data",
      success: true,
    },
  },
});

module.exports = {
  SAMPLE_ANSWERS,
  DEMO_DATA,
  buildDemoAnswers,
};
