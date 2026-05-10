import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

type ImageAsset = {
  element: HTMLImageElement;
  width: number;
  height: number;
  name: string;
};

type EditorState = {
  logoX: number;
  logoY: number;
  logoWidth: number;
  barsEnabled: boolean;
  barHeight: number;
};

const defaultState: EditorState = {
  logoX: 0,
  logoY: 0,
  logoWidth: 320,
  barsEnabled: false,
  barHeight: 90,
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const loadImage = (src: string, name = "image") =>
  new Promise<ImageAsset>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ element: img, width: img.naturalWidth, height: img.naturalHeight, name });
    img.onerror = reject;
    img.src = src;
  });

function fitStateToImage(base: ImageAsset, logo: ImageAsset): EditorState {
  const ratio = logo.height / logo.width;
  const logoWidth = Math.round(Math.min(base.width * 0.34, base.height / ratio));
  const logoHeight = logoWidth * ratio;

  return {
    ...defaultState,
    logoWidth,
    logoX: Math.round((base.width - logoWidth) / 2),
    logoY: Math.round(base.height - logoHeight - base.height * 0.06),
    barHeight: Math.round(base.height * 0.11),
  };
}

function drawEditor(ctx: CanvasRenderingContext2D, base: ImageAsset, logo: ImageAsset, state: EditorState, scale: number) {
  const width = base.width;
  const height = base.height;
  const logoHeight = state.logoWidth * (logo.height / logo.width);

  ctx.save();
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(base.element, 0, 0, width, height);

  if (state.barsEnabled) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, state.barHeight);
    ctx.fillRect(0, height - state.barHeight, width, state.barHeight);
  }

  ctx.drawImage(logo.element, state.logoX, state.logoY, state.logoWidth, logoHeight);
  ctx.restore();
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const baseUrlRef = useRef<string | null>(null);
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const pendingInitialFitRef = useRef(false);

  const [base, setBase] = useState<ImageAsset | null>(null);
  const [logo, setLogo] = useState<ImageAsset | null>(null);
  const [state, setState] = useState<EditorState>(defaultState);
  const [scale, setScale] = useState(1);
  const [message, setMessage] = useState("JPG / PNG / WebP、10MBまで");

  useEffect(() => {
    loadImage(`${import.meta.env.BASE_URL}original-aoyama.png`, "original-aoyama.png")
      .then(setLogo)
      .catch(() => setMessage("ロゴ素材を読み込めませんでした"));
  }, []);

  useEffect(() => {
    if (base && logo && pendingInitialFitRef.current) {
      pendingInitialFitRef.current = false;
      setState(fitStateToImage(base, logo));
    }
  }, [base, logo]);

  const normalizeState = useCallback(
    (next: EditorState) => {
      if (!base || !logo) return next;
      const ratio = logo.height / logo.width;
      const maxLogoWidth = Math.max(24, Math.min(base.width, base.height / ratio));
      const logoWidth = clamp(next.logoWidth, 24, maxLogoWidth);
      const logoHeight = logoWidth * ratio;

      return {
        ...next,
        logoWidth,
        logoX: clamp(next.logoX, 0, Math.max(0, base.width - logoWidth)),
        logoY: clamp(next.logoY, 0, Math.max(0, base.height - logoHeight)),
        barHeight: clamp(next.barHeight, 0, Math.floor(base.height * 0.36)),
      };
    },
    [base, logo],
  );

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !base || !logo) return;

    const maxWidth = Math.max(280, wrap.clientWidth);
    const previewScale = Math.min(1, maxWidth / base.width, 680 / base.height);
    const cssWidth = Math.max(1, Math.round(base.width * previewScale));
    const cssHeight = Math.max(1, Math.round(base.height * previewScale));
    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    setScale(previewScale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawEditor(ctx, base, logo, normalizeState(state), previewScale * dpr);
  }, [base, logo, state, normalizeState]);

  useEffect(() => {
    drawPreview();
    window.addEventListener("resize", drawPreview);
    return () => window.removeEventListener("resize", drawPreview);
  }, [drawPreview]);

  useEffect(() => {
    return () => {
      if (baseUrlRef.current) URL.revokeObjectURL(baseUrlRef.current);
    };
  }, []);

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXTENSIONS.test(file.name)) {
      setMessage("JPG / PNG / WebP を選択してください");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setMessage("ファイルサイズは10MBまでです");
      return;
    }

    try {
      const url = URL.createObjectURL(file);
      const loaded = await loadImage(url, file.name);
      if (baseUrlRef.current) URL.revokeObjectURL(baseUrlRef.current);
      baseUrlRef.current = url;
      setBase(loaded);
      pendingInitialFitRef.current = !logo;
      if (logo) setState(fitStateToImage(loaded, logo));
      setMessage(`${file.name} を読み込みました`);
    } catch {
      setMessage("画像の読み込みに失敗しました");
    }
  };

  const pointerToImage = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!base || !logo) return;
    const point = pointerToImage(event);
    const safe = normalizeState(state);
    const logoHeight = safe.logoWidth * (logo.height / logo.width);

    if (
      point.x < safe.logoX ||
      point.x > safe.logoX + safe.logoWidth ||
      point.y < safe.logoY ||
      point.y > safe.logoY + logoHeight
    ) {
      return;
    }

    dragRef.current = { offsetX: point.x - safe.logoX, offsetY: point.y - safe.logoY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current || !base || !logo) return;
    const point = pointerToImage(event);
    const drag = dragRef.current;
    setState((current) =>
      normalizeState({
        ...current,
        logoX: point.x - drag.offsetX,
        logoY: point.y - drag.offsetY,
      }),
    );
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      return;
    }
  };

  const renderPngBlob = () =>
    new Promise<Blob | null>((resolve) => {
      if (!base || !logo) {
        resolve(null);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = base.width;
      canvas.height = base.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      drawEditor(ctx, base, logo, normalizeState(state), 1);
      canvas.toBlob(resolve, "image/png");
    });

  const savePng = async () => {
    const blob = await renderPngBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.download = `conan-movie-trailer-${stamp}.png`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    if (base && logo) setState(fitStateToImage(base, logo));
  };

  const sizeLimits = useMemo(() => {
    if (!base || !logo) return { min: 24, max: 1200 };
    return { min: 24, max: Math.round(Math.max(24, Math.min(base.width, base.height / (logo.height / logo.width)))) };
  }, [base, logo]);

  const update = (patch: Partial<EditorState>) => setState((current) => normalizeState({ ...current, ...patch }));

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-3 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:py-6">
        <section className="min-w-0">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-normal sm:text-3xl">コナン映画予告メーカー</h1>
              <p className="mt-2 text-sm font-medium text-cyan-200 sm:text-base">背景画像をアップして映画版コナン風の予告画像を作ろう</p>
              <p className="mt-1 text-xs text-neutral-500 sm:text-sm">サーバーに画像は保存されることはありません</p>
              <div className="mt-4 max-w-xs sm:max-w-sm">
                <img className="w-full rounded-md border border-neutral-800 shadow-xl" src={`${import.meta.env.BASE_URL}example.png`} alt="作成例" />
                <p className="mt-2 text-center text-xs font-medium text-neutral-400 sm:text-sm">このような画像ができます</p>
              </div>
              <p className="mt-3 text-sm text-neutral-400">{message}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <button className="btn secondary" onClick={reset} disabled={!base}>
                リセット
              </button>
              <button className="btn primary" onClick={savePng} disabled={!base}>
                PNG保存
              </button>
            </div>
          </div>

          <label className="mb-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-neutral-600 bg-neutral-900 px-4 py-5 text-center transition hover:border-cyan-400 hover:bg-neutral-900/75">
            <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleFile(event.target.files?.[0])} />
            <span className="text-base font-semibold">画像をアップロード</span>
            <span className="mt-1 text-sm text-neutral-400">JPG / PNG / WebP、10MBまで</span>
          </label>

          <div ref={wrapRef} className="flex min-h-[300px] touch-none items-center justify-center overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 p-2 sm:min-h-[520px]">
            {base ? (
              <canvas
                ref={canvasRef}
                className="max-w-full cursor-grab touch-none rounded-md shadow-2xl active:cursor-grabbing"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            ) : (
              <div className="px-6 text-center text-neutral-500">アップロードすると編集キャンバスが表示されます</div>
            )}
          </div>
        </section>

        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Panel title="ロゴ">
            <Range label="サイズ" min={sizeLimits.min} max={sizeLimits.max} value={Math.round(state.logoWidth)} onChange={(logoWidth) => update({ logoWidth })} suffix="px" disabled={!base} />
            <div className="grid grid-cols-2 gap-2">
              <NumberInput label="X" value={Math.round(state.logoX)} onChange={(logoX) => update({ logoX })} disabled={!base} />
              <NumberInput label="Y" value={Math.round(state.logoY)} onChange={(logoY) => update({ logoY })} disabled={!base} />
            </div>
            <p className="text-xs text-neutral-500">ロゴは画像エリア内に収まる範囲でドラッグできます</p>
          </Panel>

          <Panel title="黒帯">
            <Toggle label="上下黒帯" checked={state.barsEnabled} onChange={(barsEnabled) => update({ barsEnabled })} disabled={!base} />
            <Range label="高さ" min={0} max={base ? Math.floor(base.height * 0.36) : 300} value={Math.round(state.barHeight)} onChange={(barHeight) => update({ barHeight })} suffix="px" disabled={!base || !state.barsEnabled} />
          </Panel>
        </aside>
      </div>
      <footer className="mx-auto w-full max-w-7xl px-3 pb-6 text-center text-xs text-neutral-500 sm:px-6">
        Creatived by{" "}
        <a className="font-semibold text-cyan-300 underline-offset-4 hover:underline" href="https://github.com/osugi585077" target="_blank" rel="noreferrer">
          Osugi
        </a>
      </footer>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-3 text-sm font-bold text-neutral-200">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3">
      <span className="text-sm text-neutral-300">{label}</span>
      <input className="toggle" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
    </label>
  );
}

function Range({ label, value, min, max, suffix, onChange, disabled }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-3">
        <span className="label">{label}</span>
        <span className="text-xs text-neutral-400">
          {value}
          {suffix}
        </span>
      </span>
      <input className="range" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} disabled={disabled} />
    </label>
  );
}

function NumberInput({ label, value, onChange, disabled }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <label>
      <span className="label">{label}</span>
      <input className="field" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} disabled={disabled} />
    </label>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
