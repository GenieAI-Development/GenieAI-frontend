"use client";

import { useRef, type ReactNode } from "react";
import { cleanProductDescription } from "@/lib/productDescription";
import type { CompareRow, ComparisonInsight } from "../types";

type Props = {
  compareRows: CompareRow[];
  suggestion: string;
  formatPrice: (price: number, currency: string) => string;
};

function Insights({ insights }: { insights: ComparisonInsight[] }) {
  const visibleInsights = insights.slice(0, 4);
  const scoredInsights = visibleInsights.filter(
    (insight): insight is ComparisonInsight & { percentage: number } =>
      typeof insight.percentage === "number",
  );
  const finalScore =
    scoredInsights.length > 0
      ? Math.round(
          scoredInsights.reduce(
            (total, insight) => total + insight.percentage,
            0,
          ) / scoredInsights.length,
        )
      : null;
  const scoreRows = [
    ...visibleInsights,
    ...(visibleInsights.length > 0
      ? [{ label: "Final score", percentage: finalScore }]
      : []),
  ];
  const hasMissingPreferenceScore = visibleInsights.some(
    (insight) => insight.percentage === null,
  );

  return (
    <div className="grid gap-2.5">
      {scoreRows.map((insight) => (
        <div
          key={insight.label}
          className={`grid gap-1.5 rounded-lg p-2.5 ${insight.label === "Final score" ? "border border-[#D6A936]/45 bg-[#FFF8E7]" : "bg-[#FAF7F1]"}`}
        >
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[#31577F]">
            <span>{insight.label}</span>
            <span className="font-bold text-[#B3872F]">
              {insight.percentage === null ? "—" : `${insight.percentage}%`}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#D7E2EF]">
            <div
              className={`h-full rounded-full ${insight.label === "Final score" ? "bg-[linear-gradient(90deg,#B3872F,#D6A936)]" : "bg-[linear-gradient(90deg,#1E4D8C,#C89B3C)]"}`}
              style={{ width: `${insight.percentage ?? 0}%` }}
            />
          </div>
        </div>
      ))}
      {hasMissingPreferenceScore ? (
        <p className="rounded-lg border border-dashed border-[#D7E2EF] bg-white px-3 py-2 text-[11px] font-medium leading-4 text-[#6C7C8C]">
          Set preferences to get more insights.
        </p>
      ) : null}
    </div>
  );
}

export function CompareTool({ compareRows, suggestion, formatPrice }: Props) {
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const first = compareRows[0];
  const second = compareRows[1];
  const productOne = first?.product;
  const productTwo = second?.product;
  const criteriaRows: Array<[string, ReactNode, ReactNode]> =
    productOne && productTwo
      ? [
          ["Name", productOne.name, productTwo.name],
          [
            "Price",
            formatPrice(productOne.price, productOne.currency),
            formatPrice(productTwo.price, productTwo.currency),
          ],
          ["Description", cleanProductDescription(productOne.description), cleanProductDescription(productTwo.description)],
          [
            "AI insights",
            <Insights key="first" insights={first.insights} />,
            <Insights key="second" insights={second.insights} />,
          ],
        ]
      : [];

  return (
    <div className="grid gap-3">
      <div className="rounded-2xl bg-[#0B2748] px-5 py-4 shadow-[0_12px_30px_-20px_rgba(10,31,58,.6)]">
        <h2 className="mt-1 text-xl font-semibold text-white">
          Product Compare
        </h2>
        <p className="mt-1 text-sm leading-5 text-[#AFC8E5]">
          Select two products from Smart Shopping to compare them here.
        </p>
      </div>
      {(!productOne || !productTwo) && suggestion ? (
        <div className="rounded-xl border border-[#E6D5A7] bg-[#FFF8E7] p-4 text-sm leading-6 text-[#5B6B7A]">
          {suggestion}
        </div>
      ) : null}
      {productOne && productTwo ? (
        <div className="overflow-hidden rounded-2xl border border-[#D7E2EF] bg-white shadow-[0_12px_32px_-24px_rgba(10,31,58,.35)]">
          <div
            ref={topScrollRef}
            className="overflow-x-scroll border-b border-[#D7E2EF] md:hidden"
            onScroll={(event) => {
              if (bottomScrollRef.current)
                bottomScrollRef.current.scrollLeft =
                  event.currentTarget.scrollLeft;
            }}
          >
            <div className="h-4 min-w-[720px]" />
          </div>
          <div
            ref={bottomScrollRef}
            className="overflow-x-scroll pb-2"
            onScroll={(event) => {
              if (topScrollRef.current)
                topScrollRef.current.scrollLeft =
                  event.currentTarget.scrollLeft;
            }}
          >
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-[#E7EEF7] text-[#0B2748]">
                <tr>
                  <th className="w-[22%] p-3 text-xs font-bold uppercase tracking-wide">
                    Criteria
                  </th>
                  <th className="w-[39%] p-3 font-semibold">Product 1</th>
                  <th className="w-[39%] p-3 font-semibold">Product 2</th>
                </tr>
              </thead>
              <tbody>
                {criteriaRows.map(([criteria, firstValue, secondValue]) => (
                  <tr key={criteria} className="border-t border-[#D7E2EF]">
                    <td className="bg-[#FAF7F1] p-3 align-top text-xs font-bold uppercase tracking-wide text-[#31577F]">
                      {criteria}
                    </td>
                    <td className="p-3 align-top leading-6 text-[#16202B]">
                      {firstValue}
                    </td>
                    <td className="p-3 align-top leading-6 text-[#16202B]">
                      {secondValue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
