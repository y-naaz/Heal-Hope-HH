"""
email_service.py — Centralised email helpers for MindWell.

All emails are sent via Gmail SMTP (configured in settings.py).
In development (DEBUG=True) they are printed to the console instead.
"""

import logging
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


# ─── Welcome email ────────────────────────────────────────────────────────────

def send_welcome_email(user):
    """Send a welcome email to a newly registered user."""
    subject = "Welcome to MindWell 💙"
    first_name = user.first_name or "there"

    message = f"""Hi {first_name},

Welcome to MindWell — your personal mental wellness companion!

Here's what you can do right now:
  • Track your daily mood and spot patterns over time
  • Write journal entries to reflect and process your thoughts
  • Set mental wellness goals and celebrate progress
  • Chat with our AI support companion any time

We're so glad you're here. Take it one day at a time. 🌱

— The MindWell Team
"""

    html_message = f"""
<html>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 24px;">
  <h2 style="color: #6c63ff;">Welcome to Heal &amp; Hope 💙</h2>
  <p>Hi <strong>{first_name}</strong>,</p>
  <p>Welcome to <strong>Heal &amp; Hope</strong> — your personal mental wellness companion!</p>
  <p>Here's what you can do right now:</p>
  <ul>
    <li>📊 Track your daily mood and spot patterns over time</li>
    <li>📔 Write journal entries to reflect and process your thoughts</li>
    <li>🎯 Set mental wellness goals and celebrate progress</li>
    <li>💬 Chat with our AI support companion any time</li>
  </ul>
  <p>We're so glad you're here. Take it one day at a time. 🌱</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #888; font-size: 12px;">— The Heal &amp; Hope Team</p>
</body>
</html>
"""

    _send(
        subject=subject,
        message=message,
        html_message=html_message,
        recipient=user.email,
    )


# ─── Goal deadline reminder ───────────────────────────────────────────────────

def send_goal_deadline_reminder(user, goal, days_left):
    """Send a deadline reminder email for a specific goal."""
    first_name = user.first_name or "there"

    if days_left == 0:
        urgency = "today"
    elif days_left == 1:
        urgency = "tomorrow"
    else:
        urgency = f"in {days_left} day{'s' if days_left != 1 else ''}"

    progress_pct = round(goal.progress_percentage)
    subject = f"Goal reminder: \"{goal.title}\" is due {urgency} 🎯"

    message = f"""Hi {first_name},

Just a friendly reminder that your goal "{goal.title}" is due {urgency}.

Progress: {goal.current_value}/{goal.target_value} {goal.unit} ({progress_pct}%)
Deadline: {goal.end_date.strftime('%B %d, %Y')}

{"You're almost there — keep going! 💪" if progress_pct >= 70 else
 "There's still time to make progress. You've got this! 🌟"}

Log in to MindWell to update your progress.

— The MindWell Team
"""

    html_message = f"""
<html>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 24px;">
  <h2 style="color: #6c63ff;">Goal Reminder 🎯</h2>
  <p>Hi <strong>{first_name}</strong>,</p>
  <p>Just a friendly reminder that your goal is due <strong>{urgency}</strong>.</p>
  <div style="background: #f5f5ff; border-left: 4px solid #6c63ff; padding: 16px; border-radius: 4px; margin: 16px 0;">
    <p style="margin: 0; font-size: 18px; font-weight: bold;">{goal.title}</p>
    <p style="margin: 8px 0 0; color: #555;">
      Progress: {goal.current_value}/{goal.target_value} {goal.unit}
      &nbsp;|&nbsp; <strong>{progress_pct}% complete</strong>
    </p>
    <p style="margin: 4px 0 0; color: #777; font-size: 14px;">
      Deadline: {goal.end_date.strftime('%B %d, %Y')}
    </p>
  </div>
  <p>{"You're almost there — keep going! 💪" if progress_pct >= 70 else
     "There's still time to make progress. You've got this! 🌟"}</p>
  <p>Log in to Heal &amp; Hope to update your progress.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #888; font-size: 12px;">— The Heal &amp; Hope Team</p>
</body>
</html>
"""

    _send(
        subject=subject,
        message=message,
        html_message=html_message,
        recipient=user.email,
    )


# ─── Internal helper ──────────────────────────────────────────────────────────

def _send(subject, message, html_message, recipient):
    """Thin wrapper around Django's send_mail with error logging."""
    if not recipient:
        logger.warning("Email skipped — recipient address is empty.")
        return

    from_email = settings.DEFAULT_FROM_EMAIL
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=[recipient],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info("Email '%s' sent to %s", subject, recipient)
    except Exception as exc:
        # Never crash the request because an email failed
        logger.error("Failed to send email '%s' to %s: %s", subject, recipient, exc)
