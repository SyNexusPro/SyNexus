import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  createSeriesMarkers,
  ColorType,
  type CandlestickData,
  type LineData,
  type SeriesMarker,
  type Time,
  type IChartApi,
} from "lightweight-charts";

export type TitanChartCandle = CandlestickData<Time>;
export type TitanChartLinePoint = LineData<Time>;
export type TitanChartSignal = {
  time: Time;
  text?: string;
};

type TitanMarketChartProps = {
  candles?: TitanChartCandle[];
  lineData?: TitanChartLinePoint[];
  buySignals?: TitanChartSignal[];
  sellSignals?: TitanChartSignal[];
  symbol?: string;
};

function markerTimeKey(time: Time): number {
  if (typeof time === "number") return time;
  if (typeof time === "string") return Date.parse(time) / 1000;
  return Date.UTC(time.year, time.month - 1, time.day) / 1000;
}

export function TitanMarketChart({
  candles = [],
  lineData = [],
  buySignals = [],
  sellSignals = [],
  symbol = "SOL/USD",
}: TitanMarketChartProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const chart: IChartApi = createChart(container, {
      width: container.clientWidth,
      height: 430,
      layout: {
        background: {
          type: ColorType.Solid,
          color: "#060914",
        },
        textColor: "#9da8c7",
        fontFamily:
          "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      },
      grid: {
        vertLines: {
          color: "rgba(55, 86, 160, 0.32)",
        },
        horzLines: {
          color: "rgba(215, 44, 121, 0.26)",
        },
      },
      crosshair: {
        vertLine: {
          color: "rgba(0, 191, 255, 0.65)",
          width: 1,
          style: 2,
          labelBackgroundColor: "#10172b",
        },
        horzLine: {
          color: "rgba(0, 191, 255, 0.65)",
          width: 1,
          style: 2,
          labelBackgroundColor: "#10172b",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(74, 98, 160, 0.45)",
        scaleMargins: {
          top: 0.1,
          bottom: 0.15,
        },
      },
      timeScale: {
        borderColor: "rgba(74, 98, 160, 0.45)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00ff38",
      downColor: "#ff006e",
      borderUpColor: "#00ff38",
      borderDownColor: "#ff006e",
      wickUpColor: "#00ff38",
      wickDownColor: "#ff006e",
      priceLineVisible: true,
      lastValueVisible: true,
    });

    if (candles.length) {
      candleSeries.setData(candles);
    }

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: "#00bfff",
      topColor: "rgba(0, 191, 255, 0.28)",
      bottomColor: "rgba(0, 191, 255, 0.02)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const areaData =
      lineData.length > 0
        ? lineData
        : candles.map((candle) => ({
            time: candle.time,
            value: candle.close,
          }));

    if (areaData.length) {
      areaSeries.setData(areaData);
    }

    const trendSeries = chart.addSeries(LineSeries, {
      color: "#16d9ff",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    if (lineData.length) {
      trendSeries.setData(lineData);
    }

    const markers: SeriesMarker<Time>[] = [
      ...buySignals.map((signal) => ({
        time: signal.time,
        position: "aboveBar" as const,
        color: "#00ff38",
        shape: "arrowUp" as const,
        text: signal.text || "BUY",
      })),
      ...sellSignals.map((signal) => ({
        time: signal.time,
        position: "belowBar" as const,
        color: "#ff006e",
        shape: "arrowDown" as const,
        text: signal.text || "SELL",
      })),
    ].sort((a, b) => markerTimeKey(a.time) - markerTimeKey(b.time));

    if (markers.length) {
      createSeriesMarkers(candleSeries, markers);
    }

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries.length) return;
      const { width } = entries[0].contentRect;
      chart.applyOptions({ width });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [candles, lineData, buySignals, sellSignals]);

  return (
    <div className="titan-chart-shell">
      <div className="titan-chart-header">
        <div>
          <div className="titan-chart-symbol">{symbol}</div>
          <div className="titan-chart-subtitle">TITAN LIVE MARKET INTELLIGENCE</div>
        </div>
        <div className="titan-live-status">
          <span className="titan-live-dot" />
          LIVE
        </div>
      </div>
      <div ref={chartContainerRef} className="titan-chart-container" />
    </div>
  );
}

export default TitanMarketChart;
