from datetime import date

from django.core.management.base import BaseCommand, CommandError

from fees.billing import generate_for_month


class Command(BaseCommand):
    help = "Create this month's fee challans (or a given month, e.g. --month 2026-11). Safe to run again."

    def add_arguments(self, parser):
        parser.add_argument("--month", help="YYYY-MM (default: this month)")

    def handle(self, *args, **options):
        raw = options.get("month")
        try:
            target = date(*(int(x) for x in raw.split("-")), 1) if raw else date.today()
        except (TypeError, ValueError):
            raise CommandError("Use --month like 2026-11")
        result = generate_for_month(target)
        self.stdout.write(f"{result['month']}: {result['created']} challans created, {result['skipped_no_fee']} skipped (no fee set)")
