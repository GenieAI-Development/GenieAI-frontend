# Delivery Prediction

Delivery Prediction estimates when the current cart can arrive from the GenieAI warehouse in Colombo. It is an operational estimate, not a delivery promise or a live checkout availability check.

## Inputs and sources

The user selects a delivery town, area, or postcode and must have at least one cart product. The API accepts a location up to 160 characters and uses at most 12 product names (180 characters each).

| Data | Source | Use |
| --- | --- | --- |
| Warehouse | Fixed Colombo coordinates (`6.9271, 79.8612`) | Route origin |
| Destination coordinates | Open-Meteo geocoding, Sri Lanka only | Route and local weather |
| Driving route | OSRM | Distance and base driving duration |
| Current weather | Open-Meteo | Traffic/weather delay |
| Cart item names + weather | Groq delivery model | Readiness estimate and explanation |

## Flow

```text
Cart + delivery location
→ geocode destination
→ fetch Colombo/destination weather and driving route
→ estimate warehouse readiness
→ adjust travel time for traffic and weather
→ total estimate and arrival time
```

## Rules and calculations

### Travel

Traffic is based on the current Sri Lanka time:

- **High:** 07:00–09:00 or 16:00–20:00
- **Medium:** rain, or 10:00–15:00
- **Low:** otherwise

Weather is `Windy` at wind speed `>= 30 km/h`, `Sunny` for weather code `0`, `Fog` for `45/48`, `Stormy` for codes `>= 80`, otherwise `Cloudy`.

```text
traffic multiplier = High 1.35 | Medium 1.15 | Low 1.00
weather multiplier = Stormy 1.30 | Fog/Windy 1.15 | precipitation 1.10 | otherwise 1.00

travelMinutes = round(routeMinutes × trafficMultiplier × weatherMultiplier + 8)
```

Travel is clamped to 1–1,440 minutes. The additional 8 minutes represents dispatch/handling time.

### Sourcing and preparation

Groq estimates supplier lead time, made-to-order production, receiving and quality checks, parallel sourcing, consolidation, packing, perishability, and destination weather. It must return one estimate between 15 and 43,200 minutes.

Supplier lead times are never added item by item. All items are sourced in parallel, so the slowest applicable item sets the minimum:

| Cart contains | Minimum supplier lead time |
| --- | ---: |
| Custom, personalized, engraved, or bespoke item | 2 days |
| Cake, bakery, or dessert | 1 day |
| Flower, bouquet, jewellery/jewelry | 12 hours |
| Other items | 3 hours |

```text
consolidationMinutes = 30 + min(30, 5 × (itemCount - 1))
minimumReadiness = supplierLeadMinutes + consolidationMinutes
preparationMinutes = max(Groq estimate, minimumReadiness)
totalMinutes = preparationMinutes + travelMinutes
arrivalAt = request time + totalMinutes
```

Preparation is clamped to 15–43,200 minutes. This minimum protects against a model estimate that is shorter than required sourcing and packing time.

## Result

The UI shows total estimated time, estimated arrival, sourcing/preparation time, travel time, driving distance, traffic level, route map, and weather at the warehouse and destination. The response also includes the preparation reason and the model used.

## Limits

- Predictions depend on public geocoding, weather, routing, and Groq availability; they can change between requests.
- Routing and weather do not guarantee road conditions, supplier availability, or delivery capacity.