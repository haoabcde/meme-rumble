"""Render the research with the installed hv-analysis template and local print fixes."""
import html
import importlib.util
import os
from pathlib import Path

from weasyprint import HTML

folder = Path(__file__).resolve().parent
skill_dir = Path(os.environ.get("HV_SKILL_DIR", Path.home() / ".codex/skills/hv-analysis"))
spec = importlib.util.spec_from_file_location("hv_template", skill_dir / "scripts/md_to_pdf.py")
template = importlib.util.module_from_spec(spec)
spec.loader.exec_module(template)
stem = "梗角色大乱斗玩法扩展_横纵分析报告"
markdown, meta = template.split_meta((folder / (stem + ".md")).read_text())
document = template.md_to_html(markdown, meta_line=meta)
css = (folder / "report-print.css").read_text()
document = document.replace("</head>", "<title>" + html.escape(stem) + "</title><style>" + css + "</style></head>")
document = "\n".join(line.rstrip() for line in document.splitlines()) + "\n"
(folder / (stem + ".html")).write_text(document)
HTML(string=document, base_url=str(folder)).write_pdf(folder / (stem + ".pdf"))
print("Generated HTML and PDF: " + stem)
