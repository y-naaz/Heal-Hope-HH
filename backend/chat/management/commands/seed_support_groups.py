from django.core.management.base import BaseCommand
from chat.models import SupportGroup

DEFAULT_GROUPS = [
    {
        'name': 'Anxiety Support Circle',
        'description': 'A safe space to share experiences and coping strategies for anxiety',
        'group_type': 'open',
        'format_type': 'online',
        'schedule_day': 'Tuesdays',
        'schedule_time': '7 PM',
    },
    {
        'name': 'Depression Recovery Hub',
        'description': 'Supportive community for those working through depression',
        'group_type': 'moderated',
        'format_type': 'hybrid',
        'schedule_day': 'Thursdays',
        'schedule_time': '6 PM',
    },
    {
        'name': 'Young Adults Circle',
        'description': 'Mental health support for ages 18-25',
        'group_type': 'age_specific',
        'format_type': 'online',
        'schedule_day': 'Saturdays',
        'schedule_time': '2 PM',
    },
]


class Command(BaseCommand):
    help = 'Seed the three default support groups (idempotent)'

    def handle(self, *args, **kwargs):
        for data in DEFAULT_GROUPS:
            obj, created = SupportGroup.objects.get_or_create(
                name=data['name'],
                defaults=data,
            )
            action = 'Created' if created else 'Already exists'
            self.stdout.write(f'{action}: {obj.name}')
        self.stdout.write(self.style.SUCCESS('Done.'))
