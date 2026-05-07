"""
Management command: send_goal_reminders

Finds active goals whose deadline is in 1, 3, or 7 days and sends
a reminder email to the owner.

Usage:
    python manage.py send_goal_reminders

Schedule on Render (render.yaml cron job) to run once a day.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from dashboard.models import Goal
from email_service import send_goal_deadline_reminder


# How many days before the deadline we send a reminder
REMINDER_DAYS = [7, 3, 1, 0]


class Command(BaseCommand):
    help = "Send goal deadline reminder emails to users."

    def handle(self, *args, **options):
        today = timezone.now().date()
        sent = 0
        skipped = 0

        for days_left in REMINDER_DAYS:
            target_date = today + timedelta(days=days_left)
            goals = Goal.objects.filter(
                status='active',
                end_date=target_date,
                reminders=True,
            ).select_related('user')

            for goal in goals:
                user = goal.user
                if not user.email:
                    skipped += 1
                    continue
                try:
                    send_goal_deadline_reminder(user, goal, days_left)
                    sent += 1
                except Exception as exc:
                    self.stderr.write(
                        f"Failed to send reminder for goal {goal.id} "
                        f"(user {user.email}): {exc}"
                    )
                    skipped += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Goal reminders done. Sent: {sent}, Skipped/failed: {skipped}"
            )
        )
