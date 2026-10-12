/*!
 * seed.js —— 首次打开时的演示数据
 * ------------------------------------------------------------------
 * 时间按"相对当前时间"生成，这样不管什么时候打开，列表里的
 * "xx 分钟前 / xx 小时前"看起来都是合理的。
 */
(function (root) {
  'use strict';

  var HOUR = 3600 * 1000;
  var DAY = 24 * HOUR;

  /** @param {Date} now 基准时间 */
  function build(now) {
    var base = now instanceof Date ? now.getTime() : Date.now();

    /** 生成一条种子数据 */
    function make(offsetMs, type, category, title, area, place, desc,
                  contact, publisher, status) {
      var t = new Date(base - offsetMs).toISOString();
      var mod = root.LFCore || {};
      return {
        id: 'LFDEMO' + String(base - offsetMs).slice(-8),
        type: type,
        category: category,
        title: title,
        area: area,
        place: place,
        desc: desc,
        contact: contact,
        contactType: mod.classifyContact ? mod.classifyContact(contact) : null,
        occurredAt: t,
        images: [],
        publisher: publisher,
        status: status || 'open',
        createdAt: t,
        updatedAt: t
      };
    }

    var raw = [
      make(35 * 60 * 1000, 'found', 'card', '校园卡一张（姓名：李*）', '教学楼',
        '第三教学楼 302 教室',
        '在 302 教室最后一排桌洞里捡到一张校园卡，卡面有轻微磨损，已经用卡套包好。目前暂存在三教一楼值班室，失主可以带学生证去认领，也可以先联系我确认。',
        'wangxy_2024', '王同学', 'open'),

      make(4 * HOUR, 'lost', 'earphone', '白色蓝牙耳机（只剩右耳）', '图书馆',
        '图书馆 4 楼靠窗自习区',
        '白色入耳式蓝牙耳机，充电仓还在，右耳那只不见了。大概是下午在图书馆四楼靠窗那排座位掉的，耳机上贴了一小条黄色胶带做标记。捡到的同学麻烦联系我，非常感谢。',
        '13800138000', '陈同学', 'open'),

      make(7 * HOUR, 'found', 'umbrella', '黑色长柄雨伞', '食堂',
        '第二食堂一楼门口伞架',
        '中午吃完饭在食堂门口伞架上看到的，一直没人拿走。黑色长柄，伞柄是木头的，伞带上有"天堂伞"字样。我暂时放在二食堂一楼服务台了。',
        '226688', '刘同学', 'open'),

      make(1 * DAY + 3 * HOUR, 'lost', 'cup', '膳魔师保温杯（银色 500ml）', '体育馆',
        '体育馆羽毛球 3 号场地边',
        '银色不锈钢保温杯，杯底贴了一张写有名字的白色标签，已经有点模糊了。晚上打完球落在场地边上的长椅，回去找已经不见了。',
        'zhang_qq21', '张同学', 'open'),

      make(1 * DAY + 8 * HOUR, 'found', 'key', '一串钥匙（带棕色小熊挂件）', '宿舍区',
        '学生公寓 6 号楼洗衣房',
        '洗衣房洗衣机上捡到的一串钥匙，共 3 把，挂着一个小熊挂件。已经交给 6 号楼宿管阿姨保管，失主可以直接去一楼值班室认领。',
        'zhaoy_0417', '赵同学', 'open'),

      make(2 * DAY, 'lost', 'book', '《数据结构与算法分析》C 语言版', '教学楼',
        '第一教学楼 205 教室',
        '课本扉页写了我的名字和学号，里面有大量荧光笔笔记和便签。应该是上午第二大节课下课后忘在座位上了。这本书对我很重要，愿意有偿找回。',
        '15912345678', '孙同学', 'open'),

      make(2 * DAY + 5 * HOUR, 'found', 'bag', '灰色双肩包（内有充电器）', '校车',
        '校车 2 号线（南门—东区）',
        '在校车最后一排座位上捡到的灰色双肩包，里面有笔记本电源适配器、一本笔记本和一把折叠伞。已经交到校车队调度室（南门站点）。',
        'zhoum_2025', '周同学', 'open'),

      make(3 * DAY, 'lost', 'card', '校园卡（学号 2024****32）', '食堂',
        '第三食堂二楼',
        '中午在第三食堂二楼吃饭时把校园卡落在餐盘回收处了，卡套是深蓝色的，背面贴了一张公交卡贴纸。卡里余额不多，主要是补办很麻烦，希望好心人联系我。',
        'wuxx2024@qq.com', '吴同学', 'open'),

      make(3 * DAY + 6 * HOUR, 'found', 'other', '银色 U 盘（32G，金属外壳）', '教学楼',
        '计算机学院机房 A305',
        '机房 A305 第 12 号机位上捡到的银色 U 盘，插在主机上忘记拔了。没有翻看里面内容，已交给机房管理员老师，请失主凭描述认领。',
        'zheng_ly', '郑同学', 'open'),

      make(5 * DAY, 'found', 'cup', '粉色吸管杯（带小熊贴纸）', '图书馆',
        '图书馆一楼大厅休息区',
        '图书馆一楼大厅休息区捡到的粉色吸管杯，杯身贴了一只小熊贴纸。失主当天就联系到我，已经归还啦，谢谢大家。',
        'feng_xx', '冯同学', 'done'),

      make(6 * DAY, 'lost', 'umbrella', '透明雨伞（有一根伞骨是歪的）', '教学楼',
        '第四教学楼门口',
        '透明长柄雨伞，右边有一根伞骨是歪的，伞柄上缠了一圈黑色胶带。已经有好心同学联系我送回了，感谢失物招领。',
        '11223344', '何同学', 'done'),

      make(8 * HOUR, 'lost', 'key', '宿舍钥匙（挂粉色兔子挂件）', '宿舍区',
        '学生公寓 6 号楼门口',
        '一串宿舍钥匙，挂着一个粉色兔子玩偶挂件，可能掉在 6 号楼门口或者去食堂的路上了。捡到的同学麻烦联系我，谢谢。',
        'wangxy_2024', '我', 'open'),

      make(1 * DAY + 1 * HOUR, 'found', 'card', '校园卡一张（姓名：周*）', '食堂',
        '第二食堂二楼餐桌上',
        '在第二食堂二楼餐桌上捡到一张校园卡，已经交到二食堂一楼服务台，失主可以直接去认领。',
        'wangxy_2024', '我', 'done')
    ];

    // 给每条补一个稳定的唯一 id
    raw.forEach(function (it, i) {
      it.id = 'LFDEMO' + ('000' + i).slice(-3);
      it.mine = it.publisher === '我';
    });

    return raw;
  }

  root.LFSeed = { build: build };
})(window);
