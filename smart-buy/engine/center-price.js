// CENTER_PRICE_DB 조회 — v12 getCenterPrice 로직 이식.
// MC 아이템명 매칭(OFFER_TO_MC_MAP) + 부분 매칭 fallback.
import { inferProductType, normCat } from '../_oracle/v12-functions.mjs';

// data/offer-mc-map.json은 호출자가 메모리에 로드한 뒤 전달
export function offerToMcKey(offerMcMap, category, gender, product, name) {
  const cat  = (category || '').toUpperCase().trim();
  const gen  = (gender   || '').toUpperCase().trim();
  const prod = (product  || '').toUpperCase().trim();
  const nm   = (name     || '').toUpperCase().trim();

  const key1 = `${cat}|${gen}|${prod}`;
  if (offerMcMap[key1]) return offerMcMap[key1];

  const inferProd = inferProductType(nm, prod);
  if (inferProd !== prod) {
    const key2 = `${cat}|${gen}|${inferProd}`;
    if (offerMcMap[key2]) return offerMcMap[key2];
  }

  const mapKeys = Object.keys(offerMcMap);
  const partial = mapKeys.find(k => {
    const [mc, mg, mp] = k.split('|');
    return mc === cat && mg === gen && mp && prod.includes(mp);
  });
  if (partial) return offerMcMap[partial];

  const key4 = `${cat}|${gen}|`;
  if (offerMcMap[key4]) return offerMcMap[key4];

  return null;
}

/**
 * centerPriceDB 형태: { brands: { "브랜드명": { avg, by_cat: {카테고리: 가격} } } }
 * offer: OfferSKU. offerMcMap는 별도 인자로 받지 않고 내장된 단순 매핑 사용.
 * @returns 가격(원) 또는 null
 */
export function lookupCenterPrice(centerPriceDB, offer, offerMcMap = null) {
  if (!centerPriceDB || !centerPriceDB.brands) return null;
  const brandKey = offer.brand;
  if (!brandKey) return null;

  // 1) 브랜드 엔트리 찾기
  const candidates = [
    brandKey,
    brandKey.split('(')[0].trim(),
    brandKey.replace(/\(.*?\)/g, '').trim()
  ];
  let entry = null;
  for (const cand of candidates) {
    if (centerPriceDB.brands[cand]) { entry = centerPriceDB.brands[cand]; break; }
    const keys = Object.keys(centerPriceDB.brands);
    const k = keys.find(k => k.includes(cand) || (cand.length > 2 && cand.includes(k)));
    if (k) { entry = centerPriceDB.brands[k]; break; }
  }
  if (!entry || !entry.by_cat) return null;

  // 2) MC 아이템명 변환 (offerMcMap 있으면)
  let mcItem = null;
  if (offerMcMap) {
    mcItem = offerToMcKey(offerMcMap, offer.category, offer.gender, offer.product, offer.style);
  }

  // 3) by_cat에서 MC 아이템명으로 직접 조회
  if (mcItem && entry.by_cat[mcItem] !== undefined) return entry.by_cat[mcItem];

  // 4) 부분 매칭
  if (mcItem) {
    const catKeys = Object.keys(entry.by_cat);
    const partial = catKeys.find(k =>
      normCat(k) === normCat(mcItem) ||
      normCat(k).includes(normCat(mcItem)) ||
      normCat(mcItem).includes(normCat(k))
    );
    if (partial) return entry.by_cat[partial];
  }

  // 5) 첫 카테고리 평균값으로 fallback
  if (entry.avg) return entry.avg;
  return null;
}
