"""
Email service using SMTP (Gmail App Password).
All templates are professional responsive HTML.
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from config import Config


def _send(to: str, subject: str, html_body: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"TaskHub <{Config.SMTP_USER}>"
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(Config.SMTP_USER, Config.SMTP_APP_PASSWORD)
        server.sendmail(Config.SMTP_USER, to, msg.as_string())


# ── HTML Template Shell ────────────────────────────────────────────────────────
def _wrap(title: str, body: str) -> str:
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#111118;border:1px solid #27272a;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6d28d9,#3b82f6);padding:32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
                📷 TaskHub
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">
                AI Product Photography Studio
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">
              {body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#09090b;padding:24px 32px;text-align:center;
                       border-top:1px solid #27272a;">
              <p style="margin:0;color:#52525b;font-size:12px;">
                © 2025 TaskHub · AI Product Photography Studio<br/>
                You received this email because you have an active TaskHub account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


# ── Email Senders ──────────────────────────────────────────────────────────────
def send_task_assigned(
    to: str,
    user_name: str,
    task_title: str,
    task_description: str,
    task_id: str,
    frontend_url: str,
) -> None:
    task_link = f"{frontend_url}/dashboard/task/{task_id}"
    body = f"""
      <h2 style="margin:0 0 8px;color:#fafafa;font-size:22px;font-weight:600;">
        New Task Assigned 🎯
      </h2>
      <p style="margin:0 0 24px;color:#a1a1aa;font-size:15px;line-height:1.6;">
        Hi <strong style="color:#fafafa;">{user_name}</strong>, a new product photography task
        has been assigned to you. Please open it in the AI Studio to get started.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#18181b;border:1px solid #3f3f46;border-radius:12px;overflow:hidden;margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:1px;">TASK</p>
            <h3 style="margin:0 0 8px;color:#fafafa;font-size:18px;">{task_title}</h3>
            <p style="margin:0;color:#a1a1aa;font-size:14px;line-height:1.5;">{task_description}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 20px;">
            <p style="margin:0;color:#71717a;font-size:13px;">
              🖼️ <strong>8 Images Required</strong>: 1 white bg · 2 theme · 2 creative · 3 model angles
            </p>
          </td>
        </tr>
      </table>

      <a href="{task_link}"
         style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);
                color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;
                font-weight:600;font-size:15px;letter-spacing:0.3px;">
        Open in AI Studio →
      </a>
    """
    send_task_assigned.__doc__
    _send(to, f"New Task Assigned: {task_title}", _wrap(f"New Task: {task_title}", body))


def send_task_submitted(
    to: str,
    admin_name: str,
    task_title: str,
    user_name: str,
    task_id: str,
    frontend_url: str,
) -> None:
    review_link = f"{frontend_url}/admin/tasks/{task_id}"
    body = f"""
      <h2 style="margin:0 0 8px;color:#fafafa;font-size:22px;font-weight:600;">
        Task Submitted for Review ✅
      </h2>
      <p style="margin:0 0 24px;color:#a1a1aa;font-size:15px;line-height:1.6;">
        Hi <strong style="color:#fafafa;">{admin_name}</strong>,
        <strong style="color:#8b5cf6;">{user_name}</strong> has completed and submitted
        all 8 AI-generated images for the following task. Please review and accept or
        request revisions.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#18181b;border:1px solid #3f3f46;border-radius:12px;margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;">TASK</p>
            <h3 style="margin:0 0 4px;color:#fafafa;font-size:18px;">{task_title}</h3>
            <p style="margin:0;color:#22c55e;font-size:14px;font-weight:600;">● Submitted · Ready for Review</p>
          </td>
        </tr>
      </table>

      <a href="{review_link}"
         style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);
                color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;
                font-weight:600;font-size:15px;">
        Review Submission →
      </a>
    """
    _send(to, f"Task Completed: {task_title} by {user_name}", _wrap("Task Submitted", body))


def send_task_accepted(
    to: str,
    user_name: str,
    task_title: str,
    feedback: str,
    frontend_url: str,
) -> None:
    dashboard_link = f"{frontend_url}/dashboard"
    body = f"""
      <h2 style="margin:0 0 8px;color:#fafafa;font-size:22px;font-weight:600;">
        Task Accepted! 🎉
      </h2>
      <p style="margin:0 0 24px;color:#a1a1aa;font-size:15px;line-height:1.6;">
        Hi <strong style="color:#fafafa;">{user_name}</strong>, great news!
        Your submission for <strong style="color:#8b5cf6;">{task_title}</strong>
        has been reviewed and <strong style="color:#22c55e;">accepted</strong>.
      </p>

      {f'''<table width="100%" cellpadding="0" cellspacing="0"
             style="background:#18181b;border-left:3px solid #22c55e;border-radius:0 8px 8px 0;margin-bottom:24px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;">ADMIN FEEDBACK</p>
            <p style="margin:0;color:#d4d4d8;font-size:14px;line-height:1.6;">{feedback}</p>
          </td>
        </tr>
      </table>''' if feedback else ''}

      <a href="{dashboard_link}"
         style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);
                color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;
                font-weight:600;font-size:15px;">
        View Dashboard →
      </a>
    """
    _send(to, f"Task Accepted: {task_title}", _wrap("Task Accepted", body))


def send_revision_requested(
    to: str,
    user_name: str,
    task_title: str,
    revision_notes: str,
    task_id: str,
    frontend_url: str,
) -> None:
    task_link = f"{frontend_url}/dashboard/task/{task_id}"
    body = f"""
      <h2 style="margin:0 0 8px;color:#fafafa;font-size:22px;font-weight:600;">
        Revision Requested 🔄
      </h2>
      <p style="margin:0 0 24px;color:#a1a1aa;font-size:15px;line-height:1.6;">
        Hi <strong style="color:#fafafa;">{user_name}</strong>, the admin has requested
        some revisions on <strong style="color:#8b5cf6;">{task_title}</strong>.
        Please review the notes below and re-generate the required images.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#18181b;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;margin-bottom:24px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;">REVISION NOTES</p>
            <p style="margin:0;color:#d4d4d8;font-size:14px;line-height:1.6;">{revision_notes}</p>
          </td>
        </tr>
      </table>

      <a href="{task_link}"
         style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);
                color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;
                font-weight:600;font-size:15px;">
        Revise in AI Studio →
      </a>
    """
    _send(to, f"Revision Requested: {task_title}", _wrap("Revision Requested", body))
