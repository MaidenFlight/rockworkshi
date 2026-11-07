import BeatMaker from "@/components/beats/BeatMaker";

// Comes with membership, like the piano (see the tools hub). The page is a thin shell: the kit,
// the grooves and the sequencer live in lib/drums, the instrument in components/beats.
export default function BeatMakerPage() {
  return <BeatMaker />;
}
