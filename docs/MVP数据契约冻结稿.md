# OPC定位神器 MVP 数据契约冻结稿

> 状态：P0 内部 Demo 基准版
> 来源：`细化-数据模型设计.md.md`、PRD v1.2 第5章和第7章
> 代码契约：`miniprogram/utils/dataContract.js`

## 一、这份契约解决什么问题

页面、固定演示数据和后续云函数必须使用同一套字段。如果某个字段发生新增、删除或改名，需要同时修改数据契约、演示数据、页面和AI转换逻辑。

## 二、MVP 顶层结构

```javascript
{
  contractVersion: "p0-mvp-v1",
  demoMode: true,
  session: {},
  answers: {},
  evidence: {},
  routes: [],
  plan: {}
}
```

这是一份“一次完整流程快照”，不是数据库集合设计。

## 三、固定数量约束

| 数据 | 固定要求 |
|---|---|
| 问答 | 正好20题 |
| 候选路线 | 正好3条，ID为A/B/C |
| 市场机会 | 每条路线正好5项 |
| 启动适配 | 每条路线正好4个维度 |
| 行动计划 | 正好Day 1—Day 7 |

市场机会5项固定为：

1. `paidMarketMaturity`
2. `competitorAndDifferentiation`
3. `demandEvidenceStrength`
4. `acquisitionChannel`
5. `firstRevenueExpectation`

启动适配4个维度固定为：首笔变现、稳定投入时间、首批用户资源、验证预算。

## 四、命名规则

- 小程序、云函数和固定演示数据统一使用 `camelCase`。
- AI返回的原始JSON可以使用 `snake_case`，但必须在云函数内转换。
- 页面不能直接读取未经校验和转换的AI原始JSON。

## 五、MVP 简化项

和原数据模型相比，内部Demo暂不实现：

- `sessions / answers / evidence / routes / plans`数据库集合；
- 用户账号和跨设备同步；
- 完整行为埋点和调用成本统计；
- 打卡记录和Day 7自动总结；
- 后端永久保存。

当前只保留一个完整数据快照，并使用小程序本地存储保存。

## 六、证据边界

`evidenceType`只允许：

- 用户事实
- 用户判断
- AI推测
- 待验证

市场需求三题属于“用户判断”，不能直接当作真实市场事实。没有访谈、购买或咨询证据时，市场结论应显示“待验证”或较弱证据。

## 七、AI调用边界

P0只有4次AI调用：

1. 证据提取；
2. 生成3条路线；
3. 市场机会和方向启动要求；
4. 生成7天计划。

个人启动适配由固定规则计算，不调用AI。20题回答过于抽象时只显示固定提示，不增加追问AI调用。

## 八、修改规则

如果只修改展示文案，不改变字段，可以只改页面或Prompt。

如果新增、删除或改名字段，必须同时检查：

1. `dataContract.js`；
2. `demoData.js`；
3. 对应页面；
4. 云函数AI输出转换；
5. 数据校验；
6. 测试用例。

## 九、当前成功标志

执行 `validateP0DemoData(DEMO_DATA)` 必须得到：

```javascript
{ valid: true, errors: [] }
```

只有通过该校验，固定数据才能进入页面开发阶段。
