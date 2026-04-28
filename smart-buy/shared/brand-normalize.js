// 브랜드 정규화 단일 진실.
// 옆 메뉴(픽스 본체)와 smart-buy가 같은 brandId를 공유하기 위한 표준.
// canonical brandId = lowercase, no spaces/special chars (예: "adidas", "nike", "newbalance")

import BRAND_SCORE from '../data/brand-score-rules.json' with { type: 'json' };
import CENTER_PRICE from '../data/center-price-db.json' with { type: 'json' };

// ── canonical 변환 ──────────────────────────────────────────────────
// "ADIDAS Originals" → "adidas"
// "NEW BALANCE 990" → "newbalance"
// "아디다스" → "adidas"  (별칭 사전 거쳐 매칭)
function canonical(raw) {
  return (raw || '')
    .toString()
    .toLowerCase()
    .normalize('NFC')
    .replace(/[()[\],.\-_+/&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, ''); // 최종적으로 공백도 제거
}

// ── 한↔영 별칭 사전 (시드: brand-score-rules.json + center-price-db 키) ──
// 한글 표기 → 영문 canonical 매핑
const KO_TO_EN = {
  '아디다스': 'adidas',
  '나이키': 'nike',
  '뉴발란스': 'newbalance',
  '라코스테': 'lacoste',
  '버버리': 'burberry',
  '폴로랄프로렌': 'poloralphlauren',
  '캘빈클라인': 'calvinklein',
  '캘빈 클라인': 'calvinklein',
  '메종키츠네': 'maisonkitsune',
  '아크네스튜디오': 'acnestudios',
  '톰브라운': 'thombrowne',
  '막스마라': 'maxmara',
  '르메르': 'lemaire',
  '산드로': 'sandro',
  '마쥬': 'maje',
  '아페쎄': 'apc',
  '가니': 'ganni',
  '겐조': 'kenzo',
  '이자벨마랑': 'isabelmarant',
  '셀프포트레이트': 'selfportrait',
  '씨피컴퍼니': 'cpcompany',
  'cp컴퍼니': 'cpcompany',
  '챔피온': 'champion',
  '칼하트': 'carhartt',
  '푸마': 'puma',
  '오클리': 'oakley',
  '마시모두띠': 'massimodutti',
  '헤지스': 'hazzys',
  '닥스': 'daks',
  '마에스트로': 'maestro',
  '질스튜어트': 'jillstuart',
  '파르티멘토': 'partimento',
  '비바스튜디오': 'vivastudio',
  '캐롯츠': 'carrots',
  '루이스미샤': 'louisemisha',
  '버켄스탁': 'birkenstock',
  '자라': 'zara',
  '디즈니': 'disney',
  '알레그리': 'allegri',
  '바네사브루노': 'vanessabruno',
  '끌로디피에로': 'claudiepierlot',
  '아스페시': 'aspesi',
  '콜마르': 'colmar',
  '케이웨이': 'kway',
  '에디바우어': 'eddiebauer',
  '하바이아나스': 'havaianas',
  '핏플랍': 'fitflop',
  '라푸마': 'lafuma',
  '아가타': 'agatha',
  '질바이질스튜어트': 'jilstuart',
  '앳코너': 'atcorner',
  '일꼬르소': 'ilcorso',
  '티엔지티': 'tngt',
  '캠브리지': 'cambridge',
  '블루독': 'bludog',
  '팬콧': 'phanct',
  '해피버스': 'happybus',
  '아떼': 'athe',
  '아웃도어 프로덕츠': 'outdoorproducts',
  '아웃도어프로덕츠': 'outdoorproducts',
  '넘버21': 'n21',
  '리포즈암스': 'reposeams',
  '위켄드하우스': 'weekendhouse',
  '일구포': 'ilgufo',
  '핍즈': 'phyps',
  '페이탈리즘': 'fatalism',
  '다커스': 'dockers',
  '유에스폴로': 'uspa',
  '스페이드클럽': 'spadeclub',
  '아머럭스': 'armorlux',
  '씨엔엔': 'cnn',
  '미시간': 'michigan',
  '콘체르트': 'konzert',
  '슈페티': 'spati',
  '가먼트레이블': 'garmentlable'
};

// 영문 표기 alias → canonical (특수 케이스만; 일반 케이스는 canonical()이 처리)
const EN_ALIASES = {
  'newbalance': 'newbalance',
  'maxmara': 'maxmara',
  'tombrouri': 'thombrowne',
  'thombrowne': 'thombrowne',
  'maisonkitsune': 'maisonkitsune',
  'apparis': 'amiparis',
  'amiparis': 'amiparis',
  'amimaison': 'amiparis',
  'tommy': 'tommyhilfiger',
  'tommyhilfiger': 'tommyhilfiger',
  'isabelmarant': 'isabelmarant',
  'cpcompany': 'cpcompany',
  'massimodutti': 'massimodutti',
  'apc': 'apc',
  'kway': 'kway',
  'lafuma': 'lafuma',
  'newbalanced': 'newbalance',
  'ralphlauren': 'poloralphlauren',
  'poloralphlauren': 'poloralphlauren',
  'polo': 'poloralphlauren',
  'birkenstock': 'birkenstock',
  'acnestudios': 'acnestudios',
  'acne': 'acnestudios',
  'numero21': 'n21',
  'n21': 'n21',
  'numero ventuno': 'n21'
};

// ── 메인 함수 ───────────────────────────────────────────────────────
export function normalizeBrandId(raw) {
  if (!raw) return '';
  const trimmed = raw.toString().trim();

  // 1) 한글 직접 매칭
  const koKey = trimmed.toLowerCase();
  if (KO_TO_EN[koKey]) return KO_TO_EN[koKey];
  // 한글 + 괄호 (예: "아디다스(ADIDAS)") — 한글 부분만
  const koPart = trimmed.replace(/\(.*?\)/g, '').trim().toLowerCase();
  if (KO_TO_EN[koPart]) return KO_TO_EN[koPart];

  // 2) canonical 변환
  const canon = canonical(trimmed);
  if (!canon) return '';

  // 3) 영문 alias
  if (EN_ALIASES[canon]) return EN_ALIASES[canon];

  // 4) 부분 매칭 (alias 키가 canon에 포함되거나 그 반대)
  for (const [k, v] of Object.entries(EN_ALIASES)) {
    if (canon.includes(k) && k.length >= 4) return v;
  }

  // 5) 그대로 반환 (canonical 형태)
  return canon;
}

// 정규화된 brandId가 존재하는지(데이터에 등록된 브랜드인지) 확인
export function isKnownBrand(brandId) {
  // brand-score-rules.json의 brand_tier_db 키들도 canonical 변환 후 체크
  const knownIds = new Set();
  for (const k of Object.keys(BRAND_SCORE.brand_tier_db || {})) {
    knownIds.add(canonical(k));
    if (KO_TO_EN[k.toLowerCase()]) knownIds.add(KO_TO_EN[k.toLowerCase()]);
  }
  for (const k of Object.keys(CENTER_PRICE.brands || {})) {
    knownIds.add(canonical(k));
    if (KO_TO_EN[k.toLowerCase()]) knownIds.add(KO_TO_EN[k.toLowerCase()]);
  }
  return knownIds.has(brandId);
}

// 디버그용
export const _internal = { canonical, KO_TO_EN, EN_ALIASES };
