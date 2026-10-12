/*!
 * core.js —— 校园失物招领 · 纯逻辑层
 * ------------------------------------------------------------------
 * 这一层不依赖 DOM、不依赖浏览器，只做数据处理：校验、检索、排序、
 * 状态流转、持久化封装。因此它既能在页面里用，也能被单元测试直接
 * 引入（见 test/core.test.js），不需要任何构建工具。
 *
 * 兼容两种加载方式：
 *   浏览器  <script src="js/core.js"></script>   ->  window.LFCore
 *   Node    require('./js/core.js')             ->  module.exports
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LFCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ══════════════════ 常量定义 ══════════════════ */

  /** 物品分类 */
  var CATEGORIES = [
    { key: 'card',     name: '校园卡', emoji: '🎫', color: '#4A82F0' },
    { key: 'key',      name: '钥匙',   emoji: '🔑', color: '#F0A03C' },
    { key: 'cup',      name: '水杯',   emoji: '🥤', color: '#3FB6A6' },
    { key: 'umbrella', name: '雨伞',   emoji: '☂️', color: '#7C6BF0' },
    { key: 'earphone', name: '耳机',   emoji: '🎧', color: '#F06A88' },
    { key: 'book',     name: '书籍',   emoji: '📚', color: '#6DB84E' },
    { key: 'bag',      name: '包袋',   emoji: '🎒', color: '#5D93C8' },
    { key: 'other',    name: '其他',   emoji: '📦', color: '#98A0B6' }
  ];

  /** 校园区域（用于"按地点筛选"） */
  var AREAS = ['教学楼', '图书馆', '食堂', '宿舍区', '体育馆', '运动场', '校车', '其他'];

  var TYPE   = { LOST: 'lost', FOUND: 'found' };
  var STATUS = { OPEN: 'open', DONE: 'done' };

  /** 各字段长度上限 */
  var MAX_LEN = { title: 24, place: 30, desc: 200, contact: 30 };

  /* ══════════════════ 基础工具 ══════════════════ */

  /** 安全转字符串，避免 null / undefined 到处判断 */
  function str(v) {
    return v === null || v === undefined ? '' : String(v);
  }

  /**
   * HTML 转义。所有用户输入在拼接进 innerHTML 之前都必须过这一道，
   * 否则一条标题里写 <img onerror=...> 就能在别人页面上执行脚本。
   */
  function escapeHtml(value) {
    return str(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /**
   * 关键词高亮：把 text 中命中关键词的部分包上 <em>。
   * 先转义再匹配，保证转义后的实体不会被关键词切开。
   */
  function highlight(text, keyword) {
    var safe = escapeHtml(text);
    var kw = str(keyword).trim();
    if (!kw) return safe;
    var i = safe.toLowerCase().indexOf(escapeHtml(kw).toLowerCase());
    if (i < 0) return safe;
    var seg = safe.slice(i, i + kw.length);
    return safe.slice(0, i) + '<em class="hl">' + seg + '</em>' + safe.slice(i + kw.length);
  }

  /** 按显示宽度截断，超出部分用省略号补齐 */
  function truncate(text, max) {
    var s = str(text);
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  /* ══════════════════ 联系方式识别 ══════════════════ */

  var CONTACT_PATTERNS = [
    { name: '手机号', re: /^1[3-9]\d{9}$/ },
    { name: 'QQ 号',  re: /^[1-9]\d{4,10}$/ },
    { name: '微信号', re: /^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/ },
    { name: '邮箱',   re: /^[\w.+-]+@[\w-]+\.[\w.]+$/ }
  ];

  /** 返回联系方式类型名，识别不出返回 null */
  function classifyContact(value) {
    var s = str(value).trim();
    if (!s) return null;
    for (var i = 0; i < CONTACT_PATTERNS.length; i++) {
      if (CONTACT_PATTERNS[i].re.test(s)) return CONTACT_PATTERNS[i].name;
    }
    return null;
  }

  function isValidContact(value) {
    return classifyContact(value) !== null;
  }

  /* ══════════════════ 表单校验 ══════════════════ */

  function categoryOf(key) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].key === key) return CATEGORIES[i];
    }
    return null;
  }

  function areaOf(name) {
    return AREAS.indexOf(name) >= 0 ? name : null;
  }

  /**
   * 校验发布表单。
   * 一次性收集所有错误而不是遇到第一个就返回，页面才能把每一处
   * 问题同时标出来（见 app.js 的 renderErrors）。
   *
   * @returns {{valid: boolean, errors: Object<string,string>}}
   */
  function validateItem(form) {
    var f = form || {};
    var errors = {};

    var type = f.type;
    if (type !== TYPE.LOST && type !== TYPE.FOUND) {
      errors.type = '请选择信息类型';
    }

    var title = str(f.title).trim();
    if (!title) errors.title = '请填写物品名称';
    else if (title.length > MAX_LEN.title) {
      errors.title = '物品名称不能超过 ' + MAX_LEN.title + ' 个字';
    }

    if (!categoryOf(f.category)) errors.category = '请选择物品分类';

    if (!areaOf(f.area)) errors.area = '请选择所在区域';

    var place = str(f.place).trim();
    if (!place) errors.place = '请填写详细地点';
    else if (place.length > MAX_LEN.place) {
      errors.place = '详细地点不能超过 ' + MAX_LEN.place + ' 个字';
    }

    var contact = str(f.contact).trim();
    if (!contact) errors.contact = '请填写联系方式';
    else if (!isValidContact(contact)) {
      errors.contact = '请填写有效的手机号 / 微信号 / QQ 号 / 邮箱';
    } else if (contact.length > MAX_LEN.contact) {
      errors.contact = '联系方式过长';
    }

    if (str(f.desc).trim().length > MAX_LEN.desc) {
      errors.desc = '描述不能超过 ' + MAX_LEN.desc + ' 个字';
    }

    if (f.occurredAt && isNaN(new Date(f.occurredAt).getTime())) {
      errors.occurredAt = '时间格式不正确';
    }

    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /* ══════════════════ 构造信息 ══════════════════ */

  /**
   * 生成信息 ID：'LF' + 36 进制时间戳 + 随机后缀。
   * rand 可注入，方便单元测试断言固定结果。
   */
  function genId(now, rand) {
    var d = now instanceof Date ? now : new Date(now === undefined ? Date.now() : now);
    var r = typeof rand === 'function' ? rand() : Math.random();
    return 'LF' + d.getTime().toString(36) + Math.floor(r * 1e6).toString(36);
  }

  /**
   * 由表单构造一条完整的信息记录。校验不通过返回 null。
   */
  function createItem(form, now, rand) {
    var check = validateItem(form);
    if (!check.valid) return null;

    var d = now instanceof Date ? now : new Date(now === undefined ? Date.now() : now);
    var iso = d.toISOString();

    return {
      id: genId(d, rand),
      type: form.type,
      category: form.category,
      title: str(form.title).trim(),
      area: form.area,
      place: str(form.place).trim(),
      desc: str(form.desc).trim(),
      contact: str(form.contact).trim(),
      contactType: classifyContact(form.contact),
      occurredAt: cleanTime(form.occurredAt) || iso,
      images: Array.isArray(form.images) ? form.images.slice(0, 3) : [],
      publisher: str(form.publisher).trim() || '匿名同学',
      status: STATUS.OPEN,
      createdAt: iso,
      updatedAt: iso
    };
  }

  function cleanTime(value) {
    if (!value) return null;
    var t = new Date(value).getTime();
    return isNaN(t) ? null : new Date(t).toISOString();
  }

  /* ══════════════════ 检索 / 筛选 / 排序 ══════════════════ */

  /** 把一条信息摊平成一个可搜索的字符串 */
  function haystack(item) {
    var cat = categoryOf(item.category);
    return [
      item.title,
      cat ? cat.name : '',
      item.area,
      item.place,
      item.desc,
      item.publisher
    ].join(' ').toLowerCase();
  }

  /**
   * 关键词搜索。支持空格分隔的多个关键词，需要全部命中（AND）。
   * 关键词为空时返回全部副本，方便调用方统一处理。
   */
  function searchItems(items, keyword) {
    var list = Array.isArray(items) ? items : [];
    var kws = str(keyword).toLowerCase().split(/\s+/).filter(Boolean);
    if (!kws.length) return list.slice();
    return list.filter(function (it) {
      var hay = haystack(it);
      return kws.every(function (k) { return hay.indexOf(k) >= 0; });
    });
  }

  /**
   * 组合筛选。传 null / 'all' 表示该维度不过滤。
   * @param {{type?:string, category?:string, area?:string, status?:string}} cond
   */
  function filterItems(items, cond) {
    var c = cond || {};
    return (Array.isArray(items) ? items : []).filter(function (it) {
      if (c.type && c.type !== 'all' && it.type !== c.type) return false;
      if (c.category && c.category !== 'all' && it.category !== c.category) return false;
      if (c.area && c.area !== 'all' && it.area !== c.area) return false;
      if (c.status && c.status !== 'all' && it.status !== c.status) return false;
      return true;
    });
  }

  /**
   * 排序：未归还的排前面；同状态下按发布时间倒序（latest）或正序（oldest）。
   * 返回新数组，不修改入参。
   */
  function sortItems(items, mode) {
    var list = (Array.isArray(items) ? items : []).slice();
    var asc = mode === 'oldest';
    list.sort(function (a, b) {
      var aOpen = a.status === STATUS.OPEN ? 0 : 1;
      var bOpen = b.status === STATUS.OPEN ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      var ta = new Date(a.createdAt).getTime() || 0;
      var tb = new Date(b.createdAt).getTime() || 0;
      return asc ? ta - tb : tb - ta;
    });
    return list;
  }

  function findById(items, id) {
    var list = Array.isArray(items) ? items : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  /** 列表页的完整管线：先搜、再筛、最后排序 */
  function query(items, options) {
    var o = options || {};
    var result = searchItems(items, o.keyword);
    result = filterItems(result, {
      type: o.type,
      category: o.category,
      area: o.area,
      status: o.status
    });
    return sortItems(result, o.sort);
  }

  /* ══════════════════ 状态流转 ══════════════════ */

  /**
   * 修改信息状态。
   * @returns 新的数组；若 id 不存在或状态非法则返回 null。
   */
  function changeStatus(items, id, status, now) {
    if (status !== STATUS.OPEN && status !== STATUS.DONE) return null;
    var list = Array.isArray(items) ? items : [];
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { idx = i; break; }
    }
    if (idx < 0) return null;

    var d = now instanceof Date ? now : new Date(now === undefined ? Date.now() : now);
    var next = list.slice();
    next[idx] = Object.assign({}, list[idx], { status: status, updatedAt: d.toISOString() });
    return next;
  }

  /** 按 id 删除，返回新数组；id 不存在返回 null */
  function removeItem(items, id) {
    var list = Array.isArray(items) ? items : [];
    var next = list.filter(function (it) { return it.id !== id; });
    return next.length === list.length ? null : next;
  }

  /** 局部更新，返回新数组；id 不存在返回 null */
  function updateItem(items, id, patch, now) {
    var list = Array.isArray(items) ? items : [];
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { idx = i; break; }
    }
    if (idx < 0) return null;

    var d = now instanceof Date ? now : new Date(now === undefined ? Date.now() : now);
    var merged = Object.assign({}, list[idx], patch || {});
    merged.updatedAt = d.toISOString();

    var check = validateItem(merged);
    if (!check.valid) return null;

    var next = list.slice();
    next[idx] = merged;
    return next;
  }

  /* ══════════════════ 统计 ══════════════════ */

  function stats(items) {
    var list = Array.isArray(items) ? items : [];
    var out = { total: list.length, open: 0, done: 0, lost: 0, found: 0, resolvedRate: 0 };
    list.forEach(function (it) {
      if (it.status === STATUS.DONE) out.done++; else out.open++;
      if (it.type === TYPE.LOST) out.lost++; else if (it.type === TYPE.FOUND) out.found++;
    });
    out.resolvedRate = out.total ? Math.round((out.done / out.total) * 100) : 0;
    return out;
  }

  /* ══════════════════ 时间格式化 ══════════════════ */

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  /** '2026-10-11 14:30' */
  function formatTime(value) {
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
           ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /** '刚刚' / '5 分钟前' / '3 小时前' / '2 天前' / 超过 7 天显示日期 */
  function relativeTime(value, now) {
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '';
    var base = now instanceof Date ? now : new Date(now === undefined ? Date.now() : now);
    var diff = base.getTime() - d.getTime();

    if (diff < 0) return formatTime(d);
    var min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return min + ' 分钟前';
    var hour = Math.floor(min / 60);
    if (hour < 24) return hour + ' 小时前';
    var day = Math.floor(hour / 24);
    if (day <= 7) return day + ' 天前';
    return formatTime(d);
  }

  /* ══════════════════ 持久化 ══════════════════ */

  /** 内存兜底存储：当 localStorage 不可用时（隐私模式、file:// 受限）顶上 */
  function memoryStorage() {
    var box = Object.create(null);
    return {
      getItem: function (k) { return k in box ? box[k] : null; },
      setItem: function (k, v) { box[k] = String(v); },
      removeItem: function (k) { delete box[k]; }
    };
  }

  /**
   * 选一个可用的存储后端。
   * 注意：Chrome 在 file:// 下有时会禁用 localStorage，直接访问会抛异常，
   * 所以这里用一次真实的写入来探测，失败就退化成内存存储，保证页面不白屏。
   */
  function pickStorage(preferred) {
    var candidates = [];
    if (preferred) candidates.push(preferred);
    try { if (typeof localStorage !== 'undefined') candidates.push(localStorage); } catch (e) { /* 忽略 */ }
    candidates.push(memoryStorage());

    for (var i = 0; i < candidates.length; i++) {
      try {
        var probe = '__lf_probe__';
        candidates[i].setItem(probe, '1');
        candidates[i].removeItem(probe);
        return candidates[i];
      } catch (e) { /* 换下一个 */ }
    }
    return memoryStorage();
  }

  /**
   * 建一个带命名空间的存储门面，负责 JSON 序列化与异常兜底。
   */
  function createStore(storage, key) {
    var backend = pickStorage(storage);
    var name = key || 'lost-found/items';

    return {
      backend: backend,
      load: function () {
        try {
          var raw = backend.getItem(name);
          if (!raw) return null;
          var data = JSON.parse(raw);
          return Array.isArray(data) ? data : null;
        } catch (e) {
          return null;
        }
      },
      save: function (items) {
        try {
          backend.setItem(name, JSON.stringify(Array.isArray(items) ? items : []));
          return true;
        } catch (e) {
          return false;
        }
      },
      clear: function () {
        try { backend.removeItem(name); return true; } catch (e) { return false; }
      }
    };
  }

  /* ══════════════════ 导出 ══════════════════ */

  return {
    // 常量
    CATEGORIES: CATEGORIES,
    AREAS: AREAS,
    TYPE: TYPE,
    STATUS: STATUS,
    MAX_LEN: MAX_LEN,
    // 工具
    str: str,
    escapeHtml: escapeHtml,
    highlight: highlight,
    truncate: truncate,
    // 联系方式
    classifyContact: classifyContact,
    isValidContact: isValidContact,
    // 校验与构造
    validateItem: validateItem,
    createItem: createItem,
    genId: genId,
    categoryOf: categoryOf,
    // 检索
    searchItems: searchItems,
    filterItems: filterItems,
    sortItems: sortItems,
    findById: findById,
    query: query,
    // 变更
    changeStatus: changeStatus,
    removeItem: removeItem,
    updateItem: updateItem,
    // 统计与时间
    stats: stats,
    formatTime: formatTime,
    relativeTime: relativeTime,
    // 存储
    memoryStorage: memoryStorage,
    pickStorage: pickStorage,
    createStore: createStore
  };
});
