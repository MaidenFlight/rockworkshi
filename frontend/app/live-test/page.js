import LiveRoomTest from "@/components/live/LiveRoomTest";

// A test of the sing-along mixer, not a page for students. It isn't linked from anywhere, and its
// room-pass route stays switched off on the live site until it's configured.
export const metadata = {
  title: "Live room test — Rock Works",
  robots: { index: false, follow: false },
};

export default function LiveTestPage() {
  return <LiveRoomTest />;
}
