"""Sinh ảnh minh hoạ món (SVG tự vẽ) vào public/menu/."""
import os
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "menu")
os.makedirs(OUT, exist_ok=True)

CUP = "M66 62 L174 62 L160 212 Q159 220 151 220 L89 220 Q81 220 80 212 Z"

def wrap(bg, body):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
<rect width="240" height="240" fill="#EFE5D8"/>
<circle cx="120" cy="132" r="96" fill="#FFFCF8" opacity="0.6"/>
<ellipse cx="120" cy="222" rx="62" ry="8" fill="#000" opacity="0.08"/>
{body}
</svg>
'''

def iced(bg, layers, extra="", cream=None, straw="#6B4226"):
    # layers: list of (y_top, color) from top to bottom; liquid starts at y=84
    defs = f'<defs><clipPath id="c"><path d="{CUP}"/></clipPath></defs>'
    liq = ""
    for y, col in layers:
        liq += f'<rect x="60" y="{y}" width="120" height="{230-y}" fill="{col}"/>'
    ice = ""
    if cream is None:
        ice = ('<g fill="#FFFFFF" opacity="0.38">'
               '<rect x="86" y="92" width="26" height="24" rx="6" transform="rotate(-12 99 104)"/>'
               '<rect x="120" y="100" width="28" height="25" rx="6" transform="rotate(10 134 112)"/>'
               '<rect x="96" y="128" width="24" height="22" rx="6" transform="rotate(6 108 139)"/></g>')
    cr = ""
    if cream:
        cr = (f'<path d="M70 70 Q72 44 96 44 Q102 26 120 30 Q138 26 144 44 Q168 44 170 70 Z" fill="{cream}"/>'
              f'<path d="M92 50 Q120 40 148 50" stroke="#FFFFFF" stroke-width="4" fill="none" opacity="0.6" stroke-linecap="round"/>')
    strawsvg = f'<rect x="128" y="18" width="11" height="120" rx="5" fill="{straw}" transform="rotate(14 133 78)"/>'
    return wrap(bg, f'''{defs}
{strawsvg}
<g clip-path="url(#c)">{liq}{ice}{extra}</g>
<path d="{CUP}" fill="none" stroke="#FFFFFF" stroke-width="5" opacity="0.9"/>
<path d="M80 80 L90 196" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" opacity="0.35"/>
{cr}''')

def hot(bg):
    return wrap(bg, '''
<path d="M160 128 Q196 128 192 156 Q188 180 156 176" fill="none" stroke="#E9DCCB" stroke-width="12"/>
<path d="M52 104 L188 104 Q186 196 120 200 Q54 196 52 104 Z" fill="#F2E6D6"/>
<ellipse cx="120" cy="104" rx="68" ry="18" fill="#B98559"/>
<path d="M120 94 Q104 100 110 108 Q120 116 130 108 Q136 100 120 94 Z M120 100 L120 114" fill="#F7EBDD" stroke="#F7EBDD" stroke-width="2"/>
<ellipse cx="120" cy="208" rx="82" ry="12" fill="#E3D3BF"/>
<path d="M98 72 Q90 60 100 50 Q108 40 100 30" stroke="#FFFFFF" stroke-width="5" fill="none" opacity="0.7" stroke-linecap="round"/>
<path d="M130 70 Q122 58 132 48" stroke="#FFFFFF" stroke-width="5" fill="none" opacity="0.6" stroke-linecap="round"/>''')

def slices(color, inner, pts):
    s = ""
    for x, y in pts:
        s += f'<circle cx="{x}" cy="{y}" r="15" fill="{color}"/><circle cx="{x}" cy="{y}" r="10" fill="{inner}"/>'
    return s

def dots(color, pts, r=6):
    return "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}"/>' for x, y in pts)

items = {
  "ca-phe-den-da": iced("#E9D9C6", [(84, "#3A2317")]),
  "ca-phe-sua-da": iced("#EADBC8", [(84, "#7A4B2C"), (190, "#E9D3B3")]),
  "bac-xiu": iced("#EFE3D3", [(84, "#B98559"), (124, "#F1E4D2")]),
  "cold-brew-cam-sa": iced("#F2DCC2", [(84, "#5A2E14")], slices("#F0A04B", "#F8C77E", [(104, 150)]) + '<rect x="132" y="120" width="6" height="80" rx="3" fill="#B5C77A"/>'),
  "latte-nong": hot("#EAD7C2"),
  "tra-dao-cam-sa": iced("#F7E2CC", [(84, "#E89A4C")], slices("#F6B27A", "#FBD3A8", [(102, 150), (138, 176)])),
  "tra-vai-nhai": iced("#F6E3DE", [(84, "#F3C7B8")], dots("#FFFFFF", [(100, 160), (130, 178), (114, 196)], 11)),
  "tra-sen-vang": iced("#F3E7CB", [(84, "#E8C26A")], dots("#F7F0DC", [(104, 166), (132, 182), (116, 198)], 9)),
  "tra-sua-o-long": iced("#EADCCB", [(84, "#C7966B")], dots("#3A2317", [(96, 196), (112, 202), (128, 198), (144, 204), (104, 208), (136, 210)], 7)),
  "cookie-da-xay": iced("#E8DDD2", [(70, "#CDB8A3")], dots("#3A2317", [(96, 110), (130, 130), (110, 160), (146, 168), (100, 190), (124, 200)], 4), cream="#FFF8EE", straw="#3A2317"),
  "matcha-da-xay": iced("#E1E7D2", [(70, "#8DB36A")], "", cream="#FFF8EE", straw="#5E7A42"),
  "chocolate-da-xay": iced("#E7D6C9", [(70, "#6B3A23")], "", cream="#FFF8EE", straw="#C8894D"),
  "croissant-bo": wrap("#F1DFC4", '''
<path d="M40 160 Q60 90 120 86 Q180 90 200 160 Q176 150 164 156 Q150 118 120 116 Q90 118 76 156 Q64 150 40 160 Z" fill="#D9963F"/>
<path d="M76 156 Q90 118 120 116 Q150 118 164 156 Q140 166 120 166 Q100 166 76 156 Z" fill="#E8B060"/>
<path d="M98 120 L104 160 M120 116 L120 166 M142 120 L136 160" stroke="#B87A30" stroke-width="4" stroke-linecap="round"/>
<path d="M62 120 L80 140 M178 120 L160 140" stroke="#B87A30" stroke-width="4" stroke-linecap="round"/>'''),
  "banh-chuoi-nuong": wrap("#EFDCC5", '''
<rect x="52" y="106" width="136" height="90" rx="16" fill="#A8692F"/>
<rect x="60" y="120" width="120" height="70" rx="10" fill="#E6C28A"/>
<ellipse cx="96" cy="152" rx="14" ry="10" fill="#F5E2A8"/><ellipse cx="140" cy="164" rx="14" ry="10" fill="#F5E2A8"/>
<path d="M52 118 Q120 84 188 118" stroke="#7E4A1E" stroke-width="10" fill="none" stroke-linecap="round"/>
<path d="M110 92 Q130 76 150 90" stroke="#F3D36B" stroke-width="10" fill="none" stroke-linecap="round"/>'''),
  "tiramisu": wrap("#ECDDCB", '''
<path d="M56 110 L184 90 L184 190 L56 200 Z" fill="#F6EBDA"/>
<path d="M56 110 L184 90 L184 108 L56 128 Z" fill="#6B3A23"/>
<path d="M56 146 L184 128 L184 142 L56 160 Z" fill="#9A6A43"/>
<path d="M56 180 L184 164 L184 176 L56 192 Z" fill="#9A6A43"/>
<g fill="#3A2317" opacity="0.5"><circle cx="90" cy="110" r="3"/><circle cx="130" cy="102" r="3"/><circle cx="160" cy="98" r="3"/><circle cx="110" cy="114" r="2"/></g>
<path d="M150 70 Q160 56 174 62 Q168 76 150 70 Z" fill="#7C9A5B"/>'''),
}
for name, svg in items.items():
    open(os.path.join(OUT, f"{name}.svg"), "w").write(svg)
print(len(items), "images")
