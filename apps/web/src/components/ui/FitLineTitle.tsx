import { useLayoutEffect, useRef, useState } from "react";

type Props = {
  text: string;
  className?: string;
  sizeRef?: React.RefObject<HTMLElement | null>;
  sizeRefKey?: string | number | boolean;
  minPx?: number;
};

type FitStyle = {
  fontPx: number;
  lineHPx: number;
  scaleX: number;
  naturalWidthPx: number;
};

function textBounds(el: HTMLElement): DOMRect {
  const node = el.firstChild;
  if (!node) return el.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect();
}

/** Подбираем font-size так, чтобы визуальная высота заглавных ≈ высоте pill. */
function fontSizeForPillHeight(title: HTMLElement, pillHeight: number): number {
  const cssMax = parseFloat(getComputedStyle(title).fontSize) || 28;
  let lo = 8;
  let hi = Math.max(cssMax * 2, pillHeight * 2);
  let best = pillHeight;

  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    title.style.fontSize = `${mid}px`;
    title.style.lineHeight = `${pillHeight}px`;
    title.style.height = `${pillHeight}px`;
    const h = textBounds(title).height;
    if (h < pillHeight * 0.97) lo = mid;
    else {
      best = mid;
      hi = mid;
    }
  }

  return best;
}

/**
 * Заголовок в одну строку: высота букв = pill-блоку времени,
 * длинные названия сжимаются по X (без уменьшения высоты букв).
 */
export function FitLineTitle({ text, className = "", sizeRef, sizeRefKey, minPx = 9 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [fit, setFit] = useState<FitStyle | null>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const title = titleRef.current;
    if (!wrap || !title) return;

    const measure = () => {
      const availWidth = wrap.clientWidth;
      if (availWidth <= 0) return;

      const refEl = sizeRef?.current;
      const lineHPx = refEl?.getBoundingClientRect().height ?? 0;
      const cssMax = parseFloat(getComputedStyle(title).fontSize) || 28;

      title.style.transform = "none";
      title.style.width = "auto";

      if (lineHPx > 0) {
        const fontPx = fontSizeForPillHeight(title, lineHPx);
        title.style.fontSize = `${fontPx}px`;
        title.style.lineHeight = `${lineHPx}px`;
        title.style.height = `${lineHPx}px`;
      } else {
        title.style.lineHeight = "1";
        title.style.height = "auto";
        title.style.fontSize = `${cssMax}px`;
      }

      const naturalWidthPx = title.scrollWidth;

      if (lineHPx <= 0) {
        let fontPx = cssMax;
        if (naturalWidthPx > availWidth) {
          let lo = minPx;
          let hi = cssMax;
          while (hi - lo > 0.5) {
            const mid = (lo + hi) / 2;
            title.style.fontSize = `${mid}px`;
            if (title.scrollWidth <= availWidth) lo = mid;
            else hi = mid;
          }
          fontPx = lo;
        }
        setFit({ fontPx, lineHPx: 0, scaleX: 1, naturalWidthPx: title.scrollWidth });
        return;
      }

      const fontPx = parseFloat(title.style.fontSize) || lineHPx;
      const scaleX =
        naturalWidthPx > 0 ? Math.min(1, availWidth / naturalWidthPx) : 1;

      setFit({
        fontPx,
        lineHPx,
        scaleX,
        naturalWidthPx,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    const refEl = sizeRef?.current;
    if (refEl) ro.observe(refEl);
    return () => ro.disconnect();
  }, [text, minPx, sizeRef, sizeRefKey]);

  const scaleX = fit?.scaleX ?? 1;
  const scaled = scaleX < 1;
  const boxWidthPx =
    fit && scaled ? Math.ceil(fit.naturalWidthPx * scaleX) : fit?.naturalWidthPx;

  return (
    <div ref={wrapRef} className="fit-line-title">
      <div
        className={`fit-line-title__box${scaled ? " fit-line-title__box--scaled" : ""}`}
        style={{
          width: boxWidthPx ? `${boxWidthPx}px` : undefined,
          maxWidth: "100%",
          height: fit && fit.lineHPx > 0 ? `${fit.lineHPx}px` : undefined,
        }}
      >
        <h2
          ref={titleRef}
          className={className}
          style={
            fit
              ? {
                  fontSize: `${fit.fontPx}px`,
                  lineHeight: fit.lineHPx > 0 ? `${fit.lineHPx}px` : 1,
                  height: fit.lineHPx > 0 ? `${fit.lineHPx}px` : undefined,
                  width: scaled ? `${fit.naturalWidthPx}px` : undefined,
                  transform: scaled ? `scaleX(${scaleX})` : undefined,
                  transformOrigin: "left center",
                }
              : undefined
          }
        >
          {text}
        </h2>
      </div>
    </div>
  );
}
