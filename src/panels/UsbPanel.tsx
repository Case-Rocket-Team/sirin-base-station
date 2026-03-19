type Props = {
  goBack: () => void;
};

export default function UsbPanel({ goBack }: Props) {
  return (
    <main>
      <button onClick={goBack}>← Back</button>

      <h1>
        USB
      </h1>
    </main>
  );
}