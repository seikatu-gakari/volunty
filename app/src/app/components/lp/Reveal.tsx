"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * スクロールで要素が viewport に入ったタイミングで `is-visible` を付与し、
 * CSS 側の `.reveal` トランジションで fade-in & translateY を表示する。
 *
 * 軽量に保つため IntersectionObserver を 1 度だけ発火させる（unobserve）。
 */
interface RevealProps {
  children: ReactNode;
  /** 表示遅延 (ms) */
  delay?: number;
  /** ラッパー要素に追加するクラス */
  className?: string;
  /** 出現方向 */
  variant?: "up" | "left" | "right" | "fade";
  /** as 要素 (div | section) */
  as?: "div" | "section";
}

export function Reveal({
  children,
  delay = 0,
  className = "",
  variant = "up",
  as = "div",
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      const timeoutId = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(timeoutId);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Tag = as;

  return (
    <Tag
      ref={ref as never}
      data-variant={variant}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}
