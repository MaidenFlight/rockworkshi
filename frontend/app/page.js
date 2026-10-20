import HomeSilkie from "@/components/home/HomeSilkie";
import HomeClassic from "@/components/home/HomeClassic";

// Both homepages ship, and [data-world] on <html> decides which one paints.
export default function Home() {
  return (
    <>
      <div className="rw-world-silkie">
        <HomeSilkie />
      </div>
      <div className="rw-world-classic">
        <HomeClassic />
      </div>
    </>
  );
}
