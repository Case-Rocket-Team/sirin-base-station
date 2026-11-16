type Props = {
  className?: string;
};

export default function CRTLogo({ className = "" }: Props) {
  return (
    <div className={`flex items-center justify-center rounded-full border border-cyan-300/35 bg-[radial-gradient(circle,_rgba(56,189,248,0.25),_rgba(2,6,23,0.9))] shadow-[0_0_40px_rgba(56,189,248,0.18)] ${className}`}>
      <div className="flex h-24 w-24 items-center justify-center rounded-full border border-cyan-300/40 bg-black/25 font-mono text-xs uppercase tracking-[0.4em] text-cyan-100">
        CRT
      </div>
    </div>
  );
}

