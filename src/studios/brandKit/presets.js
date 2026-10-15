/**
 * EYAD AI — Visual Identity Studio presets.
 * Curated color palettes and typography options for the Brand Source of Truth.
 * These are static design presets — no API calls, no generation, fully local.
 */

export const COLOR_PALETTES = [
  {
    id: "ocean-blue",
    name: { ar: "أزرق محيطي", en: "Ocean Blue" },
    primary: "#123E9B",
    secondary: "#2B78F6",
    accent: "#8DC7FF",
    surface: "#F0F6FF",
    swatches: ["#123E9B", "#2B78F6", "#8DC7FF", "#F0F6FF"],
  },
  {
    id: "royal-purple",
    name: { ar: "بنفسجي ملكي", en: "Royal Purple" },
    primary: "#4C16C8",
    secondary: "#8A2BE2",
    accent: "#F28AE8",
    surface: "#F8F0FF",
    swatches: ["#4C16C8", "#8A2BE2", "#F28AE8", "#F8F0FF"],
  },
  {
    id: "sunset-warm",
    name: { ar: "غروب دافئ", en: "Sunset Warm" },
    primary: "#D71920",
    secondary: "#FF7A21",
    accent: "#FFD13B",
    surface: "#FFF6E8",
    swatches: ["#D71920", "#FF7A21", "#FFD13B", "#FFF6E8"],
  },
  {
    id: "forest-green",
    name: { ar: "أخضر غابي", en: "Forest Green" },
    primary: "#087A50",
    secondary: "#18B96B",
    accent: "#9AE36B",
    surface: "#F0FBEB",
    swatches: ["#087A50", "#18B96B", "#9AE36B", "#F0FBEB"],
  },
  {
    id: "monochrome",
    name: { ar: "أحادي لون", en: "Monochrome" },
    primary: "#27303A",
    secondary: "#7D8792",
    accent: "#C4CAD2",
    surface: "#F4F6F8",
    swatches: ["#27303A", "#7D8792", "#C4CAD2", "#F4F6F8"],
  },
  {
    id: "earth-tones",
    name: { ar: "ألوان ترابية", en: "Earth Tones" },
    primary: "#70451F",
    secondary: "#B8894E",
    accent: "#F1D3A2",
    surface: "#FBF6EF",
    swatches: ["#70451F", "#B8894E", "#F1D3A2", "#FBF6EF"],
  },
  {
    id: "cyan-sky",
    name: { ar: "سماوي صافي", en: "Cyan Sky" },
    primary: "#087DAA",
    secondary: "#00C7EE",
    accent: "#8BE9FF",
    surface: "#E8F9FF",
    swatches: ["#087DAA", "#00C7EE", "#8BE9FF", "#E8F9FF"],
  },
  {
    id: "navy-gold",
    name: { ar: "كحلي وذهبي", en: "Navy & Gold" },
    primary: "#123B82", secondary: "#D3A53A", accent: "#F5D99B", surface: "#F8F5EE",
    swatches: ["#123B82", "#D3A53A", "#F5D99B", "#F8F5EE"],
  },
  { id: "berry", name: { ar: "توتي فاخر", en: "Luxury Berry" }, primary: "#7A1748", secondary: "#C33D79", accent: "#F2A7C7", surface: "#FFF1F7", swatches: ["#7A1748","#C33D79","#F2A7C7","#FFF1F7"] },
  { id: "teal", name: { ar: "تركواز عصري", en: "Modern Teal" }, primary: "#006B68", secondary: "#11A6A0", accent: "#8BE2DE", surface: "#ECFBFA", swatches: ["#006B68","#11A6A0","#8BE2DE","#ECFBFA"] },
  { id: "coral", name: { ar: "مرجاني ناعم", en: "Soft Coral" }, primary: "#B7433F", secondary: "#E77C6F", accent: "#FFD0C8", surface: "#FFF4F1", swatches: ["#B7433F","#E77C6F","#FFD0C8","#FFF4F1"] },
  { id: "olive", name: { ar: "زيتوني طبيعي", en: "Natural Olive" }, primary: "#52651D", secondary: "#7E9B32", accent: "#C9D98A", surface: "#F5F8E9", swatches: ["#52651D","#7E9B32","#C9D98A","#F5F8E9"] },
];

export const ARABIC_FONTS = [
  { id: "cairo", name: "Cairo", family: "'Cairo', sans-serif", sample: "تصميم العلامة" },
  { id: "tajawal", name: "Tajawal", family: "'Tajawal', sans-serif", sample: "تصميم العلامة" },
  { id: "almarai", name: "Almarai", family: "'Almarai', sans-serif", sample: "تصميم العلامة" },
  { id: "noto-kufi", name: "Noto Kufi Arabic", family: "'Noto Kufi Arabic', sans-serif", sample: "تصميم العلامة" },
  { id: "ibm-plex-arabic", name: "IBM Plex Sans Arabic", family: "'IBM Plex Sans Arabic', sans-serif", sample: "تصميم العلامة" },
  { id: "changa", name: "Changa", family: "'Changa', sans-serif", sample: "تصميم العلامة" },
  { id: "el-messiri", name: "El Messiri", family: "'El Messiri', sans-serif", sample: "تصميم العلامة" },
  { id: "reem-kufi", name: "Reem Kufi", family: "'Reem Kufi', sans-serif", sample: "تصميم العلامة" },
  { id: "rubik-arabic", name: "Rubik Arabic", family: "'Rubik Arabic', sans-serif", sample: "تصميم العلامة" },
  { id: "readex-pro", name: "Readex Pro", family: "'Readex Pro', sans-serif", sample: "تصميم العلامة" },
  { id: "alexandria", name: "Alexandria", family: "'Alexandria', sans-serif", sample: "تصميم العلامة" },
  { id: "marhey", name: "Marhey", family: "'Marhey', sans-serif", sample: "تصميم العلامة" },
];

export const ENGLISH_FONTS = [
  { id: "jakarta", name: "Plus Jakarta Sans", family: "'Plus Jakarta Sans', sans-serif", sample: "Brand Design" },
  { id: "inter", name: "Inter", family: "'Inter', sans-serif", sample: "Brand Design" },
  { id: "poppins", name: "Poppins", family: "'Poppins', sans-serif", sample: "Brand Design" },
  { id: "montserrat", name: "Montserrat", family: "'Montserrat', sans-serif", sample: "Brand Design" },
  { id: "playfair", name: "Playfair Display", family: "'Playfair Display', serif", sample: "Brand Design" },
  { id: "dm-sans", name: "DM Sans", family: "'DM Sans', sans-serif", sample: "Brand Design" },
  { id: "roboto", name: "Roboto", family: "'Roboto', sans-serif", sample: "Brand Design" },
  { id: "lato", name: "Lato", family: "'Lato', sans-serif", sample: "Brand Design" },
  { id: "raleway", name: "Raleway", family: "'Raleway', sans-serif", sample: "Brand Design" },
  { id: "merriweather", name: "Merriweather", family: "'Merriweather', serif", sample: "Brand Design" },
  { id: "manrope", name: "Manrope", family: "'Manrope', sans-serif", sample: "Brand Design" },
  { id: "space-grotesk", name: "Space Grotesk", family: "'Space Grotesk', sans-serif", sample: "Brand Design" },
];

export const BACKGROUNDS = [
  { id: "soft-light", name: { ar: "ضوء ناعم", en: "Soft Light" }, value: "linear-gradient(135deg,#ffffff 0%,#eaf4ff 100%)" },
  { id: "sky-glow", name: { ar: "وهج سماوي", en: "Sky Glow" }, value: "linear-gradient(135deg,#dff7ff 0%,#9bdcff 48%,#dce9ff 100%)" },
  { id: "lavender-mist", name: { ar: "ضباب لافندر", en: "Lavender Mist" }, value: "linear-gradient(135deg,#f7efff 0%,#d9c7ff 52%,#f0e8ff 100%)" },
  { id: "mint-air", name: { ar: "هواء نعناعي", en: "Mint Air" }, value: "linear-gradient(135deg,#effff8 0%,#bcefd8 50%,#e7fff6 100%)" },
  { id: "peach-glow", name: { ar: "وهج خوخي", en: "Peach Glow" }, value: "linear-gradient(135deg,#fff7ef 0%,#ffd7bf 50%,#fff0e7 100%)" },
  { id: "rose-cloud", name: { ar: "سحابة وردية", en: "Rose Cloud" }, value: "linear-gradient(135deg,#fff4f8 0%,#f5c5d9 52%,#ffeaf2 100%)" },
  { id: "golden-paper", name: { ar: "ورق ذهبي", en: "Golden Paper" }, value: "linear-gradient(135deg,#fffdf4 0%,#f4dfaa 52%,#fff8df 100%)" },
  { id: "ice-blue", name: { ar: "جليد أزرق", en: "Ice Blue" }, value: "linear-gradient(135deg,#f8fdff 0%,#cce8f5 50%,#eaf7ff 100%)" },
  { id: "graphite-soft", name: { ar: "جرافيت ناعم", en: "Soft Graphite" }, value: "linear-gradient(135deg,#f7f8fa 0%,#c9ced6 50%,#eef0f3 100%)" },
  { id: "deep-navy", name: { ar: "كحلي هادئ", en: "Calm Navy" }, value: "linear-gradient(135deg,#dce8ff 0%,#9db8eb 50%,#d9e4fb 100%)" },
  { id: "aqua-wave", name: { ar: "موجة مائية", en: "Aqua Wave" }, value: "linear-gradient(135deg,#e8ffff 0%,#9ee7e5 50%,#d9f8ff 100%)" },
  { id: "premium-sand", name: { ar: "رمل فاخر", en: "Premium Sand" }, value: "linear-gradient(135deg,#fffdf8 0%,#e5d3bb 50%,#f9f0e5 100%)" },
];

export const DEFAULT_PALETTE = COLOR_PALETTES[0];
export const DEFAULT_ARABIC_FONT = ARABIC_FONTS[0];
export const DEFAULT_ENGLISH_FONT = ENGLISH_FONTS[0];