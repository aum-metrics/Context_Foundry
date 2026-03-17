"""
backend/app/core/email_sender.py

FIX 3c: White-label break — invite emails sent from aum-metrics.com / AUM branding.
         White-label client's users see "AUM Context Foundry" in their inbox.

DEPLOY:
  1. Copy this file to: backend/app/core/email_sender.py
  2. In workspaces.py (invite flow), replace:
       import resend; resend.Emails.send({...})
     with:
       from core.email_sender import send_invite_email
       send_invite_email(org_id, to_email, invite_link, inviter_name)
  3. Set env vars per the SENDGRID section below.

TENANT EMAIL ARCHITECTURE:
  - AUM uses its own SendGrid account + domain (aum-metrics.com)
  - Each white-label tenant gets a SendGrid Sub-User (free, same account)
  - Sub-User sends from tenant's domain (e.g. noreply@clientbrand.com)
  - DKIM/SPF is set up once per tenant domain via SendGrid

  Firestore path to tenant email config:
    organizations/{org_id}.tenantConfig.email = {
      "fromName":    "ClientBrand",
      "fromEmail":   "noreply@clientbrand.com",
      "sendgridKey": "SG.xxxx",    // sub-user API key — store encrypted or in Secret Manager
      "replyTo":     "support@clientbrand.com"
    }

  For tenants without custom email config, falls back to AUM's sender.
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


# ─── Tenant email config ──────────────────────────────────────────────────────

class TenantEmailConfig:
    __slots__ = ("from_name", "from_email", "sendgrid_key", "reply_to")

    def __init__(self, from_name: str, from_email: str, sendgrid_key: str, reply_to: str):
        self.from_name    = from_name
        self.from_email   = from_email
        self.sendgrid_key = sendgrid_key
        self.reply_to     = reply_to


async def _get_tenant_email_config(org_id: str) -> Optional[TenantEmailConfig]:
    """
    Reads tenant email config from Firestore org doc.
    Returns None if org is not white-labeled or config is incomplete.
    """
    if not org_id:
        return None
    try:
        from core.firebase_config import db
        if not db:
            return None
        # Use simple get() for now as firebase-admin is sync, 
        # but the wrapper function is async to allow later async client migration
        org_doc = db.collection("organizations").document(org_id).get()
        if not org_doc.exists:
            return None
        data = org_doc.to_dict() or {}
        email_cfg = (data.get("tenantConfig") or {}).get("email") or {}

        from_email   = email_cfg.get("fromEmail", "")
        sg_key       = email_cfg.get("sendgridKey", "")
        from_name    = email_cfg.get("fromName", "")
        reply_to     = email_cfg.get("replyTo", from_email)

        if not (from_email and sg_key and from_name):
            return None

        return TenantEmailConfig(
            from_name=from_name,
            from_email=from_email,
            sendgrid_key=sg_key,
            reply_to=reply_to,
        )
    except Exception as e:
        logger.warning(f"Failed to fetch tenant email config for org {org_id}: {e}")
        return None


# ─── AUM default config ───────────────────────────────────────────────────────

def _aum_config() -> TenantEmailConfig:
    return TenantEmailConfig(
        from_name="AUM Context Foundry",
        from_email=os.getenv("EMAIL_FROM_ADDRESS", "hello@aumcontextfoundry.com"),
        sendgrid_key=os.getenv("SENDGRID_API_KEY", ""),
        reply_to=os.getenv("EMAIL_REPLY_TO", "hello@aumcontextfoundry.com"),
    )


# ─── Core send function ───────────────────────────────────────────────────────

async def send_invite_email(
    org_id: str,
    to_email: str,
    invite_link: str,
    inviter_name: str,
    org_name: str = "",
) -> bool:
    """
    Sends a team invite email using the correct sender for the org.
    
    For white-label tenants: sends from their domain via their SendGrid sub-key.
    For AUM orgs:            sends from aum-metrics.com via AUM's SendGrid key.
    
    Returns True on success, False on failure.
    """
    # Pick tenant config or fall back to AUM
    tenant = await _get_tenant_email_config(org_id)
    cfg = tenant if tenant else _aum_config()

    if not cfg.sendgrid_key:
        logger.error("No SendGrid API key configured — cannot send invite email")
        return False

    brand  = cfg.from_name
    subject = f"You've been invited to {brand}"

    html_body = _invite_html(
        brand_name=brand,
        inviter_name=inviter_name,
        org_name=org_name or brand,
        invite_link=invite_link,
        from_email=cfg.from_email,
        primary_color="#4f46e5",
    )

    try:
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {cfg.sendgrid_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [{"to": [{"email": to_email}]}],
                    "from": {"name": cfg.from_name, "email": cfg.from_email},
                    "reply_to": {"email": cfg.reply_to},
                    "subject": subject,
                    "content": [{"type": "text/html", "value": html_body}],
                },
            )
            if resp.status_code in (200, 202):
                logger.info(f"Invite email sent: to={to_email}, from={cfg.from_email}, org={org_id}")
                return True
            else:
                logger.error(f"SendGrid error {resp.status_code}: {resp.text[:200]}")
                return False

    except Exception as e:
        logger.error(f"Failed to send invite email to {to_email}: {e}")
        return False


async def send_generic_email(
    org_id: str,
    to_email: str,
    subject: str,
    html_body: str,
) -> bool:
    """
    Generic tenant-aware email send. 
    """
    tenant = await _get_tenant_email_config(org_id)
    cfg = tenant if tenant else _aum_config()

    if not cfg.sendgrid_key:
        logger.error("No SendGrid API key — cannot send email")
        return False

    try:
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {cfg.sendgrid_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [{"to": [{"email": to_email}]}],
                    "from": {"name": cfg.from_name, "email": cfg.from_email},
                    "reply_to": {"email": cfg.reply_to},
                    "subject": subject,
                    "content": [{"type": "text/html", "value": html_body}],
                },
            )
            return resp.status_code in (200, 202)
    except Exception as e:
        logger.error(f"send_generic_email failed: {e}")
        return False


# ─── Email template ───────────────────────────────────────────────────────────

def _invite_html(
    brand_name: str,
    inviter_name: str,
    org_name: str,
    invite_link: str,
    from_email: str,
    primary_color: str = "#4f46e5",
) -> str:
    """Minimal, clean invite email template. Uses inline styles for email clients."""
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:{primary_color};padding:32px 40px;">
            <p style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">{brand_name}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;color:#0f172a;font-size:24px;font-weight:700;line-height:1.3;">You're invited to {org_name}</p>
            <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
              <strong style="color:#0f172a;">{inviter_name}</strong> has invited you to join their {brand_name} workspace.
            </p>
            <a href="{invite_link}"
               style="display:inline-block;background:{primary_color};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:10px;letter-spacing:-0.1px;">
              Accept invitation →
            </a>
            <p style="margin:28px 0 0;color:#94a3b8;font-size:13px;line-height:1.5;">
              This invitation expires in 7 days. If you weren't expecting this, you can safely ignore it.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f1f5f9;background:#f8fafc;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              Sent by {brand_name} · <a href="mailto:{from_email}" style="color:#94a3b8;">{from_email}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
