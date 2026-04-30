type Props = {
  goBack: () => void;
};

export default function UsbPanel({ goBack }: Props) {
  return (
    <main className="min-h-screen p-6 bg-gray-50 relative">

      <button
        onClick={goBack}
        className="absolute top-4 left-4 px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
      >
        ← Back
      </button>

      <h1 className="text-3xl font-black text-center mt-12">
        USB
      </h1>

    </main>
  );
}