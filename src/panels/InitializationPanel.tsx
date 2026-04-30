type Props = {
  switchScreen: (panel: "init" | "telemetry" | "usb") => void;
};

export default function InitializationPanel({ switchScreen }: Props) {
  return (
    <main className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">

      <h1 className="text-3xl font-black mb-8">
        Initialization
      </h1>

      <div className="w-full max-w-xl space-y-4">

        {/* TELEMETRY ROW */}
        <div className="bg-white shadow rounded-lg p-4 flex items-center justify-between">
          <span className="text-lg font-semibold">
            Sirin Base Station
          </span>

          <button
            onClick={() => switchScreen("telemetry")}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Open
          </button>
        </div>

        {/* USB ROW */}
        <div className="bg-white shadow rounded-lg p-4 flex items-center justify-between">
          <span className="text-lg font-semibold">
            USB
          </span>

          <button
            onClick={() => switchScreen("usb")}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Open
          </button>
        </div>

      </div>

    </main>
  );
}