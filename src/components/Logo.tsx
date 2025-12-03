export default function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* 三菱マーク（スリーダイヤ） - 正確な形状 */}
      <svg
        viewBox="0 0 100 100"
        className="w-9 h-9"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 上のダイヤ（菱形） */}
        <path
          d="M50 5 L70 35 L50 35 L30 35 Z"
          fill="#E60012"
        />
        {/* 左下のダイヤ（菱形） */}
        <path
          d="M25 42 L45 72 L25 72 L5 42 Z"
          fill="#E60012"
        />
        {/* 右下のダイヤ（菱形） */}
        <path
          d="M75 42 L95 42 L75 72 L55 72 Z"
          fill="#E60012"
        />
      </svg>
      {/* テキスト */}
      <span className="text-[17px] font-semibold text-[#222] tracking-wider">
        三菱地所レジデンス
      </span>
    </div>
  );
}
