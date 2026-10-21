export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  const alignClass =
    align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl text-left";
  return (
    <div className={alignClass}>
      <p className="text-xs font-bold uppercase tracking-widest text-pink-600">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-sm leading-relaxed text-gray-500 sm:text-base">
          {description}
        </p>
      )}
    </div>
  );
}
