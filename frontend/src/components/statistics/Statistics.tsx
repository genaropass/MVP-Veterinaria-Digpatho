"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

const Statistics = () => {
  const stats = [
    { label: "Patients", value: 20000 },
    { label: "Tests", value: 25000 },
    { label: "Precision", value: 96 },
  ];

  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("statics");

  //section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
        }
      },
      { threshold: 0.6 } //trigger when 60% is visible
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-12"
    >
      <div className="max-w-6xl mx-auto text-center px-4">
        <h2 className="text-4xl font-bold mb-4">{t("h2")}</h2>
        <p className="text-lg mb-8">{t("text-s")}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((stat, index) => (
            <AnimatedStat
              key={index}
              value={stat.value}
              label={stat.label}
              visible={visible}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

type AnimatedStatProps = {
  value: number;
  label: string;
  visible: boolean;
};

//individual stat with animation
const AnimatedStat: React.FC<AnimatedStatProps> = ({
  value,
  label,
  visible,
}) => {
  const [currentValue, setCurrentValue] = useState(0);

  useEffect(() => {
    if (visible) {
      let start = 0;
      const increment = Math.ceil(value / 99); //increment value
      const interval = setInterval(() => {
        start += increment;
        if (start >= value) {
          setCurrentValue(value);
          clearInterval(interval);
        } else {
          setCurrentValue(start);
        }
      }, 25); // Update every 25ms

      return () => clearInterval(interval);
    }
  }, [visible, value]);

  return (
    <div className="flex flex-col items-center">
      <span className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
        {value <= 100 ? `${currentValue}%` : currentValue}
      </span>
      <span className="text-lg mt-2">{label}</span>
    </div>
  );
};

export default Statistics;
