export default function Logo({ className = '' }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="三菱地所レジデンス"
      className={`h-8 w-auto ${className}`}
    />
  );
}
