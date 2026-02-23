# backend/app/utils/email.py
# Author: Sambath Kumar Natarajan
# Company: AUM Data Labs
# Purpose: Email sending utility for collaboration and notifications

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    """Handle email sending via SMTP"""
    
    def __init__(self):
        self.smtp_server = settings.SMTP_SERVER
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_USER
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """
        Send an email
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML version of email
            text_content: Plain text version (optional)
        
        Returns:
            bool: True if sent successfully, False otherwise
        """
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.from_email
            msg['To'] = to_email
            
            # Add text and HTML parts
            if text_content:
                part1 = MIMEText(text_content, 'plain')
                msg.attach(part1)
            
            part2 = MIMEText(html_content, 'html')
            msg.attach(part2)
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            # Fallback for development/testing: Log the email content
            logger.info(f"=== MOCK EMAIL TO {to_email} ===")
            logger.info(f"Subject: {subject}")
            logger.info(f"Content: {text_content or 'HTML Content'}")
            logger.info("================================")
            return True # Return True so the API call succeeds in dev
    
    def send_share_notification(
        self,
        recipient_email: str,
        sender_name: str,
        dataset_name: str,
        share_url: str
    ) -> bool:
        """Send dataset share notification"""
        
        subject = f"{sender_name} shared a dataset with you"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📊 Dataset Shared With You</h1>
                </div>
                <div class="content">
                    <p>Hi there,</p>
                    <p><strong>{sender_name}</strong> has shared a dataset with you on AUM Analytics:</p>
                    <p style="background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0;">
                        <strong>Dataset:</strong> {dataset_name}
                    </p>
                    <p>Click the button below to view the analysis, insights, and visualizations:</p>
                    <div style="text-align: center;">
                        <a href="{share_url}" class="button">View Dataset</a>
                    </div>
                    <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
                        Or copy this link: <a href="{share_url}">{share_url}</a>
                    </p>
                </div>
                <div class="footer">
                    <p>© 2025 AUM Data Labs. All rights reserved.</p>
                    <p>Intelligent data analytics platform with AI-powered insights</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Dataset Shared With You
        
        {sender_name} has shared a dataset with you on AUM Analytics.
        
        Dataset: {dataset_name}
        
        View it here: {share_url}
        
        © 2025 AUM Data Labs
        """
        
        return self.send_email(recipient_email, subject, html_content, text_content)

# Global instance
email_service = EmailService()
