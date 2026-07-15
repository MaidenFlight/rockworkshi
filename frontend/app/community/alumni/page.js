import EditorialHero from "@/components/EditorialHero";

export default function Alumni() {
  return (
    <div>
      <EditorialHero eyebrow="Community" title="Alumni" intro="Rock Works students go on to keep playing — in bands, on stages, and for life." />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "48px 24px 100px", textAlign: "center" }}>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "#33454f" }}>
          We&apos;re building out alumni stories and where-are-they-now features here. If you&apos;re a former
          student and want to be featured, we&apos;d love to hear from you.
        </p>
      </div>
    </div>
  );
}
