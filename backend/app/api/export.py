# backend/app/api/export.py - NEW FILE
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from io import BytesIO
from datetime import datetime
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class ExportRequest(BaseModel):
    domain: str
    confidence: float
    insights: List[Dict[str, Any]]
    data_preview: Dict[str, Any]
    domain_scores: Optional[Dict[str, float]] = None
    user_email: Optional[str] = None

@router.post("/export-pdf")
async def export_analysis_pdf(request: ExportRequest):
    """
    Export analysis results as a comprehensive PDF report
    """
    try:
        logger.info(f"📄 Generating PDF export for domain: {request.domain}")
        
        # Create PDF in memory
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18,
        )
        
        # Container for the 'Flowable' objects
        elements = []
        
        # Get styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#7C3AED'),
            spaceAfter=30,
            alignment=TA_CENTER
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#4B5563'),
            spaceAfter=12,
            spaceBefore=12
        )
        
        # Title Page
        elements.append(Spacer(1, 1*inch))
        elements.append(Paragraph("🎵 AUM Data Labs", title_style))
        elements.append(Paragraph("Data Analysis Report", styles['Heading2']))
        elements.append(Spacer(1, 0.5*inch))
        
        # Report Info
        info_data = [
            ['Generated:', datetime.now().strftime('%B %d, %Y at %H:%M')],
            ['Domain:', request.domain.title()],
            ['Confidence:', f"{request.confidence * 100:.1f}%"],
            ['Data Points:', str(request.data_preview.get('total_rows', 0))]
        ]
        
        info_table = Table(info_data, colWidths=[2*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F3F4F6')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1F2937')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB'))
        ]))
        
        elements.append(info_table)
        elements.append(PageBreak())
        
        # Domain Detection Section
        elements.append(Paragraph("Domain Detection", heading_style))
        elements.append(Spacer(1, 0.2*inch))
        
        domain_text = f"""
        <b>Detected Domain:</b> {request.domain.title()}<br/>
        <b>Confidence Score:</b> {request.confidence * 100:.1f}%<br/>
        <b>Status:</b> {'High Confidence ✓' if request.confidence > 0.7 else 'Medium Confidence' if request.confidence > 0.4 else 'Low Confidence'}
        """
        elements.append(Paragraph(domain_text, styles['BodyText']))
        elements.append(Spacer(1, 0.3*inch))
        
        # Domain Scores Table
        if request.domain_scores:
            elements.append(Paragraph("All Domain Scores", styles['Heading3']))
            elements.append(Spacer(1, 0.1*inch))
            
            score_data = [['Domain', 'Score', 'Confidence']]
            sorted_scores = sorted(
                request.domain_scores.items(),
                key=lambda x: x[1],
                reverse=True
            )
            
            for domain, score in sorted_scores[:5]:
                total = sum(request.domain_scores.values())
                pct = (score / total * 100) if total > 0 else 0
                score_data.append([
                    domain.title(),
                    f"{score:.1f}",
                    f"{pct:.1f}%"
                ])
            
            score_table = Table(score_data, colWidths=[2*inch, 1.5*inch, 1.5*inch])
            score_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7C3AED')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F9FAFB')),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB'))
            ]))
            
            elements.append(score_table)
            elements.append(Spacer(1, 0.3*inch))
        
        # Key Insights Section
        if request.insights and len(request.insights) > 0:
            elements.append(PageBreak())
            elements.append(Paragraph("Key Insights", heading_style))
            elements.append(Spacer(1, 0.2*inch))
            
            for idx, insight in enumerate(request.insights[:10], 1):
                insight_text = insight.get('insight') or insight.get('description', 'No description')
                insight_type = insight.get('type', 'general')
                
                # Add bullet point with insight
                bullet_style = ParagraphStyle(
                    'Bullet',
                    parent=styles['BodyText'],
                    leftIndent=20,
                    bulletIndent=10
                )
                
                elements.append(Paragraph(
                    f"<b>{idx}.</b> {insight_text}",
                    bullet_style
                ))
                elements.append(Spacer(1, 0.15*inch))
        
        # Data Preview Section
        elements.append(PageBreak())
        elements.append(Paragraph("Data Preview", heading_style))
        elements.append(Spacer(1, 0.2*inch))
        
        data_summary = f"""
        <b>Total Rows:</b> {request.data_preview.get('total_rows', 0)}<br/>
        <b>Total Columns:</b> {len(request.data_preview.get('columns', []))}<br/>
        """
        elements.append(Paragraph(data_summary, styles['BodyText']))
        elements.append(Spacer(1, 0.2*inch))
        
        # Column list
        columns = request.data_preview.get('columns', [])
        if columns:
            elements.append(Paragraph("Columns:", styles['Heading3']))
            col_chunks = [columns[i:i+3] for i in range(0, len(columns), 3)]
            
            for chunk in col_chunks[:10]:  # Limit to first 30 columns
                col_text = " • ".join(chunk)
                elements.append(Paragraph(col_text, styles['BodyText']))
        
        # Data sample table
        elements.append(Spacer(1, 0.3*inch))
        elements.append(Paragraph("Sample Data (First 10 Rows):", styles['Heading3']))
        elements.append(Spacer(1, 0.1*inch))
        
        data_rows = request.data_preview.get('data', [])
        if data_rows and columns:
            # Limit columns to fit page
            display_cols = columns[:6]
            
            table_data = [display_cols]
            for row in data_rows[:10]:
                row_data = [str(row.get(col, ''))[:30] for col in display_cols]
                table_data.append(row_data)
            
            col_widths = [6.5*inch / len(display_cols)] * len(display_cols)
            data_table = Table(table_data, colWidths=col_widths)
            data_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7C3AED')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F9FAFB')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP')
            ]))
            
            elements.append(data_table)
        
        # Footer
        elements.append(PageBreak())
        elements.append(Spacer(1, 2*inch))
        
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#6B7280'),
            alignment=TA_CENTER
        )
        
        footer_text = """
        <b>Generated by AUM Data Labs</b><br/>
        The Sound of Data Understanding<br/>
        https://aumdatalabs.com
        """
        elements.append(Paragraph(footer_text, footer_style))
        
        # Build PDF
        doc.build(elements)
        
        # Get PDF data
        buffer.seek(0)
        pdf_data = buffer.getvalue()
        buffer.close()
        
        # Return as streaming response
        filename = f"aum_analysis_{request.domain}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        logger.info(f"✅ PDF generated successfully: {len(pdf_data)} bytes")
        
        return StreamingResponse(
            BytesIO(pdf_data),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    
    except Exception as e:
        logger.exception(f"❌ PDF generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

@router.get("/health")
async def export_health():
    """Check export service health"""
    return {
        "status": "healthy",
        "service": "export",
        "formats": ["pdf"]
    }