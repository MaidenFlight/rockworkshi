import EditorialHero from "@/components/EditorialHero";

const PROGRAMS = [
  { title: "Rock Band", desc: "Small groups learn one song together and take it to the stage as a full band." },
  { title: "Songwriting Workshop", desc: "For students ready to write and record their own original music." },
  { title: "Summer Intensive", desc: "A concentrated two-week program covering a full song, start to finish." },
];

export default function SpecialPrograms() {
  return (
    <div>
      <EditorialHero eyebrow="Community" title="Special Programs" intro="Beyond weekly lessons — ways to go deeper." />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 100px" }}>
        <div className="rw-cols-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
          {PROGRAMS.map((p) => (
            <div key={p.title} style={{ border: "1px solid #ece0d5", borderRadius: 14, padding: 22, background: "#fffdf9" }}>
              <h3 style={{ fontWeight: 600, fontSize: 17.5, color: "#0a2338", margin: "0 0 10px" }}>{p.title}</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#6a6560" }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
