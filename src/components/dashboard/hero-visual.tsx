import { ArrowRight, BadgeCheck, Inbox, PackageCheck, ScanSearch, type LucideIcon } from "lucide-react";

type Layer = { label: string; icon: LucideIcon; tile: string; icon_: string };

// Bottom to top: a return rises through the desk's stages. Colours match the status palette.
const LAYERS: Layer[] = [
  { label: "Request", icon: Inbox, tile: "border-open-line", icon_: "bg-open-bg text-open-fg" },
  { label: "Review", icon: ScanSearch, tile: "border-review-line", icon_: "bg-review-bg text-review-fg" },
  { label: "Resolution", icon: BadgeCheck, tile: "border-approved-line", icon_: "bg-approved-bg text-approved-fg" },
  { label: "Completion", icon: PackageCheck, tile: "border-completed-line", icon_: "bg-completed-bg text-completed-fg" },
];

/**
 * The product idea in one picture: four stacked, isometric plates (request → review →
 * resolution → completion). Pure CSS 3D, no images. Decorative, so hidden from assistive tech;
 * the same stages are spelled out in text underneath.
 */
export function HeroVisual() {
  return (
    <div aria-hidden className="relative flex flex-col items-center">
      <div className="relative h-[290px] w-[340px] [perspective:1400px]">
        <div className="absolute left-1/2 top-[58%] h-0 w-0 [transform-style:preserve-3d] [transform:rotateX(58deg)_rotateZ(-40deg)]">
          {/* soft floor shadow */}
          <div className="absolute -left-[130px] -top-[90px] h-[180px] w-[260px] rounded-[2rem] bg-ink/10 blur-2xl" />
          {LAYERS.map((layer, i) => {
            const Icon = layer.icon;
            return (
              <div
                key={layer.label}
                className="absolute -left-[110px] -top-[72px] [transform-style:preserve-3d]"
                style={{ transform: `translateZ(${i * 38}px)` }}
              >
                <div
                  className={`flex h-[144px] w-[220px] animate-float flex-col justify-between rounded-[1.4rem] border bg-surface/90 p-4 shadow-raised backdrop-blur ${layer.tile}`}
                  style={{ animationDelay: `${i * -1.2}s` }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`grid size-8 place-items-center rounded-lg ${layer.icon_}`}>
                      <Icon className="size-4" />
                    </span>
                    <span className="text-sm font-semibold text-ink">{layer.label}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="h-1.5 w-3/4 rounded-full bg-surface-3" />
                    <span className="h-1.5 w-1/2 rounded-full bg-surface-3" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="-mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
        {LAYERS.map((layer, i) => (
          <span key={layer.label} className="flex items-center gap-1.5">
            {layer.label}
            {i < LAYERS.length - 1 && <ArrowRight className="size-3" />}
          </span>
        ))}
      </div>
    </div>
  );
}
