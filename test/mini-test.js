/*!
 * mini-test.js —— 极简单元测试框架
 * ------------------------------------------------------------------
 * 为什么不用 Jest / Mocha？
 *   本项目的硬性要求是「下载全部文件后，用 Chrome 直接打开 html 就能看到
 *   预期结果」。引入 npm 工具链意味着助教必须装 Node、跑 install，反而
 *   抬高了验收门槛。所以这里实现一个零依赖的断言库，API 刻意模仿
 *   Jest（describe / it / expect / beforeEach），日后要迁移到 Jest
 *   只需把 test/index.html 换成 npm 脚本，测试用例本身一行不用改。
 *
 * 支持：describe / it / beforeEach /
 *      expect(x).toBe / toEqual / toBeTruthy / toBeFalsy / toBeNull /
 *                toContain / toHaveLength / toBeGreaterThan /
 *                toThrow / toBeTypeOf
 *      以及 .not 取反
 */
(function (global) {
  'use strict';

  var suites = [];
  var stack = [];

  /* ────────── 用例组织 ────────── */

  function describe(name, fn) {
    var suite = { name: name, tests: [], beforeEach: null };
    suites.push(suite);
    stack.push(suite);
    fn();
    stack.pop();
  }

  function it(name, fn) {
    var suite = stack[stack.length - 1];
    if (!suite) throw new Error('it() 必须写在 describe() 内：「' + name + '」');
    suite.tests.push({ name: name, fn: fn });
  }

  function beforeEach(fn) {
    var suite = stack[stack.length - 1];
    if (suite) suite.beforeEach = fn;
  }

  /* ────────── 断言 ────────── */

  function stringify(v) {
    if (typeof v === 'string') return '"' + v + '"';
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'function') return '[Function]';
    if (Array.isArray(v)) return '[' + v.map(stringify).join(', ') + ']';
    if (typeof v === 'object') {
      try {
        return JSON.stringify(v);
      } catch (e) { return String(v); }
    }
    return String(v);
  }

  /** 递归比较，用于 toEqual */
  function deepEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null || a === undefined || b === undefined) return false;
    if (typeof a !== 'object' || typeof b !== 'object') {
      return a !== a && b !== b;            // 处理 NaN === NaN
    }
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    var ka = Object.keys(a);
    var kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(function (k) {
      return Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]);
    });
  }

  function Assertion(actual, negated, label) {
    this.actual = actual;
    this.negated = !!negated;
    this.label = label || '';
  }

  Object.defineProperty(Assertion.prototype, 'not', {
    get: function () { return new Assertion(this.actual, !this.negated, this.label); }
  });

  function verdict(self, pass, positiveMessage, negativeMessage) {
    var ok = self.negated ? !pass : pass;
    if (!ok) {
      throw new Error(self.negated ? (negativeMessage || ('不应该满足：' + positiveMessage))
                                   : positiveMessage);
    }
    return self;
  }

  Assertion.prototype.toBe = function (expected) {
    return verdict(this,
      this.actual === expected,
      '期望 ' + stringify(this.actual) + ' 等于 ' + stringify(expected),
      '期望 ' + stringify(this.actual) + ' 不等于 ' + stringify(expected));
  };

  Assertion.prototype.toEqual = function (expected) {
    return verdict(this,
      deepEqual(this.actual, expected),
      '期望 ' + stringify(this.actual) + ' 深等于 ' + stringify(expected),
      '期望 ' + stringify(this.actual) + ' 不深等于 ' + stringify(expected));
  };

  Assertion.prototype.toBeTruthy = function () {
    return verdict(this, !!this.actual,
      '期望 ' + stringify(this.actual) + ' 为真值', '期望 ' + stringify(this.actual) + ' 为假值');
  };

  Assertion.prototype.toBeFalsy = function () {
    return verdict(this, !this.actual,
      '期望 ' + stringify(this.actual) + ' 为假值', '期望 ' + stringify(this.actual) + ' 为真值');
  };

  Assertion.prototype.toBeNull = function () {
    return verdict(this, this.actual === null,
      '期望 ' + stringify(this.actual) + ' 为 null', '期望不为 null 但得到了 null');
  };

  Assertion.prototype.toBeUndefined = function () {
    return verdict(this, this.actual === undefined,
      '期望 ' + stringify(this.actual) + ' 为 undefined', '期望不为 undefined');
  };

  Assertion.prototype.toBeTypeOf = function (type) {
    return verdict(this, typeof this.actual === type,
      '期望 ' + stringify(this.actual) + ' 的类型是 ' + type + '，实际是 ' + typeof this.actual,
      '期望类型不是 ' + type);
  };

  Assertion.prototype.toContain = function (needle) {
    var a = this.actual;
    var pass = Array.isArray(a) ? a.indexOf(needle) >= 0
             : typeof a === 'string' ? a.indexOf(needle) >= 0
             : false;
    return verdict(this, pass,
      '期望 ' + stringify(a) + ' 包含 ' + stringify(needle),
      '期望 ' + stringify(a) + ' 不包含 ' + stringify(needle));
  };

  Assertion.prototype.toHaveLength = function (n) {
    var len = this.actual && this.actual.length;
    return verdict(this, len === n,
      '期望长度为 ' + n + '，实际为 ' + stringify(len),
      '期望长度不为 ' + n);
  };

  Assertion.prototype.toBeGreaterThan = function (n) {
    return verdict(this, this.actual > n,
      '期望 ' + stringify(this.actual) + ' 大于 ' + stringify(n),
      '期望 ' + stringify(this.actual) + ' 不大于 ' + stringify(n));
  };

  Assertion.prototype.toThrow = function (fragment) {
    var thrown = null;
    try { this.actual(); } catch (e) { thrown = e; }
    var pass = thrown !== null &&
      (!fragment || String(thrown.message).indexOf(fragment) >= 0);
    return verdict(this, pass,
      '期望抛出异常' + (fragment ? '（包含「' + fragment + '」）' : '') + '，但没有抛出',
      '期望不抛出异常，但抛出了：' + (thrown && thrown.message));
  };

  function expect(actual) { return new Assertion(actual); }

  /* ────────── 执行 ────────── */

  function run() {
    var results = { total: 0, passed: 0, failed: 0, suites: [], duration: 0 };
    var started = (global.performance || Date).now();

    suites.forEach(function (suite) {
      var suiteResult = { name: suite.name, tests: [] };
      suite.tests.forEach(function (test) {
        var entry = { name: test.name, passed: true, error: null };
        results.total++;
        try {
          if (suite.beforeEach) suite.beforeEach();
          test.fn();
        } catch (err) {
          entry.passed = false;
          entry.error = err && err.message ? err.message : String(err);
        }
        if (entry.passed) results.passed++; else results.failed++;
        suiteResult.tests.push(entry);
      });
      results.suites.push(suiteResult);
    });

    results.duration = Math.round(((global.performance || Date).now() - started) * 100) / 100;
    return results;
  }

  global.MiniTest = {
    describe: describe,
    it: it,
    beforeEach: beforeEach,
    expect: expect,
    run: run,
    /** 供测试自己造数据时复用 */
    deepEqual: deepEqual
  };
})(typeof window !== 'undefined' ? window : globalThis);
