import { PageHero } from "@/components/ui";

// EditorialHero was a second page banner, hand-rolled in inline styles, doing
// the same job as PageHero with different values: 800px measure against 900,
// its own copy of the gradient, its own copy of the wave. Nine routes used it
// and thirteen used PageHero, so the site had two page headers that were
// supposed to look identical and drifted every time one was touched — the old
// world's teal gradient was still hardcoded in here after the redesign had
// moved every other dark surface to lacquer.
//
// It is now a thin alias. One treatment reaches all nineteen public routes,
// and there is one place to change it. The prop name `intro` is kept rather
// than renamed to `lead` so no calling page had to change.
export default function EditorialHero({ eyebrow, title, intro }) {
  return <PageHero eyebrow={eyebrow} title={title} lead={intro} />;
}
