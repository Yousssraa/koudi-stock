import { useEffect, useRef, useState } from "react";

export default function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
  direction = "up",
}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hidden =
    direction === "up"
      ? "translate-y-8"
      : direction === "down"
      ? "-translate-y-8"
      : direction === "left"
      ? "-translate-x-8"
      : direction === "right"
      ? "translate-x-8"
      : "scale-95";

  const visible =
    direction === "up" || direction === "down"
      ? "translate-y-0"
      : direction === "left" || direction === "right"
      ? "translate-x-0"
      : "scale-100";

  return (
    <Tag
      ref={ref}
      className={`${className} transition-all duration-700 ease-out will-change-transform ${
        shown ? `opacity-100 ${visible}` : `opacity-0 ${hidden}`
      }`}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}
