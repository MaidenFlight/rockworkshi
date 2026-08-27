export const primaryNav = [
  { label: "Home", href: "/" },
  {
    label: "About",
    menu: [
      { label: "Philosophy", href: "/about/philosophy" },
      { label: "History", href: "/about/history" },
      { label: "Teachers", href: "/teachers" },
      { label: "Alumni", href: "/community/alumni" },
    ],
  },
  {
    label: "Lessons",
    menu: [
      { label: "How It Works", href: "/program/how-it-works" },
      { label: "Curriculum", href: "/program/curriculum" },
      { label: "Song Library", href: "/song-library" },
      { label: "Format & Pricing", href: "/program/format" },
      { label: "Music Tools", href: "/tools" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    label: "Programs",
    menu: [
      { label: "Individual Lessons", href: "/community/programs/individual-lessons" },
      { label: "Rock Band Program", href: "/community/programs/rock-band-program" },
      { label: "School Program", href: "/community/programs/school-program" },
      { label: "After-School Program", href: "/community/programs/after-school-program" },
    ],
  },
  { label: "Events", href: "/community/events" },
  { label: "On Stage", href: "/on-stage" },
  { label: "Contact", href: "/contact" },
];

// These six names are load-bearing: signup stores the string, and the backend
// matches lesson videos against it (backend/src/lib/lessonVideos.js). The
// artwork lives in components/InstrumentIcon.js, keyed by these same names.
export const instruments = [
  { name: "Guitar" },
  { name: "Piano" },
  { name: "Bass" },
  { name: "Drums" },
  { name: "Voice" },
  { name: "Ukulele" },
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
    slug: "individual-lessons",
    title: "Individual Lessons",
    desc: "One-on-one weekly lessons built around the same real song, start to finish.",
    method:
      "Each student works one-on-one with a teacher through the five-level curriculum on a single song at a time — sing-along, chords, scales and fills, melody, then improv — before moving to the next.",
    structureItems: [
      "One weekly 30 or 45-minute private lesson",
      "Teacher matched to the student's instrument and goals",
      "Song-based curriculum — always learning a real, complete song",
      "Progress tracked level by level, at the student's own pace",
    ],
    forWho: "Any student, any age, who wants dedicated one-on-one instruction.",
    instruments: "Guitar, piano, bass, drums, voice, or ukulele.",
    format: "Weekly private lesson, 30 or 45 minutes.",
    progress: "Most students complete one full song every 4–6 weeks.",
    ctaLabel: "Ask About Individual Lessons",
  },
  {
    slug: "rock-band-program",
    title: "Rock Band Program",
    desc: "Small groups learn one song together and take it to the stage as a full band.",
    method:
      "Four to five students, each on a different instrument, learn the same song in parallel through their individual lessons — then rehearse it together as a band until it's ready for the stage.",
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
    slug: "school-program",
    title: "School Program",
    desc: "In-school music instruction Rock Works runs on-site during the school day.",
    method:
      "Rock Works partners with schools to run the same song-based curriculum on campus, in-class or during an elective period — no separate transportation or after-school scheduling needed for families.",
    structureItems: [
      "Weekly on-site lessons during the school day or an elective block",
      "Same five-level, song-based curriculum as our studio program",
      "Coordinated with school staff and schedules",
      "Optional showcase at a school assembly or event",
    ],
    forWho: "Schools and families who want music instruction built into the school day.",
    instruments: "Guitar, piano, bass, drums, voice, or ukulele, depending on the school's setup.",
    format: "Weekly on-site group or individual sessions, arranged with the school.",
    progress: "Tracks the standard curriculum pace — one song every 4–6 weeks per student.",
    ctaLabel: "Ask About the School Program",
  },
  {
    slug: "after-school-program",
    title: "After-School Program",
    desc: "Drop-in music lessons that fit right into an existing after-school routine.",
    method:
      "Students already staying for after-school care or activities join a Rock Works instructor on-site for their weekly lesson — no extra pickup or drop-off required.",
    structureItems: [
      "Weekly lesson slotted into the after-school block",
      "Same five-level, song-based curriculum as our studio program",
      "No additional transportation — lessons happen where kids already are",
      "Regular progress updates sent home to families",
    ],
    forWho: "Families who want lessons to fit inside an existing after-school schedule.",
    instruments: "Guitar, piano, bass, drums, voice, or ukulele, depending on the site's setup.",
    format: "Weekly on-site lesson during after-school hours.",
    progress: "Tracks the standard curriculum pace — one song every 4–6 weeks per student.",
    ctaLabel: "Ask About the After-School Program",
  },
];

// The legal pages at /terms, /privacy and /refunds are deliberately NOT listed
// here yet. They exist and can be read at those URLs, but they are drafts: they
// carry visible "to be completed" blanks and have not been through a lawyer.
// Linking them from every page would present them as the school's actual terms.
//
// Once the blanks are filled and the wording is approved, delete the banner in
// components/LegalPage.js and add these three entries:
//   { label: "Terms", href: "/terms" },
//   { label: "Privacy", href: "/privacy" },
//   { label: "Refunds", href: "/refunds" },
export const footerLinks = [
  { label: "About", href: "/about/philosophy" },
  { label: "Lessons", href: "/song-library" },
  { label: "Teachers", href: "/teachers" },
  { label: "Practice Tools", href: "/tools" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export const footerSocial = [
  { label: "Instagram", icon: "IG", href: "#" },
  { label: "Facebook", icon: "FB", href: "#" },
  { label: "YouTube", icon: "YT", href: "#" },
];
