// Form feedback only. Saving and playback use the workspace's Lua validators.
const trim = text => text.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, '');
const decimal = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
export function parseEffectSet(text, output = false) {
  if (typeof text !== 'string' || !trim(text)) throw Error('集合不能为空');
  if (new TextEncoder().encode(text).length > 8192 || text.includes('|')) throw Error('集合表达式无效');
  const parts = [];
  const number = token => {
    token = trim(token);
    if (!decimal.test(token) || !Number.isFinite(Number(token))) throw Error('端点必须是有限十进制数字');
    return Number(token);
  };
  const add = (min, max, left, right) => {
    if (!(min < max || min === max && left && right)) throw Error('区间逆序或为空');
    parts.push({min, max, left, right});
    if (parts.length > 256) throw Error('集合最多包含 256 个区间或点');
  };
  for (const raw of text.split(/∪|\bor\b/)) {
    const term = trim(raw), first = term[0], last = term.at(-1), tokens = term.slice(1, -1).split(',');
    if (!term) throw Error('并集缺少集合');
    if (first === '{' && last === '}') {
      for (const token of tokens) { const n = number(token); add(n, n, true, true); }
    } else {
      if (!['[', '('].includes(first) || ![']', ')'].includes(last) || tokens.length !== 2) throw Error('请使用有界区间、点集或 or 并集');
      add(number(tokens[0]), number(tokens[1]), first === '[', last === ']');
    }
  }
  parts.sort((a,b) => a.min-b.min || Number(b.left)-Number(a.left));
  const merged = [];
  for (const p of parts) {
    const prev = merged.at(-1);
    if (prev && (p.min < prev.max || p.min === prev.max && (prev.right || p.left))) {
      if (p.max > prev.max) { prev.max = p.max; prev.right = p.right; }
      else if (p.max === prev.max) prev.right ||= p.right;
    } else merged.push({...p});
  }
  const min = merged[0].min, max = merged.at(-1).max;
  if (!Number.isFinite(max-min)) throw Error('集合跨度必须有限');
  if (output && (merged.length !== 1 || !merged[0].left || !merged[0].right)) throw Error('值域须为有限闭区间或单点');
  return {parts:merged, min, max};
}
export function constantEffectSet(text, output = false) {
  try { const set = parseEffectSet(text, output); return set.min === set.max; } catch { return false; }
}
export function effectOutputTemplate(domain, assets) {
  const curve = assets.find(a => a.type === 'Curve' && a.path === 'Assets/CurveAssets/Bezier/Linear.curve') || assets.find(a => a.type === 'Curve');
  return constantEffectSet(domain) || !curve ? {Range:'{0}'} : {Range:'[0,1]', Curve:curve.path};
}
