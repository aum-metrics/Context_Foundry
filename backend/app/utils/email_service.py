"""
Transactional Email Service
Provides abstractions for sending core platform emails.
Fails softly into a mock logger if SMTP/Resend credentials are not configured.
"""
import logging
import os

logger = logging.getLogger(__name__)

async def send_invite_email(to_email: str, invite_url: str, org_name: str, inviter_name: str = "A Colleague"):
    """
    Dispatches a secure workspace invite email via the configured provider.
    Falls back to a console logger for local development / missing keys.
    """
    smtp_key = os.getenv("SMTP_SEND_KEY")
    resend_key = os.getenv("RESEND_API_KEY")

    subject = f"{inviter_name} invited you to join {org_name} on Context Foundry"
    
    html_content = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited!</h2>
        <p><strong>{inviter_name}</strong> has invited you to join the <strong>{org_name}</strong> workspace on AUM Context Foundry.</p>
        <p>Click the secure link below to accept your invitation and join the team:</p>
        <div style="margin: 30px 0;">
            <a href="{invite_url}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept Invitation</a>
        </div>
        <p style="color: #666; font-size: 14px;">This invitation link will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin-top: 40px;" />
        <p style="color: #999; font-size: 12px;">AUM Context Foundry Enterprise Platform</p>
    </div>
    """

    if resend_key:
        try:
            import resend
            resend.api_key = resend_key
            r = resend.Emails.send({
                "from": "AUM Context Foundry <invites@aum-metrics.com>",
                "to": to_email,
                "subject": subject,
                "html": html_content
            })
            logger.info(f"📧 Resend invite dispatched to {to_email} (ID: {r.get('id')})")
            return True
        except Exception as e:
            logger.error(f"Failed to send invite via Resend: {e}")
            # Fall through to mock
    elif smtp_key:
        # SMTP logic would go here
        pass
        
    # Mock Fallback for local dev/missing config (Soft Failure)
    logger.info("================== MOCK EMAIL DISPATCH ==================")
    logger.info(f"To: {to_email}")
    logger.info(f"Subject: {subject}")
    logger.info(f"Link: {invite_url}")
    logger.info("=========================================================")
    return True
