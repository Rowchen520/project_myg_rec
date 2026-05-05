"use client";

import { useEffect, useState } from "react";

/**
 * Keeps a 16:9 big-screen canvas visible without scrollbars.
 */
export function useScreenScale(width = 1920, height = 1080) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function update() {
      setScale(Math.min(window.innerWidth / width, window.innerHeight / height));
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [height, width]);

  return scale;
}
