"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import type { Product } from "@/lib/productCatalog";
import { V3Icon } from "../v3/Icon";

type PredictionResult = {
  warehouse: { name: string; latitude: number; longitude: number };
  destination: { name: string; latitude: number; longitude: number };
  weather: {
    source: string;
    warehouse: Weather;
    destination: Weather;
  };
  inputs: {
    distanceKm: number;
    routeDurationMinutes: number;
    traffic: string;
    orderType: string;
    itemCount: number;
    preparationStrategy: string;
  };
  prediction: {
    travelMinutes: number;
    preparationMinutes: number;
    totalMinutes: number;
    arrivalAt: string;
    preparationReason: string;
    preparationModel: string;
  };
};

type Weather = {
  condition: string;
  precipitation: number;
  temperature: number;
  weatherCode: number;
  windSpeed: number;
};

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes >= 24 * 60) {
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    return hours
      ? `${days} day${days === 1 ? "" : "s"} ${hours} hr`
      : `${days} day${days === 1 ? "" : "s"}`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} hr ${remaining} min` : `${hours} hr`;
}

function WeatherCard({ label, location, weather }: { label: string; location: string; weather: Weather }) {
  return (
    <article className="rounded-[14px] border border-[#D7E2EF] bg-white p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[1px] text-[#B3872F]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[#0B2748]">{location}</p>
      <p className="mt-2 text-xs text-[#5B6B7A]">
        {weather.condition} · {Math.round(weather.temperature)}°C · Wind {Math.round(weather.windSpeed)} km/h
      </p>
    </article>
  );
}

export function OrderTrackingTool({
  cities,
  products,
}: {
  cities: readonly string[];
  products: Product[];
}) {
  const [location, setLocation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const cartItems = useMemo(() => products.map((product) => product.name), [products]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    if (!location.trim()) {
      setError("Enter a delivery town, area, or postcode.");
      return;
    }
    if (cartItems.length === 0) {
      setError("Add at least one product to your cart before tracking delivery.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/delivery-prediction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: location.trim(), cartItems }),
      });
      const data = (await response.json()) as PredictionResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Delivery prediction failed.");
      setResult(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Delivery prediction failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-3 pb-8 pt-1 sm:px-5">
      <div className="overflow-hidden rounded-[20px] border border-[#D7E2EF] bg-[#F8FAFD] shadow-[0_18px_44px_-34px_rgba(10,31,58,.5)]">
        <header className="border-b border-[#D7E2EF] bg-white px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#0B2748] text-[#F5D477]"><V3Icon name="truck" className="h-5 w-5" /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.1px] text-[#B3872F]">Smart delivery estimate</p>
              <h1 className="mt-0.5 text-lg font-bold text-[#0A1F3A]">Order tracking</h1>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-xs leading-5 text-[#5B6B7A]">Estimate supplier lead time, warehouse preparation, and delivery travel using live weather and the delivery model.</p>
        </header>

        <form onSubmit={handleSubmit} className="grid gap-4 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-semibold text-[#31577F]">
              Warehouse
              <span className="flex h-11 items-center rounded-[11px] border border-[#D7E2EF] bg-[#EEF3F9] px-3.5 font-medium text-[#5B6B7A]">Colombo, Sri Lanka</span>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-[#31577F]">
              Delivery location
              <select value={location} onChange={(event) => setLocation(event.target.value)} className="h-11 rounded-[11px] border border-[#B8CBE0] bg-white px-3.5 text-sm font-medium text-[#0B2748] outline-none transition focus:border-[#3D74B8] focus:ring-2 focus:ring-[#D7E2EF]">
                <option value="">Select a delivery city</option>
                {cities.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
            </label>
          </div>

          {cartItems.length > 0 ? (
            <div className="rounded-[13px] border border-[#E4E1D8] bg-white p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[1px] text-[#B3872F]">Items from cart</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {products.map((product) => (
                  <article key={product.id} className="flex min-w-0 items-center gap-2.5 rounded-[10px] bg-[#F5F8FC] p-2">
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[8px] bg-white">
                      <Image src={product.imageUrl} alt="" fill unoptimized sizes="40px" className="object-cover" />
                    </span>
                    <span className="min-w-0"><span className="block truncate text-xs font-semibold text-[#0B2748]">{product.name}</span><span className="mt-0.5 block text-[10px] font-medium text-[#5B6B7A]">{product.category}</span></span>
                  </article>
                ))}
              </div>
            </div>
          ) : <p className="rounded-[13px] border border-dashed border-[#D7E2EF] bg-white px-3.5 py-4 text-center text-xs leading-5 text-[#5B6B7A]">Your cart is empty. Add products in Smart Shopping before tracking delivery.</p>}

          {error ? <p role="alert" className="rounded-[11px] border border-[#E9B9AA] bg-[#FFF4EF] px-3.5 py-2.5 text-xs font-medium text-[#A64E32]">{error}</p> : null}
          <button type="submit" disabled={isLoading} className="flex h-11 items-center justify-center gap-2 rounded-[11px] bg-[#0B2748] px-5 text-sm font-bold text-white transition hover:bg-[#123661] disabled:cursor-wait disabled:opacity-60">
            <V3Icon name={isLoading ? "sparkles" : "truck"} className="h-4 w-4" />
            {isLoading ? "Calculating prediction…" : "Predict delivery time"}
          </button>
        </form>

        {result ? (
          <div className="border-t border-[#D7E2EF] bg-[#F3F7FC] p-5 sm:p-6">
            <div className="rounded-[16px] bg-[#0B2748] p-5 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#F5D477]">Estimated total time</p>
              <p className="mt-1 text-3xl font-bold">{formatDuration(result.prediction.totalMinutes)}</p>
              <p className="mt-2 text-xs text-[#C8D9EB]">Estimated arrival: {new Date(result.prediction.arrivalAt).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <article className="rounded-[14px] border border-[#D7E2EF] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[1px] text-[#7D8994]">Sourcing + preparation</p><p className="mt-1 text-xl font-bold text-[#0B2748]">{formatDuration(result.prediction.preparationMinutes)}</p><p className="mt-1 text-[10px] text-[#7D8994]">Items are sourced in parallel; calculated to warehouse</p></article>
              <article className="rounded-[14px] border border-[#D7E2EF] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[1px] text-[#7D8994]">Travel estimate</p><p className="mt-1 text-xl font-bold text-[#0B2748]">{formatDuration(result.prediction.travelMinutes)}</p></article>
            </div>
            <p className="mt-3 rounded-[12px] border border-[#E4E1D8] bg-[#FFFDF8] px-3.5 py-3 text-xs leading-5 text-[#5B6B7A]">{result.prediction.preparationReason}</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <WeatherCard label="Warehouse weather" location={result.warehouse.name} weather={result.weather.warehouse} />
              <WeatherCard label="Destination weather" location={result.destination.name} weather={result.weather.destination} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-medium text-[#6C7C8C]">
              <span>{result.inputs.distanceKm} km driving-route distance</span>
              <span>{result.inputs.traffic} traffic</span>
              <span>{result.inputs.itemCount} item{result.inputs.itemCount === 1 ? "" : "s"}</span>
              <span>Weather: {result.weather.source}</span>
            </div>
            <p className="mt-3 text-[10px] leading-4 text-[#7D8994]">Prediction is an estimate, not a guaranteed delivery commitment. Road routing and operational delays may differ.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
