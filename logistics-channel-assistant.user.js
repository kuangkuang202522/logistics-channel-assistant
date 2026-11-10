// ==UserScript==
// @name         物流渠道判断助手
// @namespace    local.logistics.channel
// @version      1.4.0
// @homepageURL  https://kuangkuang202522.github.io/logistics-channel-assistant/
// @updateURL    https://raw.githubusercontent.com/kuangkuang202522/logistics-channel-assistant/main/logistics-channel-assistant.user.js
// @downloadURL  https://raw.githubusercontent.com/kuangkuang202522/logistics-channel-assistant/main/logistics-channel-assistant.user.js
// @supportURL   https://github.com/kuangkuang202522/logistics-channel-assistant/issues
// @description  马帮/TB 页面悬浮物流渠道判断：自动读取当前页、美国5货件分组、加拿大分区、德英货代选择；支持按仓库+货代+渠道自动勾选货件并生成发货单；打印时自动隐藏面板；新增 IMO1/ITX3/ICA3 特例仓与空运识别兜底；v1.4.0 默认0.5秒快速识别，识别不全时同一按钮手动切换全量识别
// @author       local
// @match        https://www.mabangerp.com/*
// @match        https://amz1.mabangerp.com/*
// @match        https://*.mabangerp.com/*
// @match        https://www.teambition.com/*
// @match        https://*.teambition.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  if (window.__logisticsChannelAssistant) return;
  window.__logisticsChannelAssistant = true;
  const IS_INVOICE_PAGE = /\/generateInvoice\b/.test(location.pathname);
  const staleNotice = document.getElementById('lca-fixed-notice');
  if (staleNotice) staleNotice.remove();

  // 外层 www 的 FBA 货件页只负责嵌 iframe，不在外层创建面板；
  // 只让 amz1 iframe 内的面板生效，避免出现两个按钮、其中一个读不到表格。
  const isOuterFbaPage = window.top === window.self &&
    /[?&]mod=main\.fbaCargo(?:&|$)/.test(location.search);
  if (isOuterFbaPage) {
    console.info('[物流渠道助手] 外层 FBA 页面：脚本会在内层 amz1 iframe 中运行；若右下角没有按钮，请把篡改猴的「仅在顶层页面（框架）运行」设为「否」。');
    return;
  }
  const hasFbaIframe = window.top === window.self &&
    Array.from(document.querySelectorAll('iframe')).some(f => /fbaCargo/i.test(f.src || ''));
  if (hasFbaIframe) {
    console.info('[物流渠道助手] 检测到 fbaCargo iframe：请在篡改猴脚本设置中把「仅在顶层页面（框架）运行」设为「否」，否则内层表格读不到。');
    return;
  }

  // 打印时隐藏脚本自己的悬浮按钮/面板和顶部提示，避免它们被排到第二页。
  const printGuard = document.createElement('style');
  printGuard.id = 'lca-print-guard';
  printGuard.textContent = '@media print{#lca-host,#lca-fixed-notice{display:none!important}}';
  (document.head || document.documentElement).appendChild(printGuard);

  // ---------- 规则数据（与 channel_pick.html 保持一致） ----------
  // 这三个仓在天盛海运按美东处理，渠道选盛森提。
  const TS_SPECIAL = ['IMO1', 'ITX3', 'ICA3'];
  const METHOD_NAMES = ['海运', '空运', '卡航', '快递', '铁路'];
  const SPECIAL = {
    MCI4: ['美东', '特例仓，需单独报关'], MEM1: ['美中', '特例仓'], RFD2: ['美东', '特例仓'],
    TOL3: ['美东', '特例仓'], LAN2: ['美东', '特例仓'], AKR1: ['美东', '特例仓'],
    LAX9: ['美西', '特例仓'], CMH2: ['美东', '特例仓'], CMH3: ['美东', '特例仓'],
    BJC1: ['美东', '特例仓'],
    IMO1: ['美东', '特例仓，天盛海运盛森提'],
    ITX3: ['美东', '特例仓，天盛海运盛森提'],
    ICA3: ['美东', '特例仓，天盛海运盛森提']
  };
  const KNOWN = {
    GYR3: '美西', GYR2: '美西', SBD1: '美西', SCK4: '美西', ONT8: '美西', LGB8: '美西', VGT2: '美西',
    PSP3: '美西', LAS1: '美西', SMF3: '美西', MIT2: '美西', POC1: '美西', POC3: '美西', ABQ2: '美西', MCC1: '美西',
    MQJ1: '美中', IND9: '美中', MDW2: '美中', FTW1: '美中', FWA4: '美中', IAH3: '美中', BJC1: '美东',
    ABE8: '美东', AVP1: '美东', CLT2: '美东', TEB9: '美东', RDU2: '美东', ORF2: '美东', RMN3: '美东',
    MQY2: '美东', HGR6: '美东', ABE1: '美东', ABE2: '美东', ABE3: '美东', ABE4: '美东', ABE5: '美东'
  };
  const CA_EAST = ['XYY4', 'YYZ1', 'YYZ2', 'YYZ3', 'YYZ4', 'YYZ5', 'YYZ6', 'YYZ7', 'YYZ8', 'YYZ9', 'Y001', 'YOO1', 'YHM1', 'YXU1', 'YGK1', 'YOW1', 'YOW2', 'YOW3', 'YUL2'];
  const CA_WEST = ['YVR1', 'YVR2', 'YVR3', 'YVR4', 'YXX2', 'YYC1', 'YYC2', 'YYC3', 'YYC4', 'YYC5', 'YYC6', 'YEG1', 'YEG2'];

  const US_SEA = {
    '天盛': { 美东: '盛森提', 美中: '美中-盛森达Pro', 美西: '美西-盛森达Pro' },
    '瑞易达': { 美东: '美森限时达', 美中: '美中-美森正班卡派', 美西: '美西-美森正班卡派' },
    '铭运': { 美东: '美森快船正班船-UPS派', 美中: '美中-美森快船正班船-卡派', 美西: '美西-美森快船正班船-卡派' }
  };
  const CA_SEA = {
    '铭运': { 加东: '加东-美转加美森正班限时达-卡派', 加西: '加西-美转加美森正班限时达-卡派', 其余: '美转加美森正班限时达-UPS派' },
    // 瑞易达加拿大是一条大区渠道，不分加东加西（channel_pick.html 旧版漏了这条）
    '瑞易达': { 加东: '加拿大海运', 加西: '加拿大海运', 其余: '加拿大海运' }
  };
  const CA_AIR = { '瑞易达': '加拿大空运-CN', '铭运': '加拿大空运' };
  const DE_AIR = { '铭运': '欧洲空派包税B价-大陆飞', '瑞易达': '欧洲空运CN' };
  const DE_TRUCK = { '铭运': '欧洲卡航-包税', '瑞易达': '中欧卡航包税' };
  const UK_AIR = { '瑞易达': '英国空运-CN', '铭运': '英国空派-递延不包税' };
  const UK_TRUCK = { '瑞易达': '英国卡航VAT', '铭运': '英国卡航-递延' };
  // 瑞易达卡航：非德国、非英国（法国/意大利/西班牙/荷兰/波兰）走中欧丝路
  const EU_TRUCK = { '瑞易达': '中欧丝路' };
  const EXPRESS = { '瑞易达': 'UPS-WE特快包税' };
  const COUNTRY_NAMES = ['美国', '加拿大', '德国', '英国', '法国', '意大利', '西班牙', '荷兰', '波兰'];

  // ---------- 生成发货单：货代 id 与实际渠道名 ----------
  const CARRIER_ID = { '天盛': 36298, '铭运': 25932, '瑞易达': 27168 };
  const CARRIER_LABEL = { '天盛': '天盛物流', '铭运': '广东铭运物流', '瑞易达': '瑞易达物流' };
  const MB_CHANNELS = {
    '天盛': ['空运天敏提', '空运天翼提', '海运盛森提Pro', '海运盛森达Pro', '海运盛森达', '海运盛森提', '海运盛稳达'],
    '铭运': [
      '快递物流', '香港UPS红单包税-5000', '卡航物流', '海运物流',
      '英国空派-递延不包税（香港/韩国飞）', '美国海运-美森快船正班船-卡派',
      '美国海运-美森快船正班船-UPS派送', '美转加美森正班限时达-UPS派（CLX）',
      '美转加美森正班限时达-卡派（CLX）', '加拿大快递', '加拿大空派-经济专线（6000）',
      '英国卡航-递延（不包税）', '英国铁路-递延不包税', '欧洲空派包税B价-大陆飞',
      '英国空派-递延不包税 （经济线）', '英国空派-递延不包税（快线）',
      '欧洲铁路-卡派直送', '欧洲空派包税C价-香港/韩国飞-（带电）', '欧洲卡航-包税'
    ],
    '瑞易达': [
      '快递物流', '空运物流', '卡航物流', '海运物流', '铁路物流', '美森限时达', '美森卡派',
      '英国空运VAT-CN', '美国空运-CN', '加拿大快递', '加拿大空运-CN', '欧洲空运-CN',
      'UPS-WE包税', 'UPS-WE特快包税', '大陆UPS红单', '英国空运-CN', '中欧卡航包税',
      '英国卡航VAT', '英国铁路普快VAT', '英国铁路特快VAT', '加拿大限时达',
      '加拿大美森海卡', '中欧班列普快', '中欧丝路'
    ]
  };
  const CHANNEL_ALIAS = {
    '天盛|天敏提': '空运天敏提',
    '天盛|天翼提': '空运天翼提',
    '天盛|盛森提': '海运盛森提',
    '天盛|美中-盛森达Pro': '海运盛森达Pro',
    '天盛|美西-盛森达Pro': '海运盛森达Pro',
    '天盛|盛森达': '海运盛森达',
    '铭运|美森快船正班船-UPS派': '美国海运-美森快船正班船-UPS派送',
    '铭运|美森快船正班船-卡派': '美国海运-美森快船正班船-卡派',
    '铭运|美中-美森快船正班船-卡派': '美国海运-美森快船正班船-卡派',
    '铭运|美西-美森快船正班船-卡派': '美国海运-美森快船正班船-卡派',
    '铭运|加东-美转加美森正班限时达-卡派': '美转加美森正班限时达-卡派（CLX）',
    '铭运|加西-美转加美森正班限时达-卡派': '美转加美森正班限时达-卡派（CLX）',
    '铭运|美转加美森正班限时达-UPS派': '美转加美森正班限时达-UPS派（CLX）',
    '铭运|加拿大空运': '加拿大空派-经济专线（6000）',
    '铭运|英国空派-递延不包税': '英国空派-递延不包税 （经济线）',
    '铭运|英国卡航-递延': '英国卡航-递延（不包税）',
    '瑞易达|美中-美森正班卡派': '美森卡派',
    '瑞易达|美西-美森正班卡派': '美森卡派',
    '瑞易达|加拿大海运': '加拿大美森海卡',
    '瑞易达|欧洲空运CN': '欧洲空运-CN',
    '瑞易达|英国空运-CN': '英国空运-CN',
    '瑞易达|英国卡航VAT': '英国卡航VAT',
    '瑞易达|中欧卡航包税': '中欧卡航包税',
    '瑞易达|UPS-WE特快包税': 'UPS-WE特快包税'
  };
  const QUEUE_KEY = 'lca_invoice_queue';
  const DRY_KEY = 'lca_dry_run';

  let ROWS = [];
  let ROWS_SOURCE = '';

  // ---------- 工具 ----------
  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function zipOf(address) {
    const tokens = String(address || '').replace(/[-,，]/g, ' ').split(/\s+/);
    const hits = tokens.filter(t => /^[0-9]{5}$/.test(t));
    return hits.length ? hits[hits.length - 1] : '';
  }
  function usRegion(code, address) {
    if (SPECIAL[code]) return SPECIAL[code];
    const zip = zipOf(address);
    if (zip) {
      const d = parseInt(zip[0], 10);
      if (d <= 3) return ['美东', '邮编首位'];
      if (d <= 7) return ['美中', '邮编首位'];
      return ['美西', '邮编首位'];
    }
    if (KNOWN[code]) return [KNOWN[code], '已核对仓表'];
    return ['', '未收录仓库'];
  }
  function caRegion(code, address) {
    if (CA_EAST.indexOf(code) >= 0) return ['加东', '加拿大仓名单'];
    if (CA_WEST.indexOf(code) >= 0) return ['加西', '加拿大仓名单'];
    const up = String(address || '').toUpperCase();
    if (/( ON| QC| NB| NS| PE| NL)/.test(up)) return ['加东', '省份缩写'];
    if (/( BC| AB| SK| MB)/.test(up)) return ['加西', '省份缩写'];
    return ['其余', '加拿大仓不在东西名单'];
  }
  function countryFromStore(store) {
    const m = String(store || '').match(/号(美国|加拿大|德国|英国)站/);
    return m ? m[1] : '';
  }

  function countryFromAddress(address) {
    const text = String(address || '');
    if (/\bGB\b|united kingdom/i.test(text)) return '英国';
    if (/germany|deutschland/i.test(text)) return '德国';
    if (/canada/i.test(text)) return '加拿大';
    if (/\bUS\b|united states/i.test(text)) return '美国';
    return '';
  }

  function normalizeMethod(value) {
    const text = String(value || '').trim();
    const m = text.match(/(海运|空运|卡航|快递|铁路)/);
    return m ? m[1] : text;
  }

  function isKnownMethod(value) {
    return METHOD_NAMES.indexOf(value) >= 0;
  }

  function isTsSpecialWarehouse(code) {
    return TS_SPECIAL.indexOf(String(code || '').trim().toUpperCase()) >= 0;
  }

  // VXE 的运输方式字段在不同页面可能是 transport / logistics_name / 数字编码。
  // 逐个字段找，再从常见嵌套对象里找，避免第一个字段是数字就误判为空。
  function methodFromItem(item) {
    if (!item) return '';
    const keys = [
      'transport', 'transport_name', 'transportName',
      'logistics_name', 'logisticsName',
      'delivery_type', 'deliveryType',
      'method', 'shipping_method', 'shippingMethod',
      'logistics_channel', 'logisticsChannel', 'channel_name', 'channelName', 'logisticsChannelName',
      // 马帮 FBA 货件页的运输方式写在备注字段 printRemark 里，例如「空运」「卡航：新品」。
      'printRemark', 'print_remark', 'printRemarks', 'print_remarks',
      'remark', 'shippName', 'shipment_name', 'shipmentName'
    ];
    for (const key of keys) {
      const method = normalizeMethod(item[key]);
      if (isKnownMethod(method)) return method;
    }
    const nestedKeys = ['deliveryList', 'stockList', 'logistics', 'logisticsInfo', 'transportInfo', 'channelInfo', 'channel'];
    for (const key of nestedKeys) {
      const value = item[key];
      if (!value) continue;
      const list = Array.isArray(value) ? value : [value];
      for (const entry of list) {
        if (!entry || typeof entry !== 'object') continue;
        for (const childKey of keys) {
          const method = normalizeMethod(entry[childKey]);
          if (isKnownMethod(method)) return method;
        }
      }
    }
    return '';
  }

  // 如果 VXE 数据里没有运输方式，再从当前表格行文本里兜底找一次。
  // 按行建一次缓存，避免 SKU 多时每一票都扫一遍 DOM。
  let domMethodMap = null;
  function methodFromDom(no) {
    if (!domMethodMap) {
      domMethodMap = new Map();
      const rows = Array.from(document.querySelectorAll('.vxe-body--row, .vxe-table--body tr'));
      for (const row of rows) {
        const text = row.innerText || '';
        const noMatch = text.match(/FBA[0-9A-Z]{8,}/);
        const methodMatch = text.match(/(海运|空运|卡航|快递|铁路)/);
        if (noMatch && methodMatch && !domMethodMap.has(noMatch[0])) {
          domMethodMap.set(noMatch[0], methodMatch[1]);
        }
      }
    }
    if (domMethodMap.has(no)) return domMethodMap.get(no);
    const all = document.body.innerText || '';
    const idx = all.indexOf(no);
    if (idx >= 0) {
      const m = all.slice(idx, idx + 500).match(/(海运|空运|卡航|快递|铁路)/);
      if (m) return m[1];
    }
    return '';
  }

  function pick(obj, keys) {
    if (!obj) return '';
    for (const key of keys) {
      if (obj[key] === undefined || obj[key] === null || obj[key] === '') continue;
      const value = obj[key];
      if (typeof value === 'string' || typeof value === 'number') return String(value);
    }
    return '';
  }

  function countryFromCode(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/美国|united states/i.test(text) || /^(us|usa)$/i.test(text)) return '美国';
    if (/加拿大|canada/i.test(text) || /^(ca|can)$/i.test(text)) return '加拿大';
    if (/德国|germany|deutschland/i.test(text) || /^(de|ger)$/i.test(text)) return '德国';
    if (/英国|united kingdom/i.test(text) || /^(uk|gb|gbr)$/i.test(text)) return '英国';
    if (/法国|france/i.test(text) || /^(fr|fra)$/i.test(text)) return '法国';
    if (/意大利|italy/i.test(text) || /^(it|ita)$/i.test(text)) return '意大利';
    if (/西班牙|spain/i.test(text) || /^(es|esp)$/i.test(text)) return '西班牙';
    if (/荷兰|netherlands/i.test(text) || /^(nl|nld)$/i.test(text)) return '荷兰';
    if (/波兰|poland/i.test(text) || /^(pl|pol)$/i.test(text)) return '波兰';
    return '';
  }

  function normalizeCountry(value, store, address) {
    const c = countryFromCode(value);
    if (COUNTRY_NAMES.indexOf(c) >= 0) return c;
    // 马帮 VXE 的 country 有时是数字/内部 ID；此时用店铺名、FBA 地址兜底。
    return countryFromStore(store) || countryFromAddress(address) || '美国';
  }

  // 优先从页面表格的 Vue/vxe 数据里读；读不到再解析页面文本。
  // 合并所有 vxe 表格，避免只读第一张表导致货件不全。
  function shippNoOf(item) {
    return pick(item, ['shippNo', 'shipp_no', 'shipmentNo', 'shipment_no', 'fbaNo', 'fba_no', 'shippCode', 'shipp_code', 'shipmentCode', 'shipment_code', 'fbaCode', 'fba_code']).trim();
  }

  function readVxeRows() {
    domMethodMap = null;
    const tables = Array.from(document.querySelectorAll('.vxe-table'));
    const rows = [], seen = new Set();
    for (const table of tables) {
      const vm = table.__vue__;
      if (!vm || typeof vm.getTableData !== 'function') continue;
      const tableData = vm.getTableData() || {};
      const full = tableData.fullData;
      let data = (Array.isArray(full) && full.length ? full : (tableData.tableData || vm.tableData || []));
      if (!Array.isArray(data)) data = [];

      // 运输方式（空运/卡航等）通常写在子 SKU 行的 printRemark 上，父货件行反而为空。
      // 先按 parentId 和货件号把子行的方式收集起来，再回填给父货件。
      const childMethodByParent = new Map();
      const childMethodByNo = new Map();
      for (const item of data) {
        if (!item || !item.parentId) continue;
        const method = methodFromItem(item);
        if (!method) continue;
        const pid = String(item.parentId);
        if (!childMethodByParent.has(pid)) childMethodByParent.set(pid, method);
        const cno = shippNoOf(item);
        if (cno && !childMethodByNo.has(cno)) childMethodByNo.set(cno, method);
      }

      for (const item of data) {
        if (!item || item.parentId) continue; // 子商品行不参与货件级操作
        const no = shippNoOf(item);
        if (!/^(FBA[0-9A-Z]{8,}|[0-9A-Z]{6,}WFB)$/.test(no) || seen.has(no)) continue;
        seen.add(no);
        const address = item.fbaWarehouseAddress && typeof item.fbaWarehouseAddress === 'object'
          ? (item.fbaWarehouseAddress.address || item.fbaWarehouseAddress.postcode || '')
          : pick(item, ['address', 'fbaWarehouseAddress', 'warehouse_address', 'warehouseAddress']);
        const store = pick(item, ['shop_name', 'shopName', 'store_name', 'storeName', 'shop']);

        // 发货仓库 = 子商品行上的 warehouseId / warehouse_name，不是 FBA 目的仓
        const stocks = Array.isArray(item.stockList) ? item.stockList : [];
        const whPairs = [], whSeen = new Set();
        for (const s of stocks) {
          const wid = Number(s && (s.warehouseId || s.warehouse_id));
          const wname = String((s && s.warehouse_name) || '').trim();
          if (!wid || !wname) continue;
          const key = wid + '|' + wname;
          if (whSeen.has(key)) continue;
          whSeen.add(key);
          whPairs.push({ id: wid, name: wname });
        }
        const parentWhId = Number((String(item.warehouseId || '').match(/\d+/) || [])[0]) || 0;
        const parentWhName = pick(item, ['warehouse_name', 'warehouseName']);
        const warehouseId = whPairs.length === 1 ? whPairs[0].id : (whPairs.length ? 0 : parentWhId);
        const warehouseName = whPairs.length === 1 ? whPairs[0].name : (whPairs.length ? '' : parentWhName);

        rows.push({
          no,
          id: Number(item.id) || 0,
          shopName: store,
          store,
          country: normalizeCountry(pick(item, ['country_name', 'countryName', 'amazonsite', 'amazon_site', 'country_code', 'countryCode', 'country']), store, address),
          wh: pick(item, ['logistics_code', 'logisticsCode', 'warehouse', 'warehouseCode', 'warehouse_code', 'fba_warehouse', 'fbaWarehouse']),
          method: methodFromItem(item) || childMethodByParent.get(String(item.id)) || childMethodByNo.get(no) || methodFromDom(no),
          weight: pick(item, ['total_weights', 'totalWeight', 'weight', '装箱总重量']),
          address: String(address || ''),
          name: pick(item, ['shipment_name', 'shipmentName', 'shippName', 'name', 'content', 'remark', '货件名称']),
          warehouseId,
          warehouseName,
          multiWarehouse: whPairs.length > 1
        });
      }
    }
    return rows;
  }

  function readDomRows() {
    const rows = [], seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.nodeValue || '';
      const match = text.match(/FBA[0-9A-Z]{8,}/);
      if (!match) continue;
      const no = match[0];
      if (seen.has(no)) continue;

      let el = node.parentElement;
      let best = null;
      for (let i = 0; i < 15 && el; i++) {
        const t = el.innerText || '';
        const count = (t.match(/FBA[0-9A-Z]{8,}/g) || []).length;
        if (t.includes('物流中心编码') && t.includes('店铺') && count === 1 && t.length < 6000) {
          best = el;
          break;
        }
        el = el.parentElement;
      }
      if (!best) continue;

      const t = best.innerText || '';
      const wh = (t.match(/物流中心编码\s*([A-Z0-9]{3,6})/) || [])[1] || '';
      const store = (t.match(/店铺\s*([0-9]+号[^\s\n]+?站)/) || [])[1] || '';
      const country = normalizeCountry((t.match(/国家\s*(美国|加拿大|德国|英国|法国|意大利|西班牙|荷兰|波兰)/) || [])[1], store);
      const name = (t.match(/货件名称\s*([A-Za-z0-9_-]+)/) || [])[1] || '';
      const weight = (t.match(/装箱总重量\s*([0-9.]+)\s*kg/) || [])[1] || '';
      const methods = t.match(/(海运|空运|卡航|快递|铁路)/g);
      const method = methods ? methods[methods.length - 1] : '';
      seen.add(no);
      rows.push({
        no, store, country, wh: wh.toUpperCase(), method, weight,
        address: '', name
      });
    }
    return rows;
  }

  function readPageRows() {
    const vxe = readVxeRows();
    if (vxe.length) return { rows: vxe, source: 'vxe' };
    const dom = readDomRows();
    return { rows: dom, source: 'dom' };
  }

  // ---------- 解析 ----------
  function parseShipments(text) {
    const re = /FBA[0-9A-Z]{8,}/g;
    const map = {}, order = [], matches = [];
    let m;
    while ((m = re.exec(text)) !== null) matches.push({ no: m[0], idx: m.index });
    matches.forEach((item, i) => {
      const end = (i + 1 < matches.length) ? matches[i + 1].idx : text.length;
      const seg = text.slice(item.idx, end);
      let rec = map[item.no];
      if (!rec) {
        rec = map[item.no] = { no: item.no, store: '', country: '', wh: '', method: '', weight: '', address: '', name: '' };
        order.push(item.no);
      }
      const store = (seg.match(/店铺\s*([0-9]+号[^\s\n站]*站)/) || [])[1] || '';
      const country = (seg.match(/国家\s*(美国|加拿大|德国|英国|法国|意大利|西班牙|荷兰|波兰)/) || [])[1] || '';
      const wh = (seg.match(/物流中心编码\s*([A-Z0-9]{3,6})/) || [])[1] || '';
      const weight = (seg.match(/装箱总重量\s*([0-9.]+)\s*kg/) || [])[1] || '';
      const shipName = (seg.match(/货件名称\s*([A-Za-z0-9_-]+)/) || [])[1] || '';
      const mm = seg.match(/(海运|空运|卡航|快递|铁路)/g);
      const method = mm ? mm[mm.length - 1] : '';
      if (!rec.store && store) rec.store = store;
      if (!rec.country && country) rec.country = country;
      if (!rec.wh && wh) rec.wh = wh.toUpperCase();
      if (!rec.weight && weight) rec.weight = weight;
      if (!rec.method && method) rec.method = method;
      if (!rec.name && shipName) rec.name = shipName;
    });
    return order.map(no => map[no]);
  }

  function parseLegacy(text) {
    const rows = [];
    text.split(/\r?\n/).forEach(line => {
      line = line.trim();
      if (!line) return;
      const parts = line.split(/[\t ]+/);
      let no = '', wh = '';
      if (/^FBA[0-9A-Z]{8,}$/.test(parts[0])) { no = parts[0]; parts.shift(); }
      if (parts.length && /^[A-Z]{2,4}[0-9]?$/.test(parts[0].toUpperCase())) { wh = parts[0].toUpperCase(); parts.shift(); }
      const address = parts.join(' ');
      if (no || wh) rows.push({ no, store: '', country: '', wh, address, method: '', weight: '' });
    });
    return rows;
  }

  function parseInput(text) {
    const rows = parseShipments(text);
    return rows.length ? rows : parseLegacy(text);
  }

  function pickChannel(row, carrier, method, airtype) {
    const c = row.country || '美国';
    const zone = row.zone;
    if (c === '美国') {
      if (method === '海运') return (US_SEA[carrier] && US_SEA[carrier][zone]) || '';
      if (method === '空运') {
        if (carrier === '天盛') return airtype === '药贴' ? '天敏提' : '天翼提';
        return '';
      }
      if (method === '快递') return EXPRESS[carrier] || '';
      return '';
    }
    if (c === '加拿大') {
      if (method === '海运' || method === '卡航') return (CA_SEA[carrier] && CA_SEA[carrier][zone]) || '';
      if (method === '空运') return CA_AIR[carrier] || '';
      if (method === '快递') return EXPRESS[carrier] || '';
      return '';
    }
    if (c === '德国') {
      if (method === '空运') return DE_AIR[carrier] || '';
      if (method === '卡航') return DE_TRUCK[carrier] || '';
      return '';
    }
    if (c === '英国') {
      if (method === '空运') return UK_AIR[carrier] || '';
      if (method === '卡航') return UK_TRUCK[carrier] || '';
      if (method === '快递') return EXPRESS[carrier] || '';
      return '';
    }
    if (['法国', '意大利', '西班牙', '荷兰', '波兰'].indexOf(c) >= 0) {
      if (method === '卡航') return EU_TRUCK[carrier] || '';
      return '';
    }
    return '';
  }

  // ---------- 自动生成发货单 ----------
  function waitFor(fn, timeout = 15000, interval = 250) {
    return new Promise(resolve => {
      const start = Date.now();
      const tick = () => {
        let value = null;
        try { value = fn(); } catch (e) { value = null; }
        if (value) return resolve(value);
        if (Date.now() - start > timeout) return resolve(null);
        setTimeout(tick, interval);
      };
      tick();
    });
  }

  function normChannel(value) {
    return String(value || '')
      .replace(/\s+/g, '')
      .replace(/[（）()]/g, '')
      .replace(/^美中-|^美西-|^加东-|^加西-/, '')
      .replace(/[—–]/g, '-')
      .replace(/CN$/i, '')
      .toLowerCase();
  }

  function matchChannel(carrier, panelChannel, options) {
    const wanted = String(panelChannel || '').trim();
    if (!wanted || !Array.isArray(options) || !options.length) return '';
    const alias = CHANNEL_ALIAS[carrier + '|' + wanted];
    if (alias && options.includes(alias)) return alias;
    if (options.includes(wanted)) return wanted;
    const nw = normChannel(wanted);
    const exact = options.filter(x => normChannel(x) === nw);
    if (exact.length === 1) return exact[0];
    const contains = options.filter(x => {
      const nx = normChannel(x);
      return nx.includes(nw) || nw.includes(nx);
    });
    if (contains.length === 1) return contains[0];
    if (contains.length > 1) {
      const preferred = contains.find(x => /经济线|卡派|美森海卡/.test(x));
      return preferred || contains[0];
    }
    return '';
  }

  function buildGenerationGroups() {
    analyze();
    const map = new Map();
    ROWS.forEach(r => {
      if (!r.carrier || !r.channel || r.channel.indexOf('待') === 0 || r.methodMissing) return;
      const carrierId = CARRIER_ID[r.carrier];
      if (!carrierId) return;
      const options = MB_CHANNELS[r.carrier] || [];
      const actualChannel = matchChannel(r.carrier, r.channel, options) || r.channel;
      const key = [r.warehouseId || 0, r.warehouseName || '', r.carrier, actualChannel].join('|');
      let g = map.get(key);
      if (!g) {
        g = {
          key, warehouseId: r.warehouseId || 0, warehouseName: r.warehouseName || '',
          carrier: r.carrier, carrierId, channel: actualChannel,
          rows: [], ids: [], shippNos: [], invalid: ''
        };
        map.set(key, g);
      }
      g.rows.push(r);
      g.shippNos.push(r.no);
      if (r.id) g.ids.push(r.id);
      else g.invalid = g.invalid || '缺父货件 id';
      if (r.multiWarehouse) g.invalid = g.invalid || '同一货件多个发货仓库';
      if (!r.warehouseId) g.invalid = g.invalid || '缺发货仓库';
      if (!options.includes(g.channel)) g.invalid = g.invalid || '渠道未匹配';
    });
    return Array.from(map.values());
  }

  function buildGenerateUrl(ids) {
    const url = new URL(location.href);
    url.pathname = '/generateInvoice';
    url.searchParams.set('ids', ids.join(','));
    url.searchParams.set('invoiceType', 'manual');
    url.searchParams.set('isMerge', '0');
    return url.href;
  }

  function readQueue() {
    try {
      const q = JSON.parse(sessionStorage.getItem(QUEUE_KEY) || 'null');
      if (!q || !Array.isArray(q.groups) || !q.groups.length) return null;
      if (Date.now() - Number(q.startedAt || 0) > 30 * 60 * 1000) {
        sessionStorage.removeItem(QUEUE_KEY);
        return null;
      }
      return q;
    } catch (e) {
      return null;
    }
  }

  function writeQueue(q) {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  }

  let noticeTimer = null;

  function clearFixedNotice() {
    if (noticeTimer) { clearTimeout(noticeTimer); noticeTimer = null; }
    const el = document.getElementById('lca-fixed-notice');
    if (el) el.remove();
  }

  function showFixedNotice(text, bad) {
    let el = document.getElementById('lca-fixed-notice');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lca-fixed-notice';
      el.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483647;' +
        'background:#111827;color:#fff;padding:10px 16px;border-radius:8px;font:14px/1.5 -apple-system,"Microsoft YaHei",sans-serif;' +
        'box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:80vw;';
      document.documentElement.appendChild(el);
    }
    el.style.background = bad ? '#b91c1c' : '#111827';
    el.textContent = text;
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      const current = document.getElementById('lca-fixed-notice');
      if (current) current.remove();
      noticeTimer = null;
    }, 8000);
  }

  function stopQueue(q, message) {
    if (q && q.groups[q.current]) {
      q.groups[q.current].status = 'failed';
      q.groups[q.current].reason = message;
    }
    if (q) writeQueue(q);
    showFixedNotice('自动生成已停止：' + message, true);
    try { alert('自动生成已停止：' + message); } catch (e) {}
  }

  function hasZeroQtyError() {
    return Array.from(document.querySelectorAll('.el-message--error'))
      .some(x => (x.innerText || '').includes('发货数量必须大于0'));
  }

  function finishQueue(q) {
    const done = q.groups.filter(g => g.status === 'done');
    const skipped = q.groups.filter(g => g.status === 'skipped');
    const failed = q.groups.filter(g => g.status === 'failed');
    const lines = [`自动生成完成：成功 ${done.length} 组，跳过 ${skipped.length} 组，失败 ${failed.length} 组。`];
    if (skipped.length) {
      lines.push('已生成过发货单、本次跳过：');
      skipped.forEach(g => lines.push('  ' + g.shippNos.join(' ')));
    }
    if (failed.length) {
      lines.push('异常未完成：');
      failed.forEach(g => lines.push('  ' + g.shippNos.join(' ') + '：' + (g.reason || '未知原因')));
    }
    if (!skipped.length && !failed.length) lines.push('没有发现异常货件。');
    sessionStorage.removeItem(QUEUE_KEY);
    clearFixedNotice();
    try { alert(lines.join('\n')); } catch (e) {}
    location.href = q.sourceUrl;
  }

  function markSkipped(q, reason) {
    const g = q.groups[q.current];
    g.status = 'skipped';
    g.reason = reason;
    q.current += 1;
    writeQueue(q);
    showFixedNotice('第 ' + q.current + '/' + q.groups.length + ' 组已生成过，跳过：' + g.shippNos.join(' '), false);
    if (q.current < q.groups.length) {
      location.href = buildGenerateUrl(q.groups[q.current].ids);
    } else {
      finishQueue(q);
    }
  }

  async function selectShipmentRows(group) {
    const wantedNos = new Set(group.shippNos.map(String));
    await waitFor(() => {
      return Array.from(document.querySelectorAll('.vxe-table')).some(table => {
        const vm = table.__vue__;
        if (!vm || typeof vm.getTableData !== 'function') return false;
        const data = vm.getTableData().fullData || [];
        return data.some(r => r && !r.parentId && r.shippNo && wantedNos.has(String(r.shippNo)));
      });
    }, 5000);
    const tables = Array.from(document.querySelectorAll('.vxe-table'));
    const debug = [];
    for (let ti = 0; ti < tables.length; ti++) {
      const table = tables[ti];
      const vm = table.__vue__;
      if (!vm || typeof vm.getTableData !== 'function') continue;
      if (typeof vm.setCheckboxRow !== 'function') continue;
      const td = vm.getTableData();
      const data = [].concat(td.fullData || [], td.tableData || []);
      const byNo = new Map();
      data.forEach(r => {
        if (r && !r.parentId && r.shippNo && wantedNos.has(String(r.shippNo))) {
          byNo.set(String(r.shippNo), r);
        }
      });
      const rows = Array.from(byNo.values());
      debug.push('表' + (ti + 1) + '匹配' + rows.length + '/' + wantedNos.size);
      if (rows.length === wantedNos.size) {
        if (typeof vm.clearCheckboxRow === 'function') vm.clearCheckboxRow();
        vm.setCheckboxRow(rows, true);
        await new Promise(r => setTimeout(r, 700));
        return true;
      }
    }
    showFixedNotice(
      '未定位到父货件行（组=' + group.shippNos.join(',') + '；表格数=' + tables.length +
      '；' + (debug.join('；') || '没有可用的 VXE 实例') + '；当前窗口' +
      (window.top === window.self ? '是顶层' : '在 iframe 内') + '）', true
    );
    return false;
  }

  async function dismissMergePrompt() {
    for (let i = 0; i < 12; i++) {
      if (/\/generateInvoice\b/.test(location.pathname)) return;
      const box = Array.from(document.querySelectorAll('.el-message-box, .el-dialog'))
        .find(x => (x.innerText || '').includes('合并生成一张发货单'));
      if (box) {
        const no = Array.from(box.querySelectorAll('button'))
          .find(b => (b.innerText || '').trim() === '否');
        if (no) {
          no.click();
          await new Promise(r => setTimeout(r, 400));
          return;
        }
        showFixedNotice('出现“是否合并生成一张发货单”提示，但找不到「否」按钮', true);
        return;
      }
      await new Promise(r => setTimeout(r, 250));
    }
  }

  async function startInvoiceQueue(groups) {
    clearFixedNotice();
    const q = {
      sourceUrl: location.href,
      groups: groups.map(g => ({
        ids: g.ids.slice(), shippNos: g.shippNos.slice(),
        warehouseId: g.warehouseId, warehouseName: g.warehouseName,
        carrier: g.carrier, carrierId: g.carrierId, channel: g.channel,
        status: 'pending'
      })),
      current: 0,
      startedAt: Date.now()
    };
    writeQueue(q);
    const first = q.groups[0];
    if (!(await selectShipmentRows(first))) {
      sessionStorage.removeItem(QUEUE_KEY);
      stopQueue(null, '没有在 VXE 表格中定位到这一组的父货件行');
      return;
    }
    const btn = Array.from(document.querySelectorAll('button,a'))
      .find(b => /批量生成发货单/.test((b.innerText || '').trim()) && !b.disabled);
    if (!btn) {
      sessionStorage.removeItem(QUEUE_KEY);
      stopQueue(null, '找不到「批量生成发货单」按钮');
      return;
    }
    showFixedNotice(`已勾选第 1/${q.groups.length} 组，正在打开生成发货单页面…`, false);
    btn.click();
    setTimeout(clearFixedNotice, 3000);
    await dismissMergePrompt();
  }

  function setElSelect(index, value) {
    const sels = Array.from(document.querySelectorAll('.el-select'));
    const v = sels[index] && sels[index].__vue__;
    if (!v) return false;
    v.$emit('input', value);
    if (typeof v.$forceUpdate === 'function') v.$forceUpdate();
    return true;
  }

  function findInvoiceComponent() {
    const root = document.querySelector('#app') && document.querySelector('#app').__vue__;
    let found = null;
    (function walk(vm) {
      if (!vm || found) return;
      const d = vm.$data || {};
      if (d.form && d.channelList && d.form.warehouse !== undefined &&
          d.form.logics !== undefined && d.form.channel !== undefined) {
        found = vm;
        return;
      }
      (vm.$children || []).forEach(walk);
    })(root);
    return found;
  }

  async function startInvoiceBootstrap() {
    const q = readQueue();
    if (!q) return;
    if (q.current >= q.groups.length) {
      sessionStorage.removeItem(QUEUE_KEY);
      location.href = q.sourceUrl;
      return;
    }
    const g = q.groups[q.current];
    if (g.status === 'submitting') {
      stopQueue(q, '上一组状态是「提交中」，为避免重复生成，请先人工核对发货单是否已生成。');
      return;
    }

    const c = await waitFor(findInvoiceComponent, 15000);
    if (!c) { stopQueue(q, '没有找到发货单页面组件'); return; }

    const urlIds = (new URL(location.href).searchParams.get('ids') || '')
      .split(',').filter(Boolean).map(Number);
    if (urlIds.join(',') !== g.ids.map(Number).join(',')) {
      location.href = buildGenerateUrl(g.ids);
      return;
    }

    clearFixedNotice();
    showFixedNotice(`正在生成第 ${q.current + 1}/${q.groups.length} 组：${g.warehouseName} / ${g.carrier} / ${g.channel}`, false);

    await new Promise(r => setTimeout(r, 500));
    if (hasZeroQtyError()) {
      markSkipped(q, '发货数量必须大于0（已生成发货单）');
      return;
    }

    setElSelect(0, Number(g.warehouseId));
    c.form.warehouse = Number(g.warehouseId);
    try {
      if (typeof c.warehouseChanged === 'function') {
        await c.warehouseChanged(Number(g.warehouseId));
      }
    } catch (e) {
      stopQueue(q, '切换发货仓库失败：' + (e && e.message ? e.message : e));
      return;
    }
    await new Promise(r => setTimeout(r, 800));
    const tableReady = await waitFor(() => !c.tableLoading, 15000);
    if (!tableReady) { stopQueue(q, '切换发货仓库后货件明细没有加载完成'); return; }

    setElSelect(1, Number(g.carrierId));
    c.form.logics = Number(g.carrierId);
    try {
      if (typeof c.logicsListChanged === 'function') {
        await c.logicsListChanged(Number(g.carrierId));
      }
    } catch (e) {
      stopQueue(q, '切换物流方式失败：' + (e && e.message ? e.message : e));
      return;
    }
    const channels = await waitFor(() => {
      return Array.isArray(c.channelList) && c.channelList.length ? c.channelList : null;
    }, 15000);
    if (!channels) { stopQueue(q, '物流方式已选，但渠道列表为空'); return; }

    const opt = channels.find(x => x.logisticsChannelName === g.channel);
    if (!opt) {
      stopQueue(q, '找不到渠道「' + g.channel + '」，实际列表：' + channels.map(x => x.logisticsChannelName).join('、'));
      return;
    }
    setElSelect(2, opt.id);
    c.form.channel = opt.id;
    if (typeof c.$forceUpdate === 'function') c.$forceUpdate();
    await new Promise(r => setTimeout(r, 700));

    const readShown = () => {
      const sels = Array.from(document.querySelectorAll('.el-select')).slice(0, 3);
      return sels.map(s => {
        const input = s.querySelector('input');
        return input ? String(input.value || '').trim() : '';
      });
    };
    const shown = await waitFor(() => {
      const v = readShown();
      return v[0] && v[1] === CARRIER_LABEL[g.carrier] && v[2] === g.channel ? v : null;
    }, 3000);
    if (!shown) {
      const v = readShown();
      stopQueue(q, '三个下拉未正确显示（仓库=' + v[0] + '，物流方式=' + v[1] + '，渠道=' + v[2] + '）');
      return;
    }

    if (localStorage.getItem(DRY_KEY) === '1') {
      showFixedNotice('Dry-run：三个字段已填好，未点确定。核对后删除 localStorage.lca_dry_run 再正式跑。', false);
      return;
    }

    g.status = 'submitting';
    writeQueue(q);
    const okBtn = Array.from(document.querySelectorAll('button')).find(b =>
      (b.innerText || '').trim() === '确定' && b.classList.contains('el-button--primary') && !b.disabled
    );
    if (!okBtn) { stopQueue(q, '找不到右上角「确定」按钮'); return; }
    okBtn.click();

    const result = await waitFor(() => {
      const box = document.querySelector('.el-message-box');
      if (box && (box.innerText || '').includes('操作成功')) return 'ok';
      const err = document.querySelector('.el-message--error');
      if (err && (err.innerText || '').trim()) return 'err:' + (err.innerText || '').trim();
      return null;
    }, 25000);

    if (!result) { stopQueue(q, '点确定后 25 秒内没有看到成功提示'); return; }
    if (result.indexOf('err:') === 0) {
      const msg = result.slice(4);
      if (msg.includes('发货数量必须大于0')) {
        markSkipped(q, '发货数量必须大于0（已生成发货单）');
        return;
      }
      stopQueue(q, msg);
      return;
    }

    g.status = 'done';
    q.current += 1;
    writeQueue(q);
    if (q.current < q.groups.length) {
      location.href = buildGenerateUrl(q.groups[q.current].ids);
    } else {
      finishQueue(q);
    }
  }

  // ---------- 界面 ----------
  if (IS_INVOICE_PAGE) {
    startInvoiceBootstrap();
    return;
  }

  const host = document.createElement('div');
  host.id = 'lca-host';
  host.style.cssText = 'position:fixed;right:16px;bottom:64px;z-index:2147483647;';
  (document.body || document.documentElement).appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      :host{all:initial}
      *{box-sizing:border-box}
      #lca-btn{border:0;border-radius:999px;background:#2563eb;color:#fff;font:600 14px/1 -apple-system,"Microsoft YaHei",sans-serif;
        padding:12px 16px;box-shadow:0 6px 20px rgba(37,99,235,.35);cursor:pointer;white-space:nowrap}
      #lca-btn:hover{background:#1d4ed8}
      #lca-panel{display:none;width:760px;max-width:calc(100vw - 32px);max-height:84vh;overflow:auto;
        background:#f6f7f9;border:1px solid #dbe0e7;border-radius:14px;box-shadow:0 16px 50px rgba(15,23,42,.25);
        font:14px/1.6 -apple-system,"Microsoft YaHei",sans-serif;color:#111827;margin-bottom:10px}
      #lca-panel.open{display:block}
      .lca-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;
        background:#fff;border-bottom:1px solid #e5e7eb;border-radius:14px 14px 0 0;position:sticky;top:0;z-index:2}
      .lca-title{font-size:16px;font-weight:700}
      .lca-head button{border:0;background:#eef2f7;color:#334155;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px}
      .lca-head button:hover{background:#e2e8f0}
      .lca-body{padding:12px 14px}
      .lca-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:10px}
      textarea{width:100%;height:150px;padding:10px;border:1px solid #d9dce1;border-radius:8px;
        font:13px/1.6 Consolas,monospace;resize:vertical;background:#fff;color:#111827}
      .lca-row{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-top:10px}
      label{font-size:13px;color:#4b5563;display:inline-flex;align-items:center;gap:5px}
      select,input[type=number]{font-size:13px;padding:6px 8px;border-radius:7px;border:1px solid #d9dce1;background:#fff;color:#111827}
      input[type=number]{width:64px}
      .lca-primary{border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:600;padding:8px 16px;cursor:pointer}
      .lca-primary:hover{background:#1d4ed8}
      .lca-primary.lca-warn{background:#f59e0b}
      .lca-primary.lca-warn:hover{background:#d97706}
      .lca-secondary{border:1px solid #d9dce1;border-radius:8px;background:#fff;color:#334155;padding:8px 12px;cursor:pointer}
      .lca-secondary:hover{background:#f8fafc}
      .lca-hint{font-size:12px;color:#6b7280;margin-top:8px;line-height:1.5}
      #lca-result{margin-top:2px}
      #lca-result table{width:100%;border-collapse:collapse;font-size:12.5px;background:#fff;border-radius:10px;overflow:hidden}
      #lca-result th,#lca-result td{padding:7px 6px;border-bottom:1px solid #eef1f5;text-align:left;vertical-align:top}
      #lca-result th{background:#f3f6fb;color:#374151;font-weight:600;white-space:nowrap;position:sticky;top:0}
      #lca-result td.ch{font-weight:600;color:#111827}
      #lca-result .warn{color:#b45309}
      #lca-result .bad{color:#b91c1c}
      #lca-result .group{font-size:11px;color:#6b7280}
      #lca-result .sum{background:#eff6ff;border-radius:8px;padding:9px 10px;font-size:13px;margin-top:9px;color:#1e3a8a}
      #lca-result select{padding:3px 5px;font-size:12px}
      #lca-gen{margin-top:10px}
      #lca-gen table{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
      #lca-gen th,#lca-gen td{padding:6px 5px;border-bottom:1px solid #eef1f5;text-align:left;vertical-align:top}
      #lca-gen th{background:#f3f6fb;color:#374151;font-weight:600;white-space:nowrap}
      #lca-gen select{max-width:190px;padding:3px 4px;font-size:12px}
      #lca-gen .bad{color:#b91c1c}
      #lca-gen .muted{color:#6b7280;font-size:11px}
      #lca-gen-actions{display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap}
      #lca-gen-all{border:0;border-radius:8px;background:#059669;color:#fff;font-weight:700;padding:8px 14px;cursor:pointer}
      #lca-gen-all:hover{background:#047857}
      .lca-empty{color:#b91c1c;padding:8px 0}
    </style>
    <button id="lca-btn" type="button">物流渠道</button>
    <div id="lca-panel">
      <div class="lca-head">
        <div class="lca-title">物流渠道判断（全部国家 / 全部渠道）</div>
        <div>
          <button id="lca-min" type="button">收起</button>
          <button id="lca-close" type="button">关闭</button>
        </div>
      </div>
      <div class="lca-body">
        <div class="lca-card">
          <div class="lca-row">
            <label>运输方式
              <select id="lca-method">
                <option value="auto">自动识别</option>
                <option value="海运">海运</option>
                <option value="空运">空运</option>
                <option value="卡航">卡航</option>
                <option value="快递">快递</option>
                <option value="铁路">铁路</option>
              </select>
            </label>
            <label><input type="checkbox" id="lca-usgroup" checked> 美国按「5个货件」一组分配</label>
            <label>天盛票数/组 <input id="lca-quota" type="number" min="0" max="5" value="3"></label>
            <label>本周另一家
              <select id="lca-other"><option>瑞易达</option><option>铭运</option></select>
            </label>
            <label>美国空运货型
              <select id="lca-airtype"><option>普货</option><option>药贴</option></select>
            </label>
          </div>
          <div class="lca-row">
            <label>德国货代 <select id="lca-de"><option>铭运</option><option>瑞易达</option></select></label>
            <label>英国货代 <select id="lca-uk"><option>瑞易达</option><option>铭运</option></select></label>
            <label>加拿大货代 <select id="lca-ca"><option>铭运</option><option>瑞易达</option></select></label>
            <button id="lca-read" class="lca-primary" type="button">快速读取（约0.5秒）</button>
            <button id="lca-copy" class="lca-secondary" type="button">复制结果</button>
          </div>
          <div class="lca-hint">打开面板会自动快速读取当前页（约0.5秒）。如果提示识别不全，再点一次同一按钮做全量识别。美国：同一个「货件名称」下的 5 个货件为一组，天盛先占美东、再美西、最后美中（默认 3 票），其余给本周另一家；不是 5 个一组的美国海运默认全部天盛，可在结果表里改货代。其他国家按上面选定的货代自动带出渠道。</div>
          <div id="lca-status" class="lca-hint"></div>
        </div>
        <div class="lca-card" id="lca-result"><div class="lca-hint">结果会显示在这里。</div></div>
        <div class="lca-card" id="lca-gen"><div class="lca-hint">生成发货单：先判断渠道，再按「仓库 + 货代 + 渠道」自动勾选并生成。</div></div>
      </div>
    </div>
  `;

  const $ = (sel) => shadow.querySelector(sel);
  const panel = $('#lca-panel'), btn = $('#lca-btn'), resultEl = $('#lca-result'), statusEl = $('#lca-status');
  const readBtn = $('#lca-read');
  const genEl = $('#lca-gen');
  let GEN_GROUPS = [];
  let autoRead = false;
  let quickIncomplete = false;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || '';
  }

  function setReadButton(mode) {
    if (!readBtn) return;
    readBtn.classList.toggle('lca-warn', mode === 'full');
    if (mode === 'full') readBtn.textContent = '识别不全，点此全量识别';
    else if (mode === 'reading-full') readBtn.textContent = '全量识别中…';
    else if (mode === 'reading-quick') readBtn.textContent = '快速识别中…';
    else readBtn.textContent = '快速读取（约0.5秒）';
  }
  setReadButton('quick');

  function getVxeTableVms() {
    return Array.from(document.querySelectorAll('.vxe-table'))
      .map(t => t.__vue__)
      .filter(vm => vm && typeof vm.getTableData === 'function');
  }

  function vxeDataCount() {
    let count = 0;
    getVxeTableVms().forEach(vm => {
      try {
        const d = vm.getTableData() || {};
        count += ((d.fullData && d.fullData.length ? d.fullData : d.tableData) || []).length;
      } catch (e) {}
    });
    return count;
  }

  // SKU 多时，VXE 表格可能是虚拟滚动/分批加载；先展开并滚到底，等行数稳定再读。
  // 快速统计当前页：不展开、不滚动，只读现有 VXE 数据。
  // expected = min(服务端 total, pageSize)，用来区分“真的只有 1–4 票”和“5 票但没加载全”。
  function quickPageStats() {
    const tables = Array.from(document.querySelectorAll('.vxe-table'));
    const seen = new Set();
    for (const table of tables) {
      const vm = table.__vue__;
      if (!vm || typeof vm.getTableData !== 'function') continue;
      const td = vm.getTableData() || {};
      const data = td.fullData || td.tableData || [];
      for (const item of data) {
        if (!item || item.parentId) continue;
        const no = shippNoOf(item);
        if (no) seen.add(no);
      }
    }
    let total = 0, pageSize = 0;
    for (const table of tables) {
      let vm = table.__vue__;
      while (vm) {
        const d = vm._data || {};
        const t = Number(d.total);
        const p = Number(d.pageSize);
        if (Number.isFinite(t) && Number.isFinite(p) && Array.isArray(d.tableData)) {
          total = t; pageSize = p; break;
        }
        vm = vm.$parent;
      }
      if (total > 0 && pageSize > 0) break;
    }
    const expected = total > 0 && pageSize > 0 ? Math.min(total, pageSize) : seen.size;
    return { unique: seen.size, total, pageSize, expected };
  }

  async function prepareTableForRead(expected = 0) {
    const tables = Array.from(document.querySelectorAll('.vxe-table'));
    if (!tables.length) return;

    // 父货件行已经够数了：不需要展开、不需要滚动，直接返回。
    // 多 SKU 的慢滚动只在“少读了父行”时才用。
    const before = quickPageStats();
    if (expected > 0 && before.unique >= expected) {
      await new Promise(r => setTimeout(r, 100));
      return;
    }

    tables.forEach(t => {
      const vm = t.__vue__;
      if (!vm) return;
      try {
        if (typeof vm.setAllTreeExpand === 'function') vm.setAllTreeExpand(true);
      } catch (e) {}
    });
    await new Promise(r => setTimeout(r, 500));

    for (const t of tables) {
      const candidates = Array.from(t.querySelectorAll(
        '.vxe-table--body-wrapper, .vxe-table--body-inner-wrapper, .vxe-table--body'
      )).filter(el => el && el.scrollHeight > el.clientHeight + 10);
      const wrap = candidates.sort((a, b) => b.scrollHeight - a.scrollHeight)[0]
        || t.querySelector('.vxe-table--body-wrapper')
        || t.querySelector('.vxe-table--body');
      if (!wrap) continue;
      const original = wrap.scrollTop;
      const max = Math.max(wrap.scrollHeight, wrap.clientHeight);
      // 固定小步长：小屏幕/高缩放下也不会因为步数上限而漏掉中间行。
      const step = Math.max(160, Math.min(320, Math.floor((wrap.clientHeight || 400) * 0.5)));
      const steps = Math.min(300, Math.ceil(max / step));
      // 下 -> 上 -> 下，强制虚拟滚动把中间批次也加载出来。
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i <= steps; i++) {
          wrap.scrollTop = Math.min(max, i * step);
          await new Promise(r => setTimeout(r, 90));
        }
        wrap.scrollTop = max;
        await new Promise(r => setTimeout(r, 500));
        if (pass === 0) {
          for (let i = steps; i >= 0; i--) {
            wrap.scrollTop = Math.min(max, i * step);
            await new Promise(r => setTimeout(r, 60));
          }
          wrap.scrollTop = 0;
          await new Promise(r => setTimeout(r, 300));
        }
      }
      wrap.scrollTop = original;
    }

    // 等行数真正稳定：连续 8 次（约 2.4 秒）不变才退出，最多等 30 秒。
    let last = -1, stable = 0;
    for (let i = 0; i < 100; i++) {
      const count = vxeDataCount();
      if (count === last) stable += 1; else stable = 0;
      last = count;
      if (count > 0 && stable >= 8) break;
      await new Promise(r => setTimeout(r, 300));
    }
  }

  function mergeRowsByNo(base, extra) {
    const map = new Map();
    [...(base || []), ...(extra || [])].forEach(r => {
      if (!r || !r.no) return;
      map.set(r.no, Object.assign({}, map.get(r.no) || {}, r));
    });
    return Array.from(map.values());
  }

  // 美国按“货件名称”5票一组；返回不足5票的名称分组，用于判断表格是否没加载全。
  function incompleteUsGroups(rows) {
    const counts = new Map();
    (rows || []).forEach(r => {
      if (!r || r.country !== '美国' || !r.name) return;
      counts.set(r.name, (counts.get(r.name) || 0) + 1);
    });
    return Array.from(counts.entries()).filter(([, n]) => n > 0 && n < 5);
  }

  let loadToken = 0;
  let preparedForToken = 0;
  async function loadFromPage(renderNow = true, retry = 0, token = 0, accumulated = null, forceFull = false) {
    if (!token) token = ++loadToken;
    if (token !== loadToken) return;

    const stats = quickPageStats();
    const expected = stats.expected;
    // v1.4.0：默认永远先走快速路径，不自动全量。
    // 快速读不全时，只把同一个按钮切换成“全量识别”，由用户手动再点一次。
    const needFull = !!forceFull;

    if (preparedForToken !== token && document.querySelectorAll('.vxe-table').length) {
      if (needFull) {
        setStatus(`正在全量识别（当前页约 ${expected || '?'} 票，SKU 较多，可能需要几秒）…`);
        setReadButton('reading-full');
        await prepareTableForRead(expected);
      } else {
        setStatus(`正在快速识别（当前页 ${stats.unique || expected || '?'} 票）…`);
        setReadButton('reading-quick');
        await new Promise(r => setTimeout(r, 150));
      }
      preparedForToken = token;
      if (token !== loadToken) return;
    }

    const found = readPageRows();
    if (found.rows.length) {
      ROWS = mergeRowsByNo(accumulated, found.rows);
      ROWS_SOURCE = found.source;
      ROWS.forEach(r => {
        if (r.autoMethod === undefined) r.autoMethod = r.method || '';
        r.manualCarrier = ''; r.manualZone = ''; r.manualMethod = ''; r.carrierTouched = false;
      });
      if (renderNow) render();

      const short = expected > 0 && ROWS.length < expected;
      const incompleteGroups = ROWS.length === 5 ? incompleteUsGroups(ROWS) : [];
      const incomplete = short || incompleteGroups.length > 0;

      // 全量路径：仍然自动重试 3 次，尽量把虚拟滚动里没加载的行读出来。
      if (needFull && incomplete && retry < 3) {
        const desc = incompleteGroups.length
          ? incompleteGroups.map(([name, n]) => `「${name}」${n}票`).join('、')
          : `只读到 ${ROWS.length}/${expected || '?'} 票`;
        setStatus(`全量识别已读 ${ROWS.length} 票，但 ${desc}，正在重新滚动读取…（${retry + 1}/3）`);
        preparedForToken = 0;
        await new Promise(r => setTimeout(r, 900));
        return loadFromPage(renderNow, retry + 1, token, ROWS, true);
      }

      quickIncomplete = incomplete;
      setReadButton(incomplete ? 'full' : 'quick');

      const missing = ROWS.filter(r => r.methodMissing).length;
      const incompleteNote = incomplete
        ? (short
            ? `只读到 ${ROWS.length}/${expected || '?'} 票，可能未加载全；`
            : `有5票组不足5票（${incompleteGroups.map(([name, n]) => `「${name}」${n}票`).join('、')}），可能未加载全；`)
        : '';
      const nextHint = incomplete
        ? '再点一次「识别不全，点此全量识别」进行全量识别。'
        : '如需换页，翻页后再点「快速读取」。';
      setStatus(`已${needFull ? '全量' : '快速'}识别当前页 ${ROWS.length} 票（${found.source === 'vxe' ? '表格数据' : '页面文本'}）。`
        + incompleteNote
        + (missing ? `有 ${missing} 票未识别运输方式，可在顶部「运输方式」批量选，或在结果表「方式」列逐票选；` : '')
        + nextHint);
    } else if (retry < 30) {
      // 表格如果出现得晚，给两次重新展开/滚动的机会。
      if (retry === 10 || retry === 20) preparedForToken = 0;
      setStatus(`正在等待货件表格加载…（${retry + 1}/30）`);
      setTimeout(() => loadFromPage(renderNow, retry + 1, token, accumulated, forceFull), 500);
    } else {
      if (renderNow) resultEl.innerHTML = '<div class="lca-hint">当前页未识别到 FBA 货件。</div>';
      setReadButton('quick');
      setStatus('当前页未识别到 FBA 货件；请确认在马帮 FBA 货件页、页面已加载完，或点「快速读取」重试。');
    }
  }

  function togglePanel(force) {
    const open = typeof force === 'boolean' ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    btn.textContent = open ? '收起渠道' : '物流渠道';
    if (open && !autoRead) {
      autoRead = true;
      // 等页面表格渲染完再读，避免刚打开时读到空表
      setTimeout(() => loadFromPage(), 300);
    }
  }
  btn.addEventListener('click', () => togglePanel());
  $('#lca-min').addEventListener('click', () => togglePanel(false));
  $('#lca-close').addEventListener('click', () => togglePanel(false));
  if (readBtn) {
    readBtn.addEventListener('click', () => {
      if (quickIncomplete) {
        quickIncomplete = false;
        loadFromPage(true, 0, 0, null, true);
      } else {
        loadFromPage();
      }
    });
  }

  function readOptions() {
    return {
      methodSel: $('#lca-method').value,
      useUsGroup: $('#lca-usgroup').checked,
      quota: parseInt($('#lca-quota').value, 10) || 0,
      other: $('#lca-other').value,
      airtype: $('#lca-airtype').value,
      deCarrier: $('#lca-de').value,
      ukCarrier: $('#lca-uk').value,
      caCarrier: $('#lca-ca').value
    };
  }

  function analyze() {
    const opts = readOptions();
    ROWS.forEach((r, i) => {
      r.idx = i;
      if (COUNTRY_NAMES.indexOf(r.country) < 0) r.country = countryFromStore(r.store) || countryFromAddress(r.address) || '美国';
      if (r.country === '美国') {
        const u = usRegion(r.wh, r.address);
        r.zone = u[0]; r.basis = u[1];
      } else if (r.country === '加拿大') {
        if (r.manualZone) { r.zone = r.manualZone; r.basis = '手动指定'; }
        else { const c = caRegion(r.wh, r.address); r.zone = c[0]; r.basis = c[1]; }
      } else {
        r.zone = r.country;
      }
      const rawMethod = r.manualMethod || r.autoMethod || r.method || '';
      const normalizedMethod = normalizeMethod(rawMethod);
      const detectedMethod = isKnownMethod(normalizedMethod);
      r.methodMissing = !detectedMethod && !r.manualMethod && opts.methodSel === 'auto';
      if (opts.methodSel === 'auto') {
        r.method = detectedMethod ? normalizedMethod : (r.country === '美国' ? '海运' : '');
      } else {
        r.method = opts.methodSel;
        r.methodMissing = false;
      }
    });

    const priority = { 美东: 0, 美西: 1, 美中: 2, '': 3 };
    const usRows = ROWS.filter(r => r.country === '美国');
    usRows.forEach(r => { r.group = ''; r.assigned = ''; });

    if (opts.useUsGroup) {
      const byName = {}, unnamed = [];
      let gid = 0;
      usRows.forEach(r => { if (r.name) (byName[r.name] = byName[r.name] || []).push(r); else unnamed.push(r); });
      Object.keys(byName).forEach(name => {
        const group = byName[name];
        if (group.length !== 5) return;
        gid += 1;
        const ordered = group.slice().sort((a, b) => (priority[a.zone] - priority[b.zone]) || (a.idx - b.idx));
        ordered.forEach((r, k) => {
          r.group = '第' + gid + '组';
          r.assigned = k < opts.quota ? '天盛' : opts.other;
        });
      });
      for (let start = 0; start + 5 <= unnamed.length; start += 5) {
        const group = unnamed.slice(start, start + 5);
        gid += 1;
        const ordered = group.slice().sort((a, b) => (priority[a.zone] - priority[b.zone]) || (a.idx - b.idx));
        ordered.forEach((r, k) => {
          r.group = '第' + gid + '组';
          r.assigned = k < opts.quota ? '天盛' : opts.other;
        });
      }
    }

    ROWS.forEach(r => {
      if (r.country === '美国') {
        // IMO1/ITX3/ICA3 是盛森提特例仓：即使 5 票组里超过天盛配额，也强制归天盛。
        if (r.method === '海运' && isTsSpecialWarehouse(r.wh)) r.assigned = '天盛';
        if (r.assigned) r.carrier = r.assigned;
        else if (r.carrierTouched) r.carrier = r.manualCarrier;
        else if (r.method === '海运') r.carrier = '天盛';
        else r.carrier = '';
      } else if (r.country === '加拿大') r.carrier = opts.caCarrier;
      else if (r.country === '英国') r.carrier = opts.ukCarrier;
      else if (r.country === '德国') r.carrier = opts.deCarrier;
      else if (['法国', '意大利', '西班牙', '荷兰', '波兰'].indexOf(r.country) >= 0) r.carrier = '瑞易达';
      else r.carrier = '待定';

      r.channel = r.carrier ? pickChannel(r, r.carrier, r.method, opts.airtype) : '';
      if (r.carrier && !r.channel) r.channel = '待确认（该货代无此渠道）';
      if (!r.carrier) r.channel = '待选货代';
    });
  }

  function renderGeneration() {
    if (!genEl) return;
    if (ROWS_SOURCE !== 'vxe') {
      GEN_GROUPS = [];
      genEl.innerHTML = '<div class="lca-hint">生成发货单需要读取马帮表格数据；当前是页面文本模式，请在马帮 FBA 货件页点「快速读取」。</div>';
      return;
    }
    const groups = buildGenerationGroups();
    const old = new Map(GEN_GROUPS.map(g => [g.key, g.channel]));
    groups.forEach(g => {
      if (old.has(g.key)) g.channel = old.get(g.key);
      const options = MB_CHANNELS[g.carrier] || [];
      if (!g.warehouseId) g.invalid = g.invalid || '缺发货仓库';
      if (!g.ids.length) g.invalid = g.invalid || '缺父货件 id';
      if (!options.includes(g.channel)) g.invalid = g.invalid || '渠道未匹配';
    });
    GEN_GROUPS = groups;
    if (!groups.length) {
      const missing = ROWS.filter(r => r.methodMissing).length;
      genEl.innerHTML = `<div class="lca-hint">${missing
        ? `有 ${missing} 票运输方式未确认，请先在结果表「方式」列选择。`
        : '没有可生成的行：需要货代和渠道都已确定。'}</div>`;
      return;
    }

    let html = '<table><thead><tr><th>发货仓库</th><th>货代</th><th>物流渠道</th><th>票数</th><th>货件号</th><th></th></tr></thead><tbody>';
    groups.forEach(g => {
      const options = (MB_CHANNELS[g.carrier] || []).map(c =>
        `<option value="${esc(c)}"${c === g.channel ? ' selected' : ''}>${esc(c)}</option>`).join('');
      const bad = g.invalid ? `<div class="bad">${esc(g.invalid)}</div>` : '';
      html += `<tr>
        <td>${esc(g.warehouseName || ('仓库 ' + g.warehouseId))}${bad}</td>
        <td>${esc(g.carrier)}</td>
        <td><select data-gen-key="${esc(g.key)}">${options}</select></td>
        <td>${g.rows.length}</td>
        <td class="muted">${esc(g.shippNos.join(' '))}</td>
        <td>${g.invalid ? '<span class="bad">不可生成</span>' : `<button class="lca-secondary" data-gen-one="${esc(g.key)}" type="button">生成</button>`}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    const invalid = groups.filter(g => g.invalid);
    html += `<div id="lca-gen-actions">
      <button id="lca-gen-all" type="button"${invalid.length ? ' disabled style="background:#9ca3af;cursor:not-allowed"' : ''}>确认并自动生成全部（${groups.length} 组）</button>
      <span class="muted">${invalid.length ? '有 ' + invalid.length + ' 组未就绪，先修正渠道/仓库。' : '一组一个渠道；确认后自动勾选、填三个下拉并提交。'}</span>
    </div>`;
    genEl.innerHTML = html;
  }

  function render() {
    if (!ROWS.length) {
      resultEl.innerHTML = '<div class="lca-empty">没识别到货件。</div>';
      return;
    }
    analyze();
    const counts = {};
    ROWS.forEach(r => { if (r.carrier) counts[r.carrier] = (counts[r.carrier] || 0) + 1; });

    let html = '<table><thead><tr><th>货件号</th><th>店铺</th><th>国家</th><th>仓库</th><th>分区</th><th>方式</th><th>货代</th><th>渠道名</th><th>依据/提示</th></tr></thead><tbody>';
    ROWS.forEach(r => {
      let warn = '';
      if (!r.wh) warn = '<span class="warn">缺仓库码</span>';
      else if (r.country === '美国' && !r.zone) warn = '<span class="warn">仓库未收录，请补邮编</span>';
      else if (r.methodMissing) warn = '<span class="warn">未识别运输方式，请选择</span>';
      if (r.channel && r.channel.indexOf('待确认') === 0) warn += ' <span class="bad">渠道待确认</span>';

      let carrierCell;
      if (r.country === '美国' && !r.assigned) {
        const options = ['天盛', '瑞易达', '铭运'].map(c =>
          `<option value="${esc(c)}"${r.carrier === c ? ' selected' : ''}>${esc(c)}</option>`).join('');
        carrierCell = `<select data-carrier-no="${esc(r.no)}"><option value=""${r.carrier ? '' : ' selected'}>待选</option>${options}</select>`
          + (r.group ? ` <span class="group">${esc(r.group)}</span>` : ' <span class="group">单票</span>');
      } else {
        carrierCell = esc(r.carrier || '') + (r.group ? ` <span class="group">${esc(r.group)}</span>` : '');
      }

      let zoneCell = esc(r.zone || '');
      if (r.country === '加拿大' && (r.basis === '加拿大仓不在东西名单' || r.basis === '手动指定')) {
        const options = ['加东', '加西', '其余'].map(z =>
          `<option value="${esc(z)}"${r.zone === z ? ' selected' : ''}>${esc(z)}</option>`).join('');
        zoneCell = `<select data-cazone-no="${esc(r.no)}">${options}</select>`;
      }

      // 方式列始终保留下拉，手滑选错可以马上改回来，不用刷新页面。
      const methodSelected = r.manualMethod || r.method || '';
      const autoLabel = r.autoMethod ? `自动（${r.autoMethod}）` : '自动';
      const methodOptions = METHOD_NAMES.map(m =>
        `<option value="${esc(m)}"${m === methodSelected ? ' selected' : ''}>${esc(m)}</option>`).join('');
      const methodCell = `<select data-method-no="${esc(r.no)}" title="可随时改；选「自动」恢复自动识别">`
        + `<option value=""${methodSelected ? '' : ' selected'}>${esc(autoLabel)}</option>`
        + `${methodOptions}</select>`;

      html += `<tr>
        <td>${esc(r.no)}</td><td>${esc(r.store || '')}</td><td>${esc(r.country || '')}</td>
        <td>${esc(r.wh || '')}</td><td>${zoneCell}</td><td>${methodCell}</td>
        <td>${carrierCell}</td><td class="ch">${esc(r.channel || '')}</td>
        <td>${esc(r.basis || '')} ${warn}</td>
      </tr>`;
    });
    html += '</tbody></table>';

    const sum = Object.keys(counts).map(k => `${k} ${counts[k]} 票`).join('，');
    html += `<div class="sum">共 ${ROWS.length} 票：${esc(sum || '暂无分配')}</div>`;
    resultEl.innerHTML = html;
    renderGeneration();
  }

  resultEl.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('select[data-method-no]')) {
      const row = ROWS.find(r => r.no === t.getAttribute('data-method-no'));
      if (row) {
        if (t.value) {
          row.manualMethod = t.value;
          row.method = t.value;
          row.methodMissing = false;
        } else {
          // 选「自动」：清掉手动值，回到 printRemark/页面识别结果。
          row.manualMethod = '';
          row.method = row.autoMethod || '';
          row.methodMissing = !isKnownMethod(normalizeMethod(row.method));
        }
        render();
      }
    } else if (t.matches('select[data-carrier-no]')) {
      const row = ROWS.find(r => r.no === t.getAttribute('data-carrier-no'));
      if (row) { row.manualCarrier = t.value; row.carrierTouched = true; render(); }
    } else if (t.matches('select[data-cazone-no]')) {
      const row = ROWS.find(r => r.no === t.getAttribute('data-cazone-no'));
      if (row) { row.manualZone = t.value; render(); }
    }
  });

  genEl.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-gen-key]');
    if (!sel) return;
    const g = GEN_GROUPS.find(x => x.key === sel.getAttribute('data-gen-key'));
    if (!g) return;
    g.channel = sel.value;
    g.invalid = '';
    if (!g.warehouseId) g.invalid = '缺发货仓库';
    else if (!g.ids.length) g.invalid = '缺父货件 id';
    else if (!(MB_CHANNELS[g.carrier] || []).includes(g.channel)) g.invalid = '渠道未匹配';
    renderGeneration();
  });

  genEl.addEventListener('click', (e) => {
    const one = e.target.closest('button[data-gen-one]');
    if (one) {
      const g = GEN_GROUPS.find(x => x.key === one.getAttribute('data-gen-one'));
      if (!g || g.invalid) return;
      if (!confirm(`生成这一组发货单？\n\n${g.warehouseName} / ${g.carrier} / ${g.channel}\n${g.shippNos.join(' ')}`)) return;
      startInvoiceQueue([g]);
      return;
    }
    if (e.target && e.target.id === 'lca-gen-all') {
      const groups = GEN_GROUPS.filter(g => !g.invalid);
      if (!groups.length) return;
      const summary = groups.map(g => `${g.warehouseName} / ${g.carrier} / ${g.channel}：${g.shippNos.join(' ')}`).join('\n');
      if (!confirm(`将自动生成 ${groups.length} 组发货单：\n\n${summary}\n\n确认后不再逐单确认，继续？`)) return;
      startInvoiceQueue(groups);
    }
  });

  $('#lca-copy').addEventListener('click', async () => {
    if (!ROWS.length) return;
    const lines = ['货件号\t店铺\t国家\t仓库\t分区\t方式\t货代\t渠道名'];
    ROWS.forEach(r => lines.push([r.no, r.store || '', r.country || '', r.wh || '', r.zone || '', r.method || '', r.carrier || '', r.channel || ''].join('\t')));
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      $('#lca-copy').textContent = '已复制';
      setTimeout(() => { $('#lca-copy').textContent = '复制结果'; }, 1200);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); $('#lca-copy').textContent = '已复制'; } catch (_) { $('#lca-copy').textContent = '复制失败'; }
      ta.remove();
      setTimeout(() => { $('#lca-copy').textContent = '复制结果'; }, 1200);
    }
  });

  // 从生成页返回/浏览器前进后退恢复页面时，清掉遗留的顶部提示
  window.addEventListener('pageshow', () => clearFixedNotice());
  window.addEventListener('focus', () => {
    if (!document.querySelector('.el-message-box')) clearFixedNotice();
  });

  // 打印预览前再隐藏一次，打印结束后恢复；CSS 已处理，这里做兜底。
  let printRestoreTimer = null;
  function setPrintHidden(hidden) {
    if (printRestoreTimer) { clearTimeout(printRestoreTimer); printRestoreTimer = null; }
    host.style.display = hidden ? 'none' : '';
    const notice = document.getElementById('lca-fixed-notice');
    if (notice) notice.style.display = hidden ? 'none' : '';
    if (hidden) printRestoreTimer = setTimeout(() => setPrintHidden(false), 30000);
  }
  window.addEventListener('beforeprint', () => setPrintHidden(true));
  window.addEventListener('afterprint', () => setPrintHidden(false));

  // Ctrl+Shift+L 快捷键
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
      e.preventDefault(); togglePanel();
    }
  });
})();
