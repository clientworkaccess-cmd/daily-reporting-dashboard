interface DonutMeterProps {
  value: number;
  color: string;
}

export function DonutMeter({ value, color }: DonutMeterProps) {
  const size         = 80;
  const radius       = 23;
  const circumference = 2 * Math.PI * radius;
  const normalized   = Math.max(0, Math.min(value, 100));
  const strokeDashoffset = circumference * (1 - normalized / 100);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-[72px] w-[72px]">
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#ecf0f4"
        strokeWidth="10"
      />
      {/* Filled arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
