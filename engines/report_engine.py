# engines/report_engine.py
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from datetime import datetime
import io
import pandas as pd

class PDFReportGenerator:
    @staticmethod
    def generate_report(domain: str, insights: list, result_df: pd.DataFrame, config: dict, user_email: str) -> bytes:
        try:
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36,leftMargin=36, topMargin=36,bottomMargin=36)
            styles = getSampleStyleSheet()
            elems = []
            title_style = ParagraphStyle('title', parent=styles['Heading1'], fontSize=20, alignment=1)
            elems.append(Paragraph(f"{config.get('icon','')} AUM Studio Report", title_style))
            elems.append(Spacer(1,12))
            meta = f"Domain: {domain.title()} • Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} • User: {user_email}"
            elems.append(Paragraph(meta, styles['Normal']))
            elems.append(Spacer(1,12))
            elems.append(Paragraph("Executive Summary", styles['Heading2']))
            elems.append(Paragraph(f"{len(insights)} insights generated.", styles['Normal']))
            elems.append(Spacer(1,12))
            elems.append(Paragraph("Top Insights", styles['Heading2']))
            for ins in insights[:10]:
                elems.append(Paragraph(f"<b>[{ins['severity']}] {ins['title']}</b>", styles['Normal']))
                elems.append(Paragraph(f"Impact: {ins['impact']}", styles['Normal']))
                elems.append(Paragraph(f"Action: {ins['action']}", styles['Normal']))
                elems.append(Spacer(1,6))
            if result_df is not None and not result_df.empty:
                elems.append(PageBreak())
                elems.append(Paragraph("Sample Data", styles['Heading2']))
                table_data = [list(result_df.columns)]
                for _, row in result_df.head(10).iterrows():
                    table_data.append([str(x)[:40] for x in row.tolist()])
                t = Table(table_data)
                t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor(config.get('color','#6C757D'))),('TEXTCOLOR',(0,0),(-1,0),colors.whitesmoke),('GRID',(0,0),(-1,-1),0.5,colors.grey)]))
                elems.append(t)
            doc.build(elems)
            pdf = buffer.getvalue(); buffer.close()
            return pdf
        except Exception as e:
            return None
