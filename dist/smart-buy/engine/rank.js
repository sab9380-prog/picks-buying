// TOP 20 매입 추천 랭킹 — Excel 일괄 모드 전용.
// 종합 점수 = 휴리스틱 total + 매칭 시 셀스루 가중 + 리스크 페널티.
// 가중치는 운영 중 튜닝.

const SELL_THROUGH_BONUS_W4  = 0.4;
const SELL_THROUGH_BONUS_W8  = 0.3;
const SELL_THROUGH_BONUS_W16 = 0.2;
const RISK_PENALTY_PER_SIGNAL = 5;

/**
 * @param {Diagnosis[]} diagnoses
 * @returns {Diagnosis[]} top 20 정렬
 */
export function rankTop20(diagnoses) {
  const scored = diagnoses
    .filter(d => d.heuristic.total > 0) // 키즈(0점) 제외
    .map(d => {
      let score = d.heuristic.total;
      if (d.diagnosisItems?.sellThrough) {
        const st = d.diagnosisItems.sellThrough;
        score += (st.w4  || 0) * SELL_THROUGH_BONUS_W4
              +  (st.w8  || 0) * SELL_THROUGH_BONUS_W8
              +  (st.w16 || 0) * SELL_THROUGH_BONUS_W16;
      }
      const riskCount = (d.diagnosisItems?.riskSignals || []).length;
      score -= riskCount * RISK_PENALTY_PER_SIGNAL;
      return { ...d, _rankScore: Math.round(score * 10) / 10 };
    });
  scored.sort((a, b) => b._rankScore - a._rankScore);
  return scored.slice(0, 20);
}

/**
 * 전체 정렬 결과 반환 (TOP 20 + 나머지)
 */
export function rankAll(diagnoses) {
  const scored = diagnoses.map(d => {
    let score = d.heuristic.total;
    if (d.diagnosisItems?.sellThrough) {
      const st = d.diagnosisItems.sellThrough;
      score += (st.w4  || 0) * SELL_THROUGH_BONUS_W4
            +  (st.w8  || 0) * SELL_THROUGH_BONUS_W8
            +  (st.w16 || 0) * SELL_THROUGH_BONUS_W16;
    }
    const riskCount = (d.diagnosisItems?.riskSignals || []).length;
    score -= riskCount * RISK_PENALTY_PER_SIGNAL;
    return { ...d, _rankScore: Math.round(score * 10) / 10 };
  });
  scored.sort((a, b) => b._rankScore - a._rankScore);
  return scored;
}
