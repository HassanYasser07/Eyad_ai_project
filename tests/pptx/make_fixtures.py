"""Generates PPTX fixtures for the editor tests. Requires: python-pptx, Pillow.
NOTE: these are synthetic files built with python-pptx, not decks authored in
PowerPoint/Keynote/Google Slides. Run: python3 tests/pptx/make_fixtures.py"""
import io, os
from PIL import Image, ImageDraw
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE
from pptx.enum.text import PP_ALIGN

OUT = os.path.join(os.path.dirname(__file__), "fixtures")

def png(color, label, size=(400, 300)):
    im = Image.new("RGB", size, color); d = ImageDraw.Draw(im)
    d.rectangle([4, 4, size[0]-5, size[1]-5], outline=(255, 255, 255), width=6)
    d.text((20, 20), label, fill=(255, 255, 255))
    b = io.BytesIO(); im.save(b, "PNG"); b.seek(0); return b

def widescreen(prs): prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)

# 1 simple: placeholders (inherit geometry from layout) + shapes + textbox, 16:9
p = Presentation(); widescreen(p)
s = p.slides.add_slide(p.slide_layouts[1])
s.shapes.title.text = "Quarterly Review"
body = s.placeholders[1].text_frame; body.text = "Revenue grew 24%"
for t in ("Costs held flat", "Two launches shipped"):
    body.add_paragraph().text = t
tb = s.shapes.add_textbox(Inches(1), Inches(5.6), Inches(6), Inches(1)); r = tb.text_frame.paragraphs[0].add_run()
r.text = "Custom textbox"; r.font.size = Pt(28); r.font.bold = True; r.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)
sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8), Inches(5.4), Inches(4), Inches(1.4))
sh.fill.solid(); sh.fill.fore_color.rgb = RGBColor(0xF5, 0x9E, 0x0B); sh.text_frame.text = "Shape text"
s2 = p.slides.add_slide(p.slide_layouts[5]); s2.shapes.title.text = "Second slide"
p.save(f"{OUT}/simple.pptx")

# 2 overlap: overlapping images, rotated shapes, flips, group — the selection-overlay stress test
p = Presentation(); widescreen(p)
s = p.slides.add_slide(p.slide_layouts[6])
s.shapes.add_picture(png((200, 60, 60), "IMG-A"), Inches(1), Inches(1), Inches(5), Inches(3.75))
s.shapes.add_picture(png((40, 120, 200), "IMG-B"), Inches(3), Inches(2), Inches(5), Inches(3.75))
s.shapes.add_picture(png((40, 160, 90), "IMG-C"), Inches(5), Inches(3), Inches(5), Inches(3.75))
rot = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(9), Inches(1), Inches(3), Inches(1.5)); rot.rotation = 30
rot.fill.solid(); rot.fill.fore_color.rgb = RGBColor(0x8B, 0x5C, 0xF6); rot.text_frame.text = "Rotated 30"
ell = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(9.5), Inches(2.4), Inches(3), Inches(2)); ell.fill.solid(); ell.fill.fore_color.rgb = RGBColor(0xEF, 0x44, 0x44)
grp = s.shapes.add_group_shape()
a = grp.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(9), Inches(5), Inches(1.5), Inches(1)); b = grp.shapes.add_shape(MSO_SHAPE.OVAL, Inches(10.8), Inches(5.2), Inches(1.5), Inches(1))
a.fill.solid(); a.fill.fore_color.rgb = RGBColor(0x10, 0xB9, 0x81); b.fill.solid(); b.fill.fore_color.rgb = RGBColor(0x06, 0x4E, 0x3B)
p.save(f"{OUT}/overlap.pptx")

# 3 table + chart
p = Presentation(); widescreen(p)
s = p.slides.add_slide(p.slide_layouts[5]); s.shapes.title.text = "Table and chart"
gf = s.shapes.add_table(3, 3, Inches(0.7), Inches(1.8), Inches(6), Inches(2.4)); t = gf.table
for r_, row in enumerate([("Region", "Q1", "Q2"), ("EMEA", "10", "14"), ("APAC", "8", "12")]):
    for c_, v in enumerate(row): t.cell(r_, c_).text = v
cd = CategoryChartData(); cd.categories = ["Q1", "Q2", "Q3"]; cd.add_series("Sales", (19, 24, 31))
s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(7.2), Inches(1.8), Inches(5.5), Inches(4), cd)
p.save(f"{OUT}/table_chart.pptx")

# 4 4:3 deck (python-pptx default 10x7.5in), text-heavy with mixed formatting + two fonts + bullets
p = Presentation()
s = p.slides.add_slide(p.slide_layouts[1]); s.shapes.title.text = "Text-heavy 4:3"
tf = s.placeholders[1].text_frame; tf.clear()
for i in range(7):
    para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
    r1 = para.add_run(); r1.text = f"Point {i+1}: "; r1.font.bold = True; r1.font.name = "Georgia"
    r2 = para.add_run(); r2.text = "some regular detail text that is long enough to wrap onto more than one line in the body"; r2.font.italic = (i % 2 == 0)
    para.alignment = PP_ALIGN.LEFT
s = p.slides.add_slide(p.slide_layouts[6])
tb = s.shapes.add_textbox(Inches(1), Inches(1), Inches(8), Inches(2)); tf = tb.text_frame; tf.word_wrap = True
tf.text = "Right aligned underlined"; tf.paragraphs[0].alignment = PP_ALIGN.RIGHT; tf.paragraphs[0].runs[0].font.underline = True; tf.paragraphs[0].runs[0].font.name = "Courier New"
p.save(f"{OUT}/text_heavy_4x3.pptx")

# 5 many slides (reorder/delete/duplicate behaviour) incl. hyperlink
p = Presentation(); widescreen(p)
for i in range(8):
    s = p.slides.add_slide(p.slide_layouts[5]); s.shapes.title.text = f"Slide {i+1}"
    if i == 2:
        tb = s.shapes.add_textbox(Inches(1), Inches(3), Inches(6), Inches(1)); r = tb.text_frame.paragraphs[0].add_run(); r.text = "link"; r.hyperlink.address = "https://example.com"
p.save(f"{OUT}/many_slides.pptx")
print("ok", os.listdir(OUT))
