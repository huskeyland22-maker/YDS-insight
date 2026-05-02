import PanicDashboard from "./components/PanicDashboard.jsx";

const panicData = {
  short: [
    { name: "VIX", value: 16.99, avg: 19.85 },
    { name: "VXN", value: 21.92, avg: 24.6 },
    { name: "Put/Call", value: 0.65, avg: 0.78 },
  ],
  mid: [
    { name: "CNN Fear & Greed", value: 65, avg: 50 },
    { name: "BofA Bull & Bear", value: 6.5, avg: 4.75 },
    { name: "MOVE Index", value: 70.41, avg: 84.2 },
  ],
  long: [
    { name: "SKEW", value: 141.38, avg: 134.5 },
    { name: "HY Spread", value: 2.84, avg: 4.12 },
    { name: "GS B/B", value: 68, avg: 52 },
  ],
};

export default function App() {
  return (
    <div className="min-h-screen">
      <PanicDashboard data={panicData} />
    </div>
  );
}
