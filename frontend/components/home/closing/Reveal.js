"use client";

import { useEffect, useRef } from "react";

// Lets a block play in once, as it scrolls into view.
//
// The finished block is the plain markup: nothing is hidden by the server or by CSS alone. Only a
// block that is still below the screen when the page wakes up is "armed" (its styles hold it
// back), and it is released the moment it arrives. A block already on screen, a visitor who asks
// for less motion and a browser with no observer all get the finished block and nothing else.
export default function Reveal({ as: Tag = "div", margin = "0px 0px -14% 0px", children, ...rest }) {
  const root = useRef(null);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.86) return undefined;

    el.dataset.reveal = "armed";
    const watch = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        el.dataset.reveal = "in";
        watch.disconnect();
      },
      { rootMargin: margin },
    );
    watch.observe(el);
    return () => {
      watch.disconnect();
      delete el.dataset.reveal;
    };
  }, [margin]);

  return (
    <Tag ref={root} {...rest}>
      {children}
    </Tag>
  );
}
