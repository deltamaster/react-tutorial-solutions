import { useEffect, useState, useMemo } from 'react';
import './Snowfall.css';

function Snowfall() {
  const [isHolidaySeason, setIsHolidaySeason] = useState(false);

  useEffect(() => {
    // Check if it's December (holiday season)
    const currentMonth = new Date().getMonth(); // 0-11, where 11 is December
    setIsHolidaySeason(currentMonth === 11); // December is month 11
  }, []);

  // Generate snowflakes - memoized to avoid regeneration on every render
  const snowflakes = useMemo(() => {
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      animationDuration: 15 + Math.random() * 15, // 15-30 seconds for gentle floating
      animationDelay: Math.random() * 5, // 0-5 seconds delay
      size: 4 + Math.random() * 6, // 4-10px
      opacity: 0.3 + Math.random() * 0.7, // 0.3-1.0
    }));
  }, []);

  if (!isHolidaySeason) {
    return null;
  }

  return (
    <div className="snowfall-container">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="snowflake"
          style={{
            left: `${flake.left}%`,
            animationDuration: `${flake.animationDuration}s`,
            animationDelay: `${flake.animationDelay}s`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity,
          }}
        />
      ))}
    </div>
  );
}

export default Snowfall;

