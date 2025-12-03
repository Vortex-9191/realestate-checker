export default function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* 三菱マーク */}
      <svg
        viewBox="0 0 40 40"
        className="w-8 h-8"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 上のダイヤ */}
        <path
          d="M20 2 L28 14 L20 14 L12 14 Z"
          fill="#E60012"
        />
        {/* 左下のダイヤ */}
        <path
          d="M8 20 L16 32 L8 32 L0 20 Z"
          fill="#E60012"
        />
        {/* 右下のダイヤ */}
        <path
          d="M32 20 L40 20 L32 32 L24 32 Z"
          fill="#E60012"
        />
      </svg>
      {/* テキスト */}
      <span className="text-base font-bold text-zinc-800 tracking-tight whitespace-nowrap">
        三菱地所レジデンス
      </span>
    </div>
  );
}
