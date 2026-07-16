export const primaryNav = [
  {
    label: "About",
    menu: [
      { label: "Our Philosophy", href: "/about/philosophy" },
      { label: "History", href: "/about/history" },
    ],
  },
  {
    label: "Program",
    menu: [
      { label: "Format", href: "/program/format" },
      { label: "Curriculum", href: "/program/curriculum" },
    ],
  },
  {
    label: "Community",
    menu: [
      { label: "Alumni", href: "/community/alumni" },
      { label: "Events", href: "/community/events" },
      { label: "Special Programs", href: "/community/programs" },
    ],
  },
  { label: "Teachers", href: "/teachers" },
  { label: "Song Library", href: "/song-library" },
  { label: "On Stage", href: "/on-stage" },
  { label: "Tools", href: "/tools" },
  { label: "FAQ", href: "/faq" },
];

export const instruments = [
  { name: "Guitar", emoji: "\u{1F3B8}" },
  { name: "Piano", emoji: "\u{1F3B9}" },
  { name: "Bass", emoji: "\u{1F3B8}" },
  { name: "Drums", emoji: "\u{1F941}" },
  { name: "Voice", emoji: "\u{1F3A4}" },
  { name: "Ukulele", emoji: "\u{1FA95}" },
];

export const audiences = [
  {
    title: "Keiki (ages 5+)",
    desc: "A gentle, song-based start built for little hands — sing-along first, instrument second.",
    cta: "See the early years",
    href: "/program/curriculum",
  },
  {
    title: "Teens & bands",
    desc: "Pair up with friends and siblings to form a real band, or go one-on-one at your own pace.",
    cta: "Explore band lessons",
    href: "/program/format",
  },
  {
    title: "Adults",
    desc: "It's never too late to learn your first song. Flexible scheduling for busy grown-up lives.",
    cta: "Start as an adult",
    href: "/program/format",
  },
];

export const testimonials = [
  {
    quote: "My daughter looks forward to Rock Works more than anything else in her week.",
    name: "A Rock Works parent",
  },
  {
    quote: "I never thought I'd be on a real stage — and now I can't imagine not playing.",
    name: "A Rock Works student",
  },
  {
    quote: "Ten years in, and the curriculum still surprises me with how well it's built.",
    name: "A Rock Works family",
  },
];

export const programs = [
  {
    slug: "rock-band",
    title: "Rock Band",
    desc: "Small groups learn one song together and take it to the stage as a full band.",
    method:
      "Four to five students, each on a different instrument, learn the same song in parallel — then rehearse it together as a band until it's ready for the stage.",
    structureItems: [
      "Weekly one-hour band rehearsal, on top of individual lessons",
      "Song chosen collaboratively based on the group's instruments and level",
      "Each member learns their part through the same five-level curriculum",
      "Culminates in a live performance at a Rock Works recital",
    ],
    forWho: "Students who've completed at least one solo song and want to play with others.",
    instruments: "Any combination of guitar, bass, drums, piano, and voice.",
    format: "Weekly group rehearsal + individual lessons.",
    progress: "Most bands are stage-ready within 8–10 weeks.",
    ctaLabel: "Ask About Rock Band",
  },
  {
    slug: "songwriting-workshop",
    title: "Songwriting Workshop",
    desc: "For students ready to write and record their own original music.",
    method:
      "Small workshop groups write, arrange, and record an original song over a series of sessions — covering lyric writing, chord progressions, melody, and a basic home recording setup.",
    structureItems: [
      "Six sessions, one song written and recorded start to finish",
      "Lyric writing and melody-building exercises",
      "Chord progression and arrangement basics",
      "A simple recorded demo to take home",
    ],
    forWho: "Students with at least a year of lessons who want to create, not just play covers.",
    instruments: "Any instrument — voice included.",
    format: "Small group workshop, six weekly sessions.",
    progress: "Every student leaves with a finished, recorded original song.",
    ctaLabel: "Ask About Songwriting",
  },
  {
    slug: "summer-intensive",
    title: "Summer Intensive",
    desc: "A concentrated two-week program covering a full song, start to finish.",
    method:
      "A focused two-week intensive that compresses a full song's five-level curriculum into daily sessions — ideal for students who want fast progress over summer break.",
    structureItems: [
      "Daily one-hour sessions over two weeks",
      "One full song, all five levels, start to finish",
      "Small group size for close individual attention",
      "Optional mini-performance on the final day",
    ],
    forWho: "Current students looking to accelerate over the summer, or new students who want an immersive start.",
    instruments: "Guitar, piano, bass, drums, voice, or ukulele.",
    format: "Daily sessions, two weeks.",
    progress: "Equivalent to roughly two months of weekly lessons, completed in two weeks.",
    ctaLabel: "Ask About Summer Intensive",
  },
];

export const footerLinks = [
  { label: "About", href: "/about/philosophy" },
  { label: "Program", href: "/program/format" },
  { label: "Teachers", href: "/teachers" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export const footerSocial = [
  { label: "Instagram", icon: "IG", href: "#" },
  { label: "Facebook", icon: "FB", href: "#" },
  { label: "YouTube", icon: "YT", href: "#" },
];
