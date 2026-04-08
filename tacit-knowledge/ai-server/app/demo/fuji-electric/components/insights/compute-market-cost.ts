/**
 * 市場調達コスト算出ユーティリティ
 * JEPX直近30日平均 + 最新賦課金 + 最新非化石証書平均
 */

interface JepxSpotRecord {
  delivery_date: string;
  system_price: number;
}

interface SurchargeRecord {
  fiscal_year: string;
  surcharge_rate: number;
}

interface NonfossilRecord {
  fiscal_year: number;
  round: number;
  settlement_price: number;
  volume_gwh: number;
}

export interface MarketCost {
  spotAvg: number;
  surcharge: number;
  nonfossilAvg: number;
  total: number;
}

export function computeMarketCost(
  jepxSpotRecords: JepxSpotRecord[],
  surchargeRecords: SurchargeRecord[],
  nonfossilFitRecords: NonfossilRecord[],
  nonfossilNonfitRecords: NonfossilRecord[],
): MarketCost {
  // JEPX直近30日平均
  const sorted = [...jepxSpotRecords].sort((a, b) =>
    a.delivery_date.localeCompare(b.delivery_date)
  );
  const recent = sorted.slice(-30);
  const spotAvg =
    recent.length > 0
      ? recent.reduce((s, r) => s + r.system_price, 0) / recent.length
      : 0;

  // 最新賦課金
  const surcharge =
    [...surchargeRecords]
      .sort((a, b) => a.fiscal_year.localeCompare(b.fiscal_year))
      .pop()?.surcharge_rate ?? 0;

  // 最新非化石証書（FIT/非FIT加重平均）
  const latestFitRound = [...nonfossilFitRecords].sort(
    (a, b) => a.fiscal_year - b.fiscal_year || a.round - b.round
  );
  const latestFit = latestFitRound[latestFitRound.length - 1];

  const latestNonfitRound = [...nonfossilNonfitRecords].sort(
    (a, b) => a.fiscal_year - b.fiscal_year || a.round - b.round
  );
  const latestNonfit = latestNonfitRound[latestNonfitRound.length - 1];

  let nonfossilAvg = 0;
  if (latestFit && latestNonfit) {
    const totalVol = latestFit.volume_gwh + latestNonfit.volume_gwh;
    nonfossilAvg =
      totalVol > 0
        ? (latestFit.settlement_price * latestFit.volume_gwh +
            latestNonfit.settlement_price * latestNonfit.volume_gwh) /
          totalVol
        : (latestFit.settlement_price + latestNonfit.settlement_price) / 2;
  } else if (latestFit) {
    nonfossilAvg = latestFit.settlement_price;
  } else if (latestNonfit) {
    nonfossilAvg = latestNonfit.settlement_price;
  }

  return {
    spotAvg: +spotAvg.toFixed(2),
    surcharge: +surcharge.toFixed(2),
    nonfossilAvg: +nonfossilAvg.toFixed(2),
    total: +(spotAvg + surcharge + nonfossilAvg).toFixed(2),
  };
}
