/*!
 * app.js —— 校园失物招领 · 界面与交互层
 * ------------------------------------------------------------------
 * 负责：路由、渲染、事件委托、表单交互。
 * 所有数据加工都交给 core.js（LFCore），这一层不写业务规则。
 */
(function () {
  'use strict';

  var C = window.LFCore;
  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var STORAGE_KEY = 'lost-found/items/v1';
  var SORT_OPTIONS = [
    { key: 'latest', label: '最新发布在前' },
    { key: 'oldest', label: '最早发布在前' }
  ];

  /* ══════════════════ 应用状态 ══════════════════ */

  var store = C.createStore(null, STORAGE_KEY);
  var items = [];
  var filters = { keyword: '', type: 'all', category: 'all', area: 'all', status: 'all', sort: 'latest' };

  // 发布表单的临时状态（图片、类型在提交前需要保留）
  var draft = { type: 'lost', images: [], editingId: null };

  /* ══════════════════ 轻提示 / 弹层 ══════════════════ */

  var toastTimer = null;
  function toast(message) {
    var el = $('#toast');
    el.textContent = message;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 2200);
  }

  function openModal(html) {
    $('#modalPanel').innerHTML = html;
    $('#modal').classList.add('is-on');
  }
  function closeModal() { $('#modal').classList.remove('is-on'); }

  function copyText(text) {
    function fallback() {
      // file:// 或非安全上下文下 navigator.clipboard 可能不可用，退回 execCommand
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return fallback(); }
      );
    }
    return Promise.resolve(fallback());
  }

  /* ══════════════════ 数据读写 ══════════════════ */

  function loadItems() {
    var saved = store.load();
    if (saved && saved.length) {
      items = saved;
    } else {
      items = window.LFSeed ? window.LFSeed.build(new Date()) : [];
      store.save(items);
    }
  }

  function persist() {
    if (!store.save(items)) {
      toast('本地存储写入失败，可能是图片过多超出容量');
    }
  }

  function myItems() {
    return items.filter(function (it) { return it.mine; });
  }

  function isMine(item) {
    return !!(item && item.mine);
  }

  /* ══════════════════ 渲染片段 ══════════════════ */

  function catOf(key) {
    return C.categoryOf(key) || { key: 'other', name: '其他', emoji: '📦', color: '#98A0B6' };
  }

  function thumbStyle(cat) {
    return 'background:linear-gradient(145deg,' + cat.color + '33,' + cat.color + '18)';
  }

  function typeTag(item) {
    return item.type === C.TYPE.LOST
      ? '<span class="tag tag--lost">寻物</span>'
      : '<span class="tag tag--found">招领</span>';
  }

  function statusTag(item) {
    return item.status === C.STATUS.DONE
      ? '<span class="tag tag--done">已归还</span>'
      : '<span class="tag tag--open">寻找中</span>';
  }

  function emptyState(title, desc, actionHtml) {
    return '<div class="empty">' +
      '<div class="empty__art">🔍</div>' +
      '<p class="empty__title">' + C.escapeHtml(title) + '</p>' +
      '<p class="empty__desc">' + desc + '</p>' +
      (actionHtml || '') +
      '</div>';
  }

  /** 单张信息卡片 */
  function cardHTML(item) {
    var cat = catOf(item.category);
    var kw = filters.keyword;
    var mineBtns = isMine(item)
      ? '<span class="card__mine">' +
          '<button class="btn btn--ghost btn--sm" data-act="status" data-id="' + item.id + '">改状态</button>' +
        '</span>'
      : '<span class="tag tag--soft">' + C.escapeHtml(cat.name) + '</span>';

    return '<article class="card' + (item.status === C.STATUS.DONE ? ' is-done' : '') +
        '" data-act="open" data-id="' + item.id + '" tabindex="0">' +
      '<div class="card__head">' +
        '<div class="thumb" style="' + thumbStyle(cat) + '">' + cat.emoji + '</div>' +
        '<div class="card__headmain">' +
          '<div class="card__tags">' + typeTag(item) + statusTag(item) + '</div>' +
          '<h3 class="card__title">' + C.highlight(item.title, kw) + '</h3>' +
        '</div>' +
      '</div>' +
      '<div class="card__meta">' +
        '<span><svg class="icon"><use href="#i-pin"/></svg>' +
          '<i>' + C.highlight(item.area + ' · ' + item.place, kw) + '</i></span>' +
        '<span><svg class="icon"><use href="#i-clock"/></svg>' +
          '<i>' + C.relativeTime(item.createdAt) + '发布</i></span>' +
      '</div>' +
      '<div class="card__foot">' +
        '<span class="card__poster"><span class="avatar">' +
          C.escapeHtml(C.str(item.publisher).slice(0, 1) || '匿') + '</span>' +
          C.escapeHtml(item.publisher) + '</span>' +
        mineBtns +
      '</div>' +
    '</article>';
  }

  /* ══════════════════ 侧边筛选 ══════════════════ */

  function countBy(list, field) {
    var out = {};
    list.forEach(function (it) { out[it[field]] = (out[it[field]] || 0) + 1; });
    return out;
  }

  function filterGroup(title, dim, options, counts, allCount) {
    var html = '<div class="filter-group"><h3>' + title + '</h3><div class="filter-list">';
    html += filterItem(dim, 'all', '全部', allCount);
    options.forEach(function (opt) {
      html += filterItem(dim, opt.value, opt.label, counts[opt.value] || 0);
    });
    return html + '</div></div>';
  }

  function filterItem(dim, value, label, count) {
    var on = filters[dim] === value;
    return '<button class="filter-item' + (on ? ' is-on' : '') + '" data-act="filter" ' +
      'data-dim="' + dim + '" data-value="' + C.escapeHtml(value) + '">' +
      '<span>' + C.escapeHtml(label) + '</span>' +
      '<span class="filter-item__n">' + count + '</span></button>';
  }

  function renderSidebar() {
    var s = C.stats(items);
    var byType = countBy(items, 'type');
    var byCat = countBy(items, 'category');
    var byArea = countBy(items, 'area');
    var byStatus = countBy(items, 'status');

    var html = '';
    html += filterGroup('信息类型', 'type', [
      { value: C.TYPE.LOST, label: '寻物启事' },
      { value: C.TYPE.FOUND, label: '失物招领' }
    ], byType, s.total);

    html += filterGroup('物品分类', 'category',
      C.CATEGORIES.map(function (c) { return { value: c.key, label: c.emoji + ' ' + c.name }; }),
      byCat, s.total);

    html += filterGroup('所在区域', 'area',
      C.AREAS.map(function (a) { return { value: a, label: a }; }),
      byArea, s.total);

    html += filterGroup('处理状态', 'status', [
      { value: C.STATUS.OPEN, label: '寻找中' },
      { value: C.STATUS.DONE, label: '已归还' }
    ], byStatus, s.total);

    if (hasActiveFilter()) {
      html += '<div class="filter-group"><button class="sidebar__reset" data-act="reset">' +
        '<svg class="icon" style="width:14px;height:14px;vertical-align:-2px"><use href="#i-refresh"/></svg> ' +
        '重置全部筛选</button></div>';
    }
    $('#sidebar').innerHTML = html;
  }

  function hasActiveFilter() {
    return ['type', 'category', 'area', 'status'].some(function (k) { return filters[k] !== 'all'; });
  }

  /* ══════════════════ 视图：列表 ══════════════════ */

  function viewList() {
    var list = C.query(items, filters);
    var total = items.length;

    var pills = '';
    var dimLabels = { type: '类型', category: '分类', area: '区域', status: '状态' };
    var dimNames = {
      type: { lost: '寻物启事', found: '失物招领' },
      status: { open: '寻找中', done: '已归还' }
    };
    ['type', 'category', 'area', 'status'].forEach(function (dim) {
      if (filters[dim] === 'all') return;
      var label = (dimNames[dim] && dimNames[dim][filters[dim]]) ||
        (dim === 'category' ? catOf(filters[dim]).name : filters[dim]);
      pills += '<span class="pill">' + dimLabels[dim] + '：' + C.escapeHtml(label) +
        '<button data-act="filter" data-dim="' + dim + '" data-value="all" title="移除">' +
        '<svg class="icon"><use href="#i-close"/></svg></button></span>';
    });
    if (filters.keyword) {
      pills += '<span class="pill">关键词：' + C.escapeHtml(filters.keyword) +
        '<button data-act="clear-kw" title="移除">' +
        '<svg class="icon"><use href="#i-close"/></svg></button></span>';
    }

    var body;
    if (!total) {
      body = emptyState('还没有任何信息',
        '点击右上角「发布信息」，发布第一条寻物启事或失物招领吧',
        '<a class="btn btn--primary" href="#/publish">发布信息</a>');
    } else if (!list.length) {
      body = emptyState('没有符合条件的信息',
        '试着放宽筛选条件，或者换一个关键词搜索',
        '<button class="btn btn--ghost" data-act="reset">重置筛选条件</button>');
    } else {
      body = '<div class="grid">' + list.map(cardHTML).join('') + '</div>';
    }

    var sortHtml = '<select class="input" id="sortSelect" style="width:auto;height:36px;font-size:13px">' +
      SORT_OPTIONS.map(function (o) {
        return '<option value="' + o.key + '"' + (filters.sort === o.key ? ' selected' : '') + '>' +
          o.label + '</option>';
      }).join('') + '</select>';

    return '' +
      '<div class="toolbar">' +
        '<p class="toolbar__count">共 <b>' + list.length + '</b> 条信息' +
          (list.length !== total ? '（全部 ' + total + ' 条）' : '') + '</p>' +
        '<div class="toolbar__right">' + sortHtml + '</div>' +
      '</div>' +
      '<div class="active-filters">' + pills + '</div>' +
      body;
  }

  /* ══════════════════ 视图：详情 ══════════════════ */

  function viewDetail(id) {
    var item = C.findById(items, id);
    if (!item) {
      return emptyState('这条信息不存在或已被删除',
        '它可能已经被发布者删除了', '<a class="btn btn--ghost" href="#/list">返回列表</a>');
    }

    var cat = catOf(item.category);
    var mine = isMine(item);
    var hero = item.images && item.images.length
      ? '<img src="' + item.images[0] + '" alt="物品照片" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">'
      : cat.emoji;

    return '' +
      '<p style="margin-bottom:14px"><a class="btn btn--ghost btn--sm" href="#/list">' +
        '<svg class="icon" style="width:14px;height:14px"><use href="#i-back"/></svg>返回列表</a></p>' +
      '<article class="detail">' +
        '<div class="detail__hero" style="' + thumbStyle(cat) + '">' + hero +
          '<div class="detail__badges">' + typeTag(item) + statusTag(item) + '</div>' +
        '</div>' +
        '<div class="detail__body">' +
          '<h1 class="detail__title">' + C.escapeHtml(item.title) + '</h1>' +
          '<p class="detail__sub">' +
            '<svg class="icon"><use href="#i-clock"/></svg>' +
            (item.type === C.TYPE.LOST ? '丢失' : '拾获') + '于 ' + C.formatTime(item.occurredAt) +
            '<span style="color:var(--ink-4)">·</span>' +
            C.relativeTime(item.createdAt) + '发布' +
            (item.updatedAt !== item.createdAt ? '<span style="color:var(--ink-4)">·</span>状态更新于 ' + C.relativeTime(item.updatedAt) : '') +
          '</p>' +

          '<div class="infobox">' +
            '<div class="info-row"><span class="info-row__k">物品分类</span>' +
              '<span class="info-row__v">' + cat.emoji + ' ' + cat.name + '</span></div>' +
            '<div class="info-row"><span class="info-row__k">所在区域</span>' +
              '<span class="info-row__v">' + C.escapeHtml(item.area) + '</span></div>' +
            '<div class="info-row"><span class="info-row__k">' +
              (item.type === C.TYPE.LOST ? '丢失地点' : '拾获地点') + '</span>' +
              '<span class="info-row__v">' + C.escapeHtml(item.place) + '</span></div>' +
            '<div class="info-row"><span class="info-row__k">当前状态</span>' +
              '<span class="info-row__v" style="font-weight:600;color:' +
              (item.status === C.STATUS.DONE ? 'var(--ink-3)' : 'var(--found)') + '">' +
              (item.status === C.STATUS.DONE ? '已归还，感谢关注' : '仍在寻找中') + '</span></div>' +
          '</div>' +

          '<div class="section"><h2>详细描述</h2><p>' +
            (item.desc ? C.escapeHtml(item.desc) : '发布者没有填写补充描述') + '</p></div>' +

          '<div class="section"><h2>发布者</h2>' +
            '<div class="poster-card">' +
              '<span class="avatar">' + C.escapeHtml(C.str(item.publisher).slice(0, 1) || '匿') + '</span>' +
              '<div><p class="poster-card__name">' + C.escapeHtml(item.publisher) + '</p>' +
              '<p class="poster-card__sub">' +
                (item.contactType ? '联系方式类型：' + item.contactType : '联系方式待确认') +
              '</p></div>' +
            '</div>' +
          '</div>' +

          '<div class="notice">⚠️ <b>安全提示</b>：建议在校内公共场所当面交接。' +
            '贵重物品可先交由保卫处或楼栋值班室保管，切勿向对方转账或提供短信验证码。</div>' +

          '<div class="detail__actions">' +
            '<button class="btn btn--primary" data-act="contact" data-id="' + item.id + '">' +
              '<svg class="icon" style="width:16px;height:16px"><use href="#i-chat"/></svg>联系 TA</button>' +
            '<button class="btn btn--ghost" data-act="copy" data-id="' + item.id + '">复制联系方式</button>' +
            (mine
              ? '<button class="btn btn--ghost" data-act="status" data-id="' + item.id + '">修改状态</button>' +
                '<button class="btn btn--ghost" data-act="edit" data-id="' + item.id + '">' +
                  '<svg class="icon" style="width:15px;height:15px"><use href="#i-edit"/></svg>编辑</button>' +
                '<button class="btn btn--danger" data-act="delete" data-id="' + item.id + '">' +
                  '<svg class="icon" style="width:15px;height:15px"><use href="#i-trash"/></svg>删除</button>'
              : '') +
          '</div>' +
        '</div>' +
      '</article>';
  }

  /* ══════════════════ 视图：发布 / 编辑 ══════════════════ */

  /** 进入发布页时初始化草稿。只在路由切换时调用一次，
   *  否则用户切换"寻物/招领"后重渲染会被打回原值。 */
  function initDraft(editingId) {
    var editing = editingId ? C.findById(items, editingId) : null;
    draft = {
      type: editing ? editing.type : C.TYPE.LOST,
      images: editing && editing.images ? editing.images.slice() : [],
      editingId: editing ? editing.id : null
    };
  }

  function viewPublish() {
    var editing = draft.editingId ? C.findById(items, draft.editingId) : null;
    if (draft.editingId && !editing) {
      return emptyState('要编辑的信息不存在', '它可能已经被删除了',
        '<a class="btn btn--ghost" href="#/mine">返回我的发布</a>');
    }
    if (editing && !isMine(editing)) {
      return emptyState('只能编辑自己发布的信息', '这条信息不是你发布的',
        '<a class="btn btn--ghost" href="#/list">返回列表</a>');
    }

    var v = editing || {};
    var isLost = draft.type === C.TYPE.LOST;

    function catChips() {
      return C.CATEGORIES.map(function (c) {
        return '<button type="button" class="chip' + (v.category === c.key ? ' is-on' : '') +
          '" data-act="pick-cat" data-value="' + c.key + '">' + c.emoji + ' ' + c.name + '</button>';
      }).join('');
    }

    return '' +
      '<div class="page">' +
        '<div class="page__head">' +
          '<h1 class="page__title">' + (editing ? '编辑信息' : '发布信息') + '</h1>' +
          '<p class="page__desc">' +
            (editing ? '修改后点击保存，列表与详情会同步更新'
                     : '填写物品信息并发布，让更多同学看到。带 <span style="color:#E5484D">*</span> 为必填项') +
          '</p>' +
        '</div>' +
        '<div class="page__body">' +

          '<div class="segmented" id="typeSwitch">' +
            '<button type="button" data-act="pick-type" data-value="lost"' +
              (isLost ? ' class="is-on"' : '') + '>😟 我丢了东西（寻物启事）</button>' +
            '<button type="button" data-act="pick-type" data-value="found"' +
              (!isLost ? ' class="is-on"' : '') + '>🙌 我捡到东西（失物招领）</button>' +
          '</div>' +

          '<form id="publishForm" novalidate>' +
            '<div class="form-grid">' +

              '<div class="field field--full">' +
                '<label>物品照片 <span class="opt">选填，最多 3 张，自动压缩后保存在本地</span></label>' +
                '<div class="uploader" id="uploader"></div>' +
                '<input type="file" id="fileInput" accept="image/*" multiple hidden>' +
              '</div>' +

              '<div class="field">' +
                '<label for="fTitle">物品名称 <span class="req">*</span></label>' +
                '<input class="input" id="fTitle" maxlength="' + C.MAX_LEN.title + '" ' +
                  'placeholder="如：校园卡、黑色雨伞" value="' + C.escapeHtml(v.title || '') + '">' +
                '<p class="field__err" data-err="title"></p>' +
              '</div>' +

              '<div class="field">' +
                '<label for="fArea">所在区域 <span class="req">*</span></label>' +
                '<select class="input" id="fArea">' +
                  '<option value="">请选择区域</option>' +
                  C.AREAS.map(function (a) {
                    return '<option value="' + a + '"' + (v.area === a ? ' selected' : '') + '>' + a + '</option>';
                  }).join('') +
                '</select>' +
                '<p class="field__err" data-err="area"></p>' +
              '</div>' +

              '<div class="field field--full">' +
                '<label>物品分类 <span class="req">*</span></label>' +
                '<div class="chips" id="catChips">' + catChips() + '</div>' +
                '<p class="field__err" data-err="category"></p>' +
              '</div>' +

              '<div class="field">' +
                '<label for="fPlace" id="placeLabel">' +
                  (isLost ? '丢失地点' : '拾获地点') + ' <span class="req">*</span></label>' +
                '<input class="input" id="fPlace" maxlength="' + C.MAX_LEN.place + '" ' +
                  'placeholder="' + (isLost ? '如：第三教学楼 302 教室' : '如：第二食堂一楼门口') + '" ' +
                  'value="' + C.escapeHtml(v.place || '') + '">' +
                '<p class="field__err" data-err="place"></p>' +
              '</div>' +

              '<div class="field">' +
                '<label for="fTime" id="timeLabel">' +
                  (isLost ? '丢失时间' : '拾获时间') + ' <span class="opt">选填</span></label>' +
                '<input class="input" id="fTime" type="datetime-local" ' +
                  'value="' + toLocalInput(v.occurredAt) + '">' +
                '<p class="field__err" data-err="occurredAt"></p>' +
              '</div>' +

              '<div class="field field--full">' +
                '<label for="fDesc">详细描述 <span class="opt">选填，补充颜色、特征等便于失主确认</span></label>' +
                '<textarea class="input" id="fDesc" maxlength="' + C.MAX_LEN.desc + '" ' +
                  'placeholder="例如：卡面有轻微磨损，已用蓝色卡套包好，背面贴了一张公交卡贴纸">' +
                  C.escapeHtml(v.desc || '') + '</textarea>' +
                '<p class="counter"><span id="descCount">' + C.str(v.desc).length + '</span>/' +
                  C.MAX_LEN.desc + '</p>' +
                '<p class="field__err" data-err="desc"></p>' +
              '</div>' +

              '<div class="field field--full">' +
                '<label for="fContact">联系方式 <span class="req">*</span></label>' +
                '<input class="input" id="fContact" maxlength="' + C.MAX_LEN.contact + '" ' +
                  'placeholder="手机号 / 微信号 / QQ 号 / 邮箱" value="' + C.escapeHtml(v.contact || '') + '">' +
                '<p class="field__err" data-err="contact"></p>' +
              '</div>' +

              '<div class="field field--full">' +
                '<label for="fPublisher">发布者昵称 <span class="opt">选填，默认显示为「匿名同学」</span></label>' +
                '<input class="input" id="fPublisher" maxlength="12" placeholder="如：王同学" ' +
                  'value="' + C.escapeHtml(v.publisher || '') + '">' +
              '</div>' +

            '</div>' +

            '<div style="display:flex;gap:12px;margin-top:8px">' +
              '<button type="submit" class="btn btn--primary btn--lg" style="flex:1">' +
                (editing ? '保存修改' : '发 布') + '</button>' +
              '<button type="button" class="btn btn--ghost btn--lg" data-act="cancel">取消</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';
  }

  function toLocalInput(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    function p(n) { return n < 10 ? '0' + n : String(n); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
           'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function renderUploader() {
    var box = $('#uploader');
    if (!box) return;
    var html = draft.images.map(function (src, i) {
      return '<div class="uploader__shot">' +
        '<img src="' + src + '" alt="物品照片 ' + (i + 1) + '">' +
        '<button type="button" data-act="img-del" data-index="' + i + '" title="移除">' +
        '<svg class="icon"><use href="#i-close"/></svg></button></div>';
    }).join('');
    if (draft.images.length < 3) {
      html += '<button type="button" class="uploader__add" data-act="img-add">' +
        '<svg class="icon"><use href="#i-camera"/></svg><span>添加照片</span></button>';
    }
    box.innerHTML = html;
  }

  /**
   * 把图片压到最长边 720px、JPEG 质量 0.72 再转 dataURL。
   * 不压缩的话手机照片动辄 3~5MB，两三张就会撑爆 localStorage 的 5MB 配额。
   */
  function compressImage(file, maxSide, quality) {
    maxSide = maxSide || 720;
    quality = quality || 0.72;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('不是图片文件'));
      if (file.size > 12 * 1024 * 1024) return reject(new Error('图片过大（超过 12MB）'));

      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('读取文件失败')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('图片解析失败')); };
        img.onload = function () {
          var w = img.naturalWidth, h = img.naturalHeight;
          var scale = Math.min(1, maxSide / Math.max(w, h));
          w = Math.max(1, Math.round(w * scale));
          h = Math.max(1, Math.round(h * scale));

          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          try {
            resolve(canvas.toDataURL('image/jpeg', quality));
          } catch (e) {
            reject(new Error('图片处理失败'));
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function collectForm() {
    var typeEl = $('#typeSwitch .is-on');
    var catEl = $('#catChips .chip.is-on');
    return {
      type: typeEl ? typeEl.dataset.value : draft.type,
      title: $('#fTitle').value,
      category: catEl ? catEl.dataset.value : '',
      area: $('#fArea').value,
      place: $('#fPlace').value,
      occurredAt: $('#fTime').value ? new Date($('#fTime').value).toISOString() : null,
      desc: $('#fDesc').value,
      contact: $('#fContact').value,
      publisher: $('#fPublisher').value,
      images: draft.images
    };
  }

  function renderErrors(errors) {
    $$('[data-err]').forEach(function (el) { el.textContent = ''; });
    $$('.input').forEach(function (el) { el.classList.remove('is-error'); });
    var fieldMap = {
      title: '#fTitle', category: '#catChips', area: '#fArea',
      place: '#fPlace', contact: '#fContact', desc: '#fDesc', occurredAt: '#fTime'
    };
    var first = null;
    Object.keys(errors || {}).forEach(function (field) {
      var msgEl = $('[data-err="' + field + '"]');
      if (msgEl) msgEl.textContent = errors[field];
      var input = $(fieldMap[field]);
      if (input && input.classList.contains('input')) {
        input.classList.add('is-error');
        if (!first) first = input;
      }
    });
    if (first) {
      first.scrollIntoView({ block: 'center', behavior: 'smooth' });
      first.focus({ preventScroll: true });
    }
  }

  function submitForm() {
    var form = collectForm();
    var check = C.validateItem(form);
    if (!check.valid) {
      renderErrors(check.errors);
      var count = Object.keys(check.errors).length;
      toast('还有 ' + count + ' 处需要修改，已为你标出');
      return;
    }

    if (draft.editingId) {
      var next = C.updateItem(items, draft.editingId, {
        type: form.type, title: form.title, category: form.category, area: form.area,
        place: form.place, desc: form.desc, contact: form.contact,
        contactType: C.classifyContact(form.contact),
        occurredAt: form.occurredAt || undefined,
        publisher: form.publisher.trim() || '匿名同学',
        images: form.images
      });
      if (!next) { toast('保存失败，请检查填写内容'); return; }
      items = next;
      persist();
      renderSidebar();
      toast('修改已保存');
      location.hash = '#/item/' + draft.editingId;
      return;
    }

    var item = C.createItem(form);
    if (!item) { toast('发布失败，请检查填写内容'); return; }
    item.mine = true;
    items = [item].concat(items);
    persist();
    renderSidebar();
    openModal(
      '<h3>🎉 发布成功</h3>' +
      '<p class="modal__sub">这条信息已经出现在列表最前面，其他同学可以搜索到它</p>' +
      '<div class="modal__row"><span>物品名称</span><b>' + C.escapeHtml(item.title) + '</b></div>' +
      '<div class="modal__row"><span>类型</span><b>' +
        (item.type === C.TYPE.LOST ? '寻物启事' : '失物招领') + '</b></div>' +
      '<div class="modal__row"><span>地点</span><b>' + C.escapeHtml(item.area + ' · ' + item.place) + '</b></div>' +
      '<div class="modal__actions">' +
        '<button class="btn btn--ghost" data-act="close-modal">返回列表</button>' +
        '<button class="btn btn--primary" data-act="open" data-id="' + item.id + '">查看详情</button>' +
      '</div>'
    );
    resetDraft();
  }

  function resetDraft() {
    draft = { type: C.TYPE.LOST, images: [], editingId: null };
  }

  /* ══════════════════ 视图：我的发布 ══════════════════ */

  function viewMine() {
    var mine = myItems();
    var s = C.stats(mine);

    if (!mine.length) {
      return emptyState('你还没有发布过信息',
        '丢失或捡到物品时，来这里发布一条，让更多同学看到',
        '<a class="btn btn--primary" href="#/publish">发布信息</a>');
    }

    var sorted = C.sortItems(mine, 'latest');

    return '' +
      '<div class="statbar">' +
        '<div class="stat"><b>' + s.total + '</b><span>我发布的</span></div>' +
        '<div class="stat"><b>' + s.open + '</b><span>寻找中</span></div>' +
        '<div class="stat"><b>' + s.done + '</b><span>已归还</span></div>' +
        '<div class="stat"><b>' + s.resolvedRate + '%</b><span>找回率</span></div>' +
      '</div>' +
      '<div class="toolbar">' +
        '<p class="toolbar__count">共 <b>' + sorted.length + '</b> 条</p>' +
        '<div class="toolbar__right">' +
          '<button class="btn btn--ghost btn--sm" data-act="clear-mine">清空我的发布</button>' +
          '<a class="btn btn--primary btn--sm" href="#/publish">发布新信息</a>' +
        '</div>' +
      '</div>' +
      '<div class="grid">' + sorted.map(cardHTML).join('') + '</div>';
  }

  /* ══════════════════ 弹层内容 ══════════════════ */

  function openContactModal(item) {
    openModal(
      '<h3>联系发布者</h3>' +
      '<p class="modal__sub">建议先说明物品特征，方便对方确认是不是同一件</p>' +
      '<div class="modal__row"><span>联系方式</span><b>' + C.escapeHtml(item.contact) + '</b></div>' +
      '<div class="modal__row"><span>类型</span><b>' + C.escapeHtml(item.contactType || '未识别') + '</b></div>' +
      '<div class="modal__row"><span>发布者</span><b>' + C.escapeHtml(item.publisher) + '</b></div>' +
      '<div class="modal__actions">' +
        '<button class="btn btn--ghost" data-act="close-modal">关闭</button>' +
        '<button class="btn btn--primary" data-act="copy" data-id="' + item.id + '">复制联系方式</button>' +
      '</div>'
    );
  }

  function openStatusModal(item) {
    function opt(value, label) {
      return '<button class="opt' + (item.status === value ? ' is-on' : '') +
        '" data-act="set-status" data-id="' + item.id + '" data-value="' + value + '">' +
        '<span>' + label + '</span><svg class="icon"><use href="#i-check"/></svg></button>';
    }
    openModal(
      '<h3>修改信息状态</h3>' +
      '<p class="modal__sub">物品已找到或已归还时更新状态，能减少无效联系</p>' +
      opt(C.STATUS.OPEN, '🟡 寻找中') +
      opt(C.STATUS.DONE, '🟢 已找到 / 已归还') +
      '<div class="modal__actions"><button class="btn btn--ghost" data-act="close-modal">取消</button></div>'
    );
  }

  function openDeleteModal(item) {
    openModal(
      '<h3>确认删除</h3>' +
      '<p class="modal__sub">删除后无法恢复，确定要删除「' + C.escapeHtml(C.truncate(item.title, 16)) + '」吗？</p>' +
      '<div class="modal__actions">' +
        '<button class="btn btn--ghost" data-act="close-modal">取消</button>' +
        '<button class="btn btn--danger" data-act="confirm-delete" data-id="' + item.id + '">确认删除</button>' +
      '</div>'
    );
  }

  /* ══════════════════ 路由 ══════════════════ */

  var ROUTES = ['list', 'item', 'publish', 'mine'];

  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, '');
    var parts = raw.split('/');
    var name = parts[0] || 'list';
    if (ROUTES.indexOf(name) < 0) name = 'list';
    return { name: name, param: parts.slice(1).join('/') };
  }

  var lastRouteKey = null;

  function render() {
    var r = parseHash();
    var content = $('#content');

    // 进入发布页时重置草稿；同一路由内重渲染（如切换寻物/招领）不再重置
    var routeKey = r.name + '/' + r.param;
    if (routeKey !== lastRouteKey && r.name === 'publish') {
      initDraft(decodeURIComponent(r.param) || null);
    }
    lastRouteKey = routeKey;

    // 侧边筛选只在列表页出现
    if (r.name === 'list') {
      $('#layout').classList.remove('layout--plain');
      $('#sidebar').hidden = false;
      renderSidebar();
    } else {
      $('#layout').classList.add('layout--plain');
      $('#sidebar').hidden = true;
    }

    if (r.name === 'list')         content.innerHTML = viewList();
    else if (r.name === 'item')    content.innerHTML = viewDetail(decodeURIComponent(r.param));
    else if (r.name === 'publish') content.innerHTML = viewPublish();
    else if (r.name === 'mine')    content.innerHTML = viewMine();

    if (r.name === 'publish') renderUploader();

    // 顶栏导航高亮
    $$('[data-nav]').forEach(function (el) {
      el.classList.toggle('is-on', el.dataset.nav === r.name);
    });

    // 切换视图后回到顶部
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ══════════════════ 事件处理 ══════════════════ */

  var ACTIONS = {
    open: function (el) { location.hash = '#/item/' + el.dataset.id; },
    edit: function (el) { location.hash = '#/publish/' + el.dataset.id; },

    contact: function (el) {
      var item = C.findById(items, el.dataset.id);
      if (item) openContactModal(item);
    },

    copy: function (el) {
      var item = C.findById(items, el.dataset.id);
      if (!item) return;
      copyText(item.contact).then(function (ok) {
        toast(ok ? '联系方式已复制到剪贴板' : '复制失败，请长按或手动记录');
      });
    },

    status: function (el) {
      var item = C.findById(items, el.dataset.id);
      if (item) openStatusModal(item);
    },

    'set-status': function (el) {
      var next = C.changeStatus(items, el.dataset.id, el.dataset.value);
      if (!next) { toast('状态修改失败'); return; }
      items = next;
      persist();
      renderSidebar();
      render();
      closeModal();
      toast(el.dataset.value === C.STATUS.DONE ? '已标记为「已归还」' : '已改回「寻找中」');
    },

    delete: function (el) {
      var item = C.findById(items, el.dataset.id);
      if (item) openDeleteModal(item);
    },

    'confirm-delete': function (el) {
      var next = C.removeItem(items, el.dataset.id);
      closeModal();
      if (!next) { toast('删除失败'); return; }
      items = next;
      persist();
      renderSidebar();
      toast('信息已删除');
      if (parseHash().name === 'item') location.hash = '#/mine';
      else render();
    },

    'clear-mine': function () {
      openModal(
        '<h3>清空我的发布</h3>' +
        '<p class="modal__sub">将删除你发布的全部信息，此操作无法撤销</p>' +
        '<div class="modal__actions">' +
          '<button class="btn btn--ghost" data-act="close-modal">取消</button>' +
          '<button class="btn btn--danger" data-act="confirm-clear-mine">确认清空</button>' +
        '</div>'
      );
    },

    'confirm-clear-mine': function () {
      items = items.filter(function (it) { return !it.mine; });
      persist();
      closeModal();
      renderSidebar();
      render();
      toast('已清空我的发布');
    },

    filter: function (el) {
      filters[el.dataset.dim] = el.dataset.value;
      renderSidebar();
      render();
    },

    'clear-kw': function () {
      filters.keyword = '';
      $('#searchInput').value = '';
      $('#searchClear').hidden = true;
      render();
    },

    reset: function () {
      filters.type = filters.category = filters.area = filters.status = 'all';
      renderSidebar();
      render();
      toast('已重置筛选条件');
    },

    'pick-type': function (el) {
      var v = el.dataset.value;
      // 先读走用户已填的内容，重建表单切换"丢失/拾获"文案后再填回去
      var snapshot = collectForm();
      draft.type = v;
      snapshot.type = v;
      render();
      restoreForm(snapshot);
    },

    'pick-cat': function (el) {
      $$('#catChips .chip').forEach(function (c) { c.classList.toggle('is-on', c === el); });
    },

    'img-add': function () { $('#fileInput').click(); },

    'img-del': function (el) {
      draft.images.splice(Number(el.dataset.index), 1);
      renderUploader();
    },

    cancel: function () { history.length > 1 ? history.back() : (location.hash = '#/list'); },
    'close-modal': function () { closeModal(); }
  };

  /** 切换寻物/招领后把用户已填的内容填回去 */
  function restoreForm(snapshot) {
    if (!snapshot) return;
    var map = {
      title: '#fTitle', place: '#fPlace', desc: '#fDesc',
      contact: '#fContact', publisher: '#fPublisher'
    };
    Object.keys(map).forEach(function (k) {
      var el = $(map[k]);
      if (el && snapshot[k]) el.value = snapshot[k];
    });
    var area = $('#fArea');
    if (area && snapshot.area) area.value = snapshot.area;
    if (snapshot.category) {
      $$('#catChips .chip').forEach(function (c) {
        c.classList.toggle('is-on', c.dataset.value === snapshot.category);
      });
    }
    $('#descCount').textContent = C.str(snapshot.desc).length;
    draft.images = snapshot.images || draft.images;
    renderUploader();
  }

  function bindEvents() {
    // 统一的事件委托：所有带 data-act 的元素都从这里分发
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el) return;
      var handler = ACTIONS[el.dataset.act];
      if (!handler) return;
      // 卡片上的按钮不应同时触发卡片的"打开详情"
      e.preventDefault();
      handler(el);
    });

    // 列表排序
    document.addEventListener('change', function (e) {
      if (e.target.id === 'sortSelect') {
        filters.sort = e.target.value;
        render();
      }
    });

    // 顶栏搜索
    var search = $('#searchInput');
    var timer = null;
    search.addEventListener('input', function () {
      $('#searchClear').hidden = !search.value;
      clearTimeout(timer);
      timer = setTimeout(function () {          // 防抖，避免每敲一个字就重排
        filters.keyword = search.value.trim();
        if (parseHash().name !== 'list') location.hash = '#/list';
        else render();
      }, 180);
    });
    search.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        clearTimeout(timer);
        filters.keyword = search.value.trim();
        if (parseHash().name !== 'list') location.hash = '#/list';
        else render();
      }
    });
    $('#searchClear').addEventListener('click', function () {
      search.value = '';
      $('#searchClear').hidden = true;
      filters.keyword = '';
      render();
    });

    // 表单提交
    document.addEventListener('submit', function (e) {
      if (e.target.id === 'publishForm') {
        e.preventDefault();
        submitForm();
      }
    });

    // 描述字数
    document.addEventListener('input', function (e) {
      if (e.target.id === 'fDesc') {
        $('#descCount').textContent = e.target.value.length;
      }
    });

    // 图片选择
    document.addEventListener('change', function (e) {
      if (e.target.id !== 'fileInput') return;
      var files = Array.prototype.slice.call(e.target.files || []);
      var room = 3 - draft.images.length;
      if (room <= 0) { toast('最多上传 3 张照片'); return; }
      files.slice(0, room).forEach(function (file) {
        compressImage(file).then(function (dataUrl) {
          draft.images.push(dataUrl);
          renderUploader();
        }).catch(function (err) {
          toast('「' + file.name + '」处理失败：' + err.message);
        });
      });
      e.target.value = '';
    });

    // 弹层：点遮罩或按 Esc 关闭
    $('#modal').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    window.addEventListener('hashchange', render);
  }

  /* ══════════════════ 启动 ══════════════════ */

  function init() {
    var isFirstVisit = !store.load();
    loadItems();
    bindEvents();
    render();
    if (isFirstVisit) {
      setTimeout(function () {
        toast('已载入演示数据，可直接浏览，也可以发布你自己的信息');
      }, 700);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
