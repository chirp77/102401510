/*!
 * core.test.js —— core.js 的单元测试
 * ------------------------------------------------------------------
 * 测试对象：js/core.js 导出的 LFCore
 * 设计方法：以白盒为主 —— 每个函数的分支（空值、边界值、非法值、
 *           正常值）都至少覆盖一次；再配合等价类划分与边界值分析
 *           构造输入数据。
 */
(function () {
  'use strict';

  var C = window.LFCore;
  var describe = window.MiniTest.describe;
  var it = window.MiniTest.it;
  var expect = window.MiniTest.expect;

  /* ══════════════ 测试数据构造 ══════════════ */

  /** 一份"除了被改坏的那一项以外全都合法"的表单 */
  function validForm(overrides) {
    var base = {
      type: 'lost',
      title: '黑色长柄雨伞',
      category: 'umbrella',
      area: '教学楼',
      place: '第三教学楼 302 教室',
      desc: '伞柄上缠了一圈黑色胶带',
      contact: 'wangxy_2024',
      publisher: '王同学',
      occurredAt: null,
      images: []
    };
    Object.keys(overrides || {}).forEach(function (k) { base[k] = overrides[k]; });
    return base;
  }

  /** 三条固定数据，用于检索 / 排序 / 状态流转 */
  function sampleItems() {
    return [
      {
        id: 'A1', type: 'found', category: 'card', title: '校园卡一张（姓名：李*）',
        area: '教学楼', place: '三教 302 教室', desc: '蓝色卡套，背面有贴纸',
        contact: 'wangxy_2024', contactType: '微信号', publisher: '王同学',
        status: 'open', createdAt: '2026-10-10T10:00:00.000Z', updatedAt: '2026-10-10T10:00:00.000Z'
      },
      {
        id: 'A2', type: 'lost', category: 'earphone', title: '白色蓝牙耳机',
        area: '图书馆', place: '图书馆四楼靠窗', desc: '只剩右耳，贴了黄色胶带',
        contact: '13800138000', contactType: '手机号', publisher: '陈同学',
        status: 'open', createdAt: '2026-10-11T09:00:00.000Z', updatedAt: '2026-10-11T09:00:00.000Z'
      },
      {
        id: 'A3', type: 'lost', category: 'umbrella', title: 'Transparent Umbrella',
        area: '教学楼', place: '四教门口', desc: '有一根伞骨是歪的',
        contact: 'hexx_2025', contactType: '微信号', publisher: '何同学',
        status: 'done', createdAt: '2026-10-09T08:00:00.000Z', updatedAt: '2026-10-10T08:00:00.000Z'
      }
    ];
  }

  function ids(list) {
    return list.map(function (it) { return it.id; });
  }

  /* ══════════════════════════════════════════════════════════
     1. 联系方式识别 classifyContact
     ══════════════════════════════════════════════════════════ */
  describe('classifyContact：联系方式类型识别', function () {

    it('11 位手机号应被识别为「手机号」', function () {
      expect(C.classifyContact('13800138000')).toBe('手机号');
      expect(C.classifyContact('19912345678')).toBe('手机号');
    });

    it('以字母开头的 6~20 位账号应被识别为「微信号」', function () {
      expect(C.classifyContact('wangxy_2024')).toBe('微信号');
      expect(C.classifyContact('abc123')).toBe('微信号');
    });

    it('5~11 位纯数字应被识别为「QQ 号」', function () {
      expect(C.classifyContact('226688')).toBe('QQ 号');
      expect(C.classifyContact('11223344')).toBe('QQ 号');
    });

    it('邮箱应被识别为「邮箱」', function () {
      expect(C.classifyContact('wuxx2024@qq.com')).toBe('邮箱');
    });

    it('手机号优先于 QQ 号：11 位数字不会被误判成 QQ', function () {
      // 13800138000 同时满足"5~11 位数字"，但因为手机号规则排在前面，
      // 应该返回「手机号」——这条用例专门锁住规则顺序
      expect(C.classifyContact('13800138000')).not.toBe('QQ 号');
    });

    it('无法识别的字符串返回 null', function () {
      expect(C.classifyContact('！！乱写的！！')).toBeNull();
      expect(C.classifyContact('123')).toBeNull();          // 太短的纯数字
      expect(C.classifyContact('123456789012')).toBeNull(); // 12 位，超出 QQ 上限
    });

    it('空值与纯空白返回 null', function () {
      expect(C.classifyContact('')).toBeNull();
      expect(C.classifyContact('   ')).toBeNull();
      expect(C.classifyContact(null)).toBeNull();
      expect(C.classifyContact(undefined)).toBeNull();
    });
  });

  /* ══════════════════════════════════════════════════════════
     2. 表单校验 validateItem
     ══════════════════════════════════════════════════════════ */
  describe('validateItem：发布表单校验', function () {

    it('内容完整的表单应通过校验', function () {
      var r = C.validateItem(validForm());
      expect(r.valid).toBe(true);
      expect(Object.keys(r.errors)).toHaveLength(0);
    });

    it('物品名称为空时报错，且错误信息可读', function () {
      var r = C.validateItem(validForm({ title: '' }));
      expect(r.valid).toBe(false);
      expect(r.errors.title).toBe('请填写物品名称');
    });

    it('物品名称只有空格时，应等同于空', function () {
      var r = C.validateItem(validForm({ title: '     ' }));
      expect(r.valid).toBe(false);
      expect(r.errors.title).toBeTruthy();
    });

    it('物品名称超长时报错（边界值：刚好 24 字通过，25 字失败）', function () {
      var exactly24 = new Array(C.MAX_LEN.title + 1).join('伞');   // 24 个字符
      expect(exactly24).toHaveLength(24);
      expect(C.validateItem(validForm({ title: exactly24 })).valid).toBe(true);

      var over25 = exactly24 + '伞';                               // 25 个字符
      var r = C.validateItem(validForm({ title: over25 }));
      expect(r.valid).toBe(false);
      expect(r.errors.title).toContain('24');
    });

    it('未选择物品分类时报错', function () {
      expect(C.validateItem(validForm({ category: '' })).errors.category).toBe('请选择物品分类');
    });

    it('分类传了不存在的 key 也应报错（防止前端被篡改）', function () {
      expect(C.validateItem(validForm({ category: 'not-a-real-cat' })).errors.category)
        .toBe('请选择物品分类');
    });

    it('未选择所在区域时报错', function () {
      expect(C.validateItem(validForm({ area: '' })).errors.area).toBe('请选择所在区域');
    });

    it('区域传了不在列表里的值也应报错', function () {
      expect(C.validateItem(validForm({ area: '火星' })).errors.area).toBeTruthy();
    });

    it('详细地点为空时报错', function () {
      expect(C.validateItem(validForm({ place: '  ' })).errors.place).toBe('请填写详细地点');
    });

    it('详细地点超长时报错（边界值：30 通过 / 31 失败）', function () {
      var exactly30 = new Array(C.MAX_LEN.place + 1).join('楼');
      expect(C.validateItem(validForm({ place: exactly30 })).valid).toBe(true);
      expect(C.validateItem(validForm({ place: exactly30 + '楼' })).errors.place).toBeTruthy();
    });

    it('联系方式为空时报错', function () {
      expect(C.validateItem(validForm({ contact: '' })).errors.contact).toBe('请填写联系方式');
    });

    it('联系方式格式不合法时报错', function () {
      var r = C.validateItem(validForm({ contact: '联系我' }));
      expect(r.valid).toBe(false);
      expect(r.errors.contact).toContain('有效');
    });

    it('信息类型非法时报错', function () {
      expect(C.validateItem(validForm({ type: 'unknown' })).errors.type).toBe('请选择信息类型');
    });

    it('描述超长时报错', function () {
      var long = new Array(C.MAX_LEN.desc + 2).join('字');
      expect(C.validateItem(validForm({ desc: long })).errors.desc).toBeTruthy();
    });

    it('时间格式非法时报错', function () {
      expect(C.validateItem(validForm({ occurredAt: '不是时间' })).errors.occurredAt).toBeTruthy();
    });

    it('多个字段同时出错时，应一次性全部收集（而不是遇到第一个就返回）', function () {
      var r = C.validateItem({ type: 'lost', title: '', category: '', area: '', place: '', contact: '' });
      expect(r.valid).toBe(false);
      expect(Object.keys(r.errors).length).toBeGreaterThan(4);
      ['title', 'category', 'area', 'place', 'contact'].forEach(function (k) {
        expect(r.errors[k]).toBeTruthy();
      });
    });

    it('空表单不会抛异常，而是返回一份完整的错误清单', function () {
      expect(function () { C.validateItem(null); }).not.toThrow();
      expect(C.validateItem(null).valid).toBe(false);
    });
  });

  /* ══════════════════════════════════════════════════════════
     3. 构造记录 createItem / genId
     ══════════════════════════════════════════════════════════ */
  describe('createItem：由表单构造信息记录', function () {

    it('校验不通过时返回 null，不产生半成品数据', function () {
      expect(C.createItem(validForm({ title: '' }))).toBeNull();
      expect(C.createItem(null)).toBeNull();
    });

    it('合法表单应构造出字段完整、初始状态为「寻找中」的记录', function () {
      var item = C.createItem(validForm(), new Date('2026-10-11T10:00:00.000Z'));
      expect(item).not.toBeNull();
      expect(item.status).toBe(C.STATUS.OPEN);
      expect(item.title).toBe('黑色长柄雨伞');
      expect(item.contactType).toBe('微信号');
      expect(item.createdAt).toBe('2026-10-11T10:00:00.000Z');
      expect(item.updatedAt).toBe('2026-10-11T10:00:00.000Z');
      expect(item.images).toEqual([]);
    });

    it('名称与地点两端的空格应被自动去掉', function () {
      var item = C.createItem(validForm({ title: '  黑色雨伞  ', place: '  三教 302  ' }));
      expect(item.title).toBe('黑色雨伞');
      expect(item.place).toBe('三教 302');
    });

    it('未填昵称时默认显示为「匿名同学」', function () {
      expect(C.createItem(validForm({ publisher: '   ' })).publisher).toBe('匿名同学');
    });

    it('图片最多保留 3 张，多传的被截断', function () {
      var item = C.createItem(validForm({ images: ['a', 'b', 'c', 'd', 'e'] }));
      expect(item.images).toHaveLength(3);
    });

    it('genId：同样的时间与随机种子应生成相同的 ID（可复现）', function () {
      var t = new Date('2026-10-11T10:00:00.000Z');
      var seed = function () { return 0.5; };
      var a = C.genId(t, seed);
      var b = C.genId(t, seed);
      expect(a).toBe(b);
      expect(a.slice(0, 2)).toBe('LF');
    });

    it('genId：不同时间生成的 ID 不同', function () {
      var seed = function () { return 0.5; };
      expect(C.genId(new Date('2026-10-11T10:00:00.000Z'), seed))
        .not.toBe(C.genId(new Date('2026-10-11T10:00:01.000Z'), seed));
    });
  });

  /* ══════════════════════════════════════════════════════════
     4. 搜索 searchItems
     ══════════════════════════════════════════════════════════ */
  describe('searchItems：关键词搜索', function () {

    it('关键词为空时返回全部（副本），不做任何过滤', function () {
      var items = sampleItems();
      expect(C.searchItems(items, '')).toHaveLength(3);
      expect(C.searchItems(items, '   ')).toHaveLength(3);
      expect(C.searchItems(items, null)).toHaveLength(3);
      expect(C.searchItems(null, '伞')).toHaveLength(0);
    });

    it('按物品名称命中', function () {
      expect(ids(C.searchItems(sampleItems(), '校园卡'))).toEqual(['A1']);
    });

    it('按地点命中：搜「图书馆」应找到地点在图书馆的那条', function () {
      // 这条专门防一个真实踩过的坑：只匹配标题时搜地点搜不到
      expect(ids(C.searchItems(sampleItems(), '图书馆'))).toEqual(['A2']);
    });

    it('按分类名命中：搜「耳机」能匹配到分类为耳机的记录', function () {
      expect(ids(C.searchItems(sampleItems(), '耳机'))).toEqual(['A2']);
    });

    it('按描述内容命中', function () {
      expect(ids(C.searchItems(sampleItems(), '伞骨'))).toEqual(['A3']);
    });

    it('英文关键词不区分大小写', function () {
      expect(ids(C.searchItems(sampleItems(), 'transparent'))).toEqual(['A3']);
      expect(ids(C.searchItems(sampleItems(), 'TRANSPARENT'))).toEqual(['A3']);
    });

    it('关键词两端的空格应被忽略', function () {
      expect(ids(C.searchItems(sampleItems(), '  校园卡  '))).toEqual(['A1']);
    });

    it('空格分隔的多个关键词之间是「与」的关系，需要全部命中', function () {
      expect(ids(C.searchItems(sampleItems(), '校园卡 教学楼'))).toEqual(['A1']);
      expect(C.searchItems(sampleItems(), '校园卡 图书馆')).toHaveLength(0);
    });

    it('没有任何匹配时返回空数组', function () {
      expect(C.searchItems(sampleItems(), '宇宙飞船')).toEqual([]);
    });

    it('搜索不会修改原数组', function () {
      var items = sampleItems();
      C.searchItems(items, '校园卡');
      expect(items).toHaveLength(3);
    });
  });

  /* ══════════════════════════════════════════════════════════
     5. 筛选 filterItems
     ══════════════════════════════════════════════════════════ */
  describe('filterItems：多维度筛选', function () {

    it('type=lost 只返回寻物启事', function () {
      expect(ids(C.filterItems(sampleItems(), { type: 'lost' }))).toEqual(['A2', 'A3']);
    });

    it('type=found 只返回失物招领', function () {
      expect(ids(C.filterItems(sampleItems(), { type: 'found' }))).toEqual(['A1']);
    });

    it("传 'all' 或省略该维度表示不过滤", function () {
      expect(C.filterItems(sampleItems(), { type: 'all' })).toHaveLength(3);
      expect(C.filterItems(sampleItems(), {})).toHaveLength(3);
      expect(C.filterItems(sampleItems(), null)).toHaveLength(3);
    });

    it('按物品分类筛选', function () {
      expect(ids(C.filterItems(sampleItems(), { category: 'umbrella' }))).toEqual(['A3']);
    });

    it('按所在区域筛选', function () {
      expect(ids(C.filterItems(sampleItems(), { area: '教学楼' }))).toEqual(['A1', 'A3']);
    });

    it('按处理状态筛选', function () {
      expect(ids(C.filterItems(sampleItems(), { status: 'done' }))).toEqual(['A3']);
    });

    it('多个维度是「与」的关系', function () {
      expect(ids(C.filterItems(sampleItems(), { type: 'lost', area: '教学楼' }))).toEqual(['A3']);
      expect(C.filterItems(sampleItems(), { type: 'found', area: '图书馆' })).toHaveLength(0);
    });
  });

  /* ══════════════════════════════════════════════════════════
     6. 排序 sortItems
     ══════════════════════════════════════════════════════════ */
  describe('sortItems：排序', function () {

    it('未归还的信息始终排在已归还的前面', function () {
      var sorted = C.sortItems(sampleItems(), 'latest');
      expect(ids(sorted)).toEqual(['A2', 'A1', 'A3']);
      expect(sorted[2].status).toBe(C.STATUS.DONE);
    });

    it('同为未归还时，按发布时间从新到旧（latest）', function () {
      var open = sampleItems().filter(function (i) { return i.status === 'open'; });
      expect(ids(C.sortItems(open, 'latest'))).toEqual(['A2', 'A1']);
    });

    it('oldest 模式下，同为未归还时按时间从旧到新', function () {
      var open = sampleItems().filter(function (i) { return i.status === 'open'; });
      expect(ids(C.sortItems(open, 'oldest'))).toEqual(['A1', 'A2']);
    });

    it('排序返回新数组，不修改原数组的顺序', function () {
      var items = sampleItems();
      C.sortItems(items, 'latest');
      expect(ids(items)).toEqual(['A1', 'A2', 'A3']);
    });

    it('传入空值不会抛异常', function () {
      expect(function () { C.sortItems(null, 'latest'); }).not.toThrow();
      expect(C.sortItems(null, 'latest')).toEqual([]);
    });
  });

  /* ══════════════════════════════════════════════════════════
     7. 查询管线 query
     ══════════════════════════════════════════════════════════ */
  describe('query：搜索 + 筛选 + 排序的组合管线', function () {

    it('先搜索、再筛选、最后排序，三者结果都能体现', function () {
      var r = C.query(sampleItems(), { keyword: '楼', type: 'lost', sort: 'latest' });
      // 「楼」命中三处的区域字段：A1(教学楼) / A2(图书馆) / A3(教学楼)
      // type=lost 把 A1 排除，剩下 A2、A3；排序时未归还的 A2 在前
      expect(ids(r)).toEqual(['A2', 'A3']);
    });

    it('无参数时返回全部内容', function () {
      expect(C.query(sampleItems(), {})).toHaveLength(3);
      expect(C.query(sampleItems())).toHaveLength(3);
    });

    it('关键词命中但被筛选条件排除时，结果为空', function () {
      expect(C.query(sampleItems(), { keyword: '校园卡', type: 'lost' })).toEqual([]);
    });
  });

  /* ══════════════════════════════════════════════════════════
     8. 状态流转与增删改
     ══════════════════════════════════════════════════════════ */
  describe('changeStatus：信息状态流转', function () {

    it('寻找中 → 已归还，并刷新更新时间', function () {
      var next = C.changeStatus(sampleItems(), 'A1', C.STATUS.DONE,
        new Date('2026-10-11T12:00:00.000Z'));
      var item = C.findById(next, 'A1');
      expect(item.status).toBe(C.STATUS.DONE);
      expect(item.updatedAt).toBe('2026-10-11T12:00:00.000Z');
      expect(item.createdAt).toBe('2026-10-10T10:00:00.000Z');   // 创建时间不该被动
    });

    it('已归还 → 寻找中（允许撤销误操作）', function () {
      var next = C.changeStatus(sampleItems(), 'A3', C.STATUS.OPEN);
      expect(C.findById(next, 'A3').status).toBe(C.STATUS.OPEN);
    });

    it('ID 不存在时返回 null', function () {
      expect(C.changeStatus(sampleItems(), 'NOT-EXIST', C.STATUS.DONE)).toBeNull();
    });

    it('状态值非法时返回 null，不会写入脏数据', function () {
      expect(C.changeStatus(sampleItems(), 'A1', '随便写的状态')).toBeNull();
    });

    it('返回新数组，原数组保持不变（不可变更新）', function () {
      var items = sampleItems();
      var next = C.changeStatus(items, 'A1', C.STATUS.DONE);
      expect(C.findById(items, 'A1').status).toBe(C.STATUS.OPEN);
      expect(next).not.toBe(items);
      expect(next).toHaveLength(3);
    });

    it('只影响目标那条，其余记录原样保留', function () {
      var next = C.changeStatus(sampleItems(), 'A1', C.STATUS.DONE);
      expect(C.findById(next, 'A2').status).toBe(C.STATUS.OPEN);
      expect(C.findById(next, 'A3').status).toBe(C.STATUS.DONE);
    });
  });

  describe('removeItem / updateItem', function () {

    it('removeItem 删除指定记录并返回新数组', function () {
      var next = C.removeItem(sampleItems(), 'A2');
      expect(ids(next)).toEqual(['A1', 'A3']);
    });

    it('removeItem 对不存在的 ID 返回 null', function () {
      expect(C.removeItem(sampleItems(), 'NOT-EXIST')).toBeNull();
    });

    it('updateItem 可以局部更新字段', function () {
      var next = C.updateItem(sampleItems(), 'A1', { title: '校园卡（已改标题）' },
        new Date('2026-10-11T13:00:00.000Z'));
      var item = C.findById(next, 'A1');
      expect(item.title).toBe('校园卡（已改标题）');
      expect(item.place).toBe('三教 302 教室');                  // 未改的字段应保持
      expect(item.updatedAt).toBe('2026-10-11T13:00:00.000Z');
    });

    it('updateItem 若改出了非法数据，应拒绝保存并返回 null', function () {
      expect(C.updateItem(sampleItems(), 'A1', { title: '' })).toBeNull();
      expect(C.updateItem(sampleItems(), 'A1', { contact: '乱写' })).toBeNull();
    });

    it('updateItem 对不存在的 ID 返回 null', function () {
      expect(C.updateItem(sampleItems(), 'NOT-EXIST', { title: 'x' })).toBeNull();
    });
  });

  /* ══════════════════════════════════════════════════════════
     9. 统计 stats
     ══════════════════════════════════════════════════════════ */
  describe('stats：数据统计', function () {

    it('正确统计总数、寻物/招领、寻找中/已归还', function () {
      var s = C.stats(sampleItems());
      expect(s.total).toBe(3);
      expect(s.open).toBe(2);
      expect(s.done).toBe(1);
      expect(s.lost).toBe(2);
      expect(s.found).toBe(1);
    });

    it('找回率四舍五入到整数百分比', function () {
      expect(C.stats(sampleItems()).resolvedRate).toBe(33);   // 1/3 -> 33%
    });

    it('空列表时找回率为 0，而不是 NaN', function () {
      var s = C.stats([]);
      expect(s.total).toBe(0);
      expect(s.resolvedRate).toBe(0);
      expect(C.stats(null).total).toBe(0);
    });
  });

  /* ══════════════════════════════════════════════════════════
     10. 文本处理 escapeHtml / highlight / truncate
     ══════════════════════════════════════════════════════════ */
  describe('escapeHtml：XSS 防护', function () {

    it('转义 < > & " \' 五个危险字符', function () {
      expect(C.escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(C.escapeHtml('a & b')).toBe('a &amp; b');
      expect(C.escapeHtml('"双引号"')).toBe('&quot;双引号&quot;');
    });

    it('转义整段注入代码，使其无法作为标签解析', function () {
      var evil = '<img src=x onerror="alert(1)">';
      var safe = C.escapeHtml(evil);
      expect(safe).not.toContain('<img');
      expect(safe).toContain('&lt;img');
    });

    it('空值安全返回空串', function () {
      expect(C.escapeHtml(null)).toBe('');
      expect(C.escapeHtml(undefined)).toBe('');
    });
  });

  describe('highlight：关键词高亮', function () {

    it('命中的关键词被包进 <em class="hl">', function () {
      expect(C.highlight('校园卡一张', '校园卡')).toContain('<em class="hl">校园卡</em>');
    });

    it('关键词为空时原样返回', function () {
      expect(C.highlight('校园卡一张', '')).toBe('校园卡一张');
      expect(C.highlight('校园卡一张', '   ')).toBe('校园卡一张');
    });

    it('未命中时原样返回', function () {
      expect(C.highlight('校园卡一张', '雨伞')).toBe('校园卡一张');
    });

    it('高亮前先转义，恶意内容不会因为高亮而漏网', function () {
      var out = C.highlight('<b>粗体</b>', '粗体');
      expect(out).not.toContain('<b>');
      expect(out).toContain('&lt;b&gt;');
    });
  });

  describe('truncate：按长度截断', function () {

    it('未超长时原样返回', function () {
      expect(C.truncate('短标题', 10)).toBe('短标题');
    });

    it('超长时截断并补省略号，总长度等于上限', function () {
      var out = C.truncate('这是一个很长很长的标题需要被截断', 8);
      expect(out).toHaveLength(8);
      expect(out.slice(-1)).toBe('…');
    });
  });

  /* ══════════════════════════════════════════════════════════
     11. 持久化 createStore
     ══════════════════════════════════════════════════════════ */
  describe('createStore：本地持久化', function () {

    it('memoryStorage 支持读写删', function () {
      var m = C.memoryStorage();
      m.setItem('k', 'v');
      expect(m.getItem('k')).toBe('v');
      m.removeItem('k');
      expect(m.getItem('k')).toBeNull();
    });

    it('存入的数据可以原样取回（JSON 往返）', function () {
      var store = C.createStore(C.memoryStorage(), 'test/round-trip');
      var data = sampleItems();
      expect(store.save(data)).toBe(true);
      expect(store.load()).toEqual(data);
    });

    it('没有存过数据时 load 返回 null', function () {
      expect(C.createStore(C.memoryStorage(), 'test/empty').load()).toBeNull();
    });

    it('数据被损坏（非法 JSON）时 load 返回 null 而不是抛异常', function () {
      var m = C.memoryStorage();
      m.setItem('test/broken', '{这不是合法的 JSON');
      var store = C.createStore(m, 'test/broken');
      expect(function () { store.load(); }).not.toThrow();
      expect(store.load()).toBeNull();
    });

    it('存进去的不是数组时，load 也返回 null，避免上层拿到意外结构', function () {
      var m = C.memoryStorage();
      m.setItem('test/not-array', '{"a":1}');
      expect(C.createStore(m, 'test/not-array').load()).toBeNull();
    });

    it('clear 之后读到的是 null', function () {
      var store = C.createStore(C.memoryStorage(), 'test/clear');
      store.save(sampleItems());
      store.clear();
      expect(store.load()).toBeNull();
    });

    it('首选后端写入失败时会被自动跳过（模拟 localStorage 配额写满）', function () {
      var full = {
        getItem: function () { return null; },
        setItem: function () { throw new Error('QuotaExceededError'); },
        removeItem: function () {}
      };
      var store = C.createStore(full, 'test/quota');
      expect(store.backend).not.toBe(full);       // 换用了别的后端
      expect(function () { store.save([{ id: 1 }]); }).not.toThrow();
      store.clear();
    });

    it('首选后端完全不可用（每次调用都抛异常）时，仍能正常读写，页面不会白屏', function () {
      var broken = {
        getItem: function () { throw new Error('blocked'); },
        setItem: function () { throw new Error('blocked'); },
        removeItem: function () { throw new Error('blocked'); }
      };
      var store = C.createStore(broken, 'test/fallback');
      expect(store.backend).not.toBe(broken);
      store.clear();
      expect(store.save([{ id: 'x' }])).toBe(true);
      expect(store.load()).toEqual([{ id: 'x' }]);
      store.clear();
    });
  });

  /* ══════════════════════════════════════════════════════════
     12. 时间格式化
     ══════════════════════════════════════════════════════════ */
  describe('formatTime / relativeTime：时间展示', function () {

    it('formatTime 输出 YYYY-MM-DD HH:mm', function () {
      expect(C.formatTime('2026-10-11T10:30:00')).toBe('2026-10-11 10:30');
    });

    it('formatTime 对非法输入返回空串', function () {
      expect(C.formatTime('不是时间')).toBe('');
    });

    it('relativeTime 按时间差给出人类可读的描述', function () {
      var now = new Date('2026-10-11T12:00:00');
      expect(C.relativeTime(new Date('2026-10-11T11:59:40'), now)).toBe('刚刚');
      expect(C.relativeTime(new Date('2026-10-11T11:30:00'), now)).toBe('30 分钟前');
      expect(C.relativeTime(new Date('2026-10-11T09:00:00'), now)).toBe('3 小时前');
      expect(C.relativeTime(new Date('2026-10-09T12:00:00'), now)).toBe('2 天前');
    });

    it('超过 7 天时直接显示具体日期', function () {
      var now = new Date('2026-10-11T12:00:00');
      expect(C.relativeTime(new Date('2026-10-01T12:00:00'), now)).toBe('2026-10-01 12:00');
    });
  });

})();
