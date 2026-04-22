import { ShieldIcon } from "./icons";

export function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <div className={large ? "flex flex-col items-center mb-8" : "flex items-center gap-2.5 px-4 pt-5 pb-6"}>
      <div
        className={
          large
            ? "mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500 shadow-lg shadow-sky-200"
            : "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-sky-500"
        }
      >
        <ShieldIcon className={large ? "h-6 w-6 text-white" : "h-4 w-4 text-white"} />
      </div>
      <div className={large ? "text-center" : ""}>
        <span className={large ? "text-lg font-bold tracking-tight text-slate-900" : "text-sm font-bold tracking-tight text-white"}>
          Governix
        </span>
        {large ? <p className="mono mt-0.5 text-xs text-slate-400">Control plane for Bedrock AI</p> : null}
      </div>
    </div>
  );
}

