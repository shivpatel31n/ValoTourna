import { useRef, useState, useEffect } from "react";

// ---------- REVEAL-ON-SCROLL WRAPPER ----------
// Fades/slides an element in when it enters the viewport, and back out when
// it leaves — so the effect replays both scrolling down AND scrolling back up.
export default function Reveal({ children, as: Tag = "section", once = false, ...rest }) {
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setActive(false);
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  return (
    <Tag
      ref={ref}
      {...rest}
      style={{
        ...rest.style,
        opacity: active ? 1 : 0,
        transform: active ? "translateY(0)" : "translateY(50px)",
        transition: "all .7s ease",
      }}
    >
      {children}
    </Tag>
  );
}