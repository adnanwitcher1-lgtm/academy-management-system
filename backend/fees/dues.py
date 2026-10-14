from datetime import date

from django.db import transaction
from django.db.models import Sum
from django.utils.dateparse import parse_date
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from accounts.models import StudentProfile
from accounts.permissions import IsAdmin

from .models import FeePayment, FeeStructure


def _class_model():
    roster = StudentProfile._meta.get_field("roster_entry").related_model
    return roster._meta.get_field("school_class").related_model


def _get(obj, *names):
    for n in names:
        try:
            obj = getattr(obj, n)
        except Exception:
            return ""
        if obj is None:
            return ""
    return obj


def _profiles():
    try:
        return {p.user_id: p for p in StudentProfile.objects.select_related("roster_entry__school_class")}
    except Exception:
        return {p.user_id: p for p in StudentProfile.objects.all()}


class FeeStructureSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeStructure
        fields = ["id", "class_name", "amount"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

    def validate_class_name(self, value):
        qs = FeeStructure.objects.filter(class_name=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This class already has a fee. Edit it instead.")
        return value


class DueSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    roll_no = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = FeePayment
        fields = ["id", "student", "student_name", "roll_no", "class_name", "amount", "due_date", "status"]

    def _profile(self, obj):
        return self.context.get("profiles", {}).get(obj.student_id)

    def get_student_name(self, obj):
        p = self._profile(obj)
        for names in (("roster_entry", "student_name"), ("roster_entry", "full_name"), ("roster_entry", "name")):
            v = _get(p, *names)
            if isinstance(v, str) and v.strip():
                return v.strip()
        u = obj.student
        full = u.get_full_name() if hasattr(u, "get_full_name") else ""
        return (full or "").strip() or u.username

    def get_roll_no(self, obj):
        p = self._profile(obj)
        return str(_get(p, "roster_entry", "roll_no") or _get(p, "roll_no") or "")

    def get_class_name(self, obj):
        c = _get(self._profile(obj), "roster_entry", "school_class")
        return str(c) if c else ""

    def get_status(self, obj):
        if obj.status == FeePayment.Status.PAID:
            return "paid"
        return "overdue" if obj.due_date < date.today() else "pending"


class FeeStructureViewSet(viewsets.ModelViewSet):
    queryset = FeeStructure.objects.order_by("class_name")
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAdmin]
    pagination_class = None


class DuesViewSet(mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = DueSerializer
    permission_classes = [IsAdmin]
    pagination_class = None

    def get_queryset(self):
        return FeePayment.objects.select_related("student").order_by("-due_date", "student__username")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["profiles"] = _profiles()
        return ctx

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        obj = self.get_object()
        obj.status = FeePayment.Status.PAID
        obj.save(update_fields=["status"])
        return Response({"id": obj.id, "status": "paid"})

    @action(detail=True, methods=["post"])
    def mark_pending(self, request, pk=None):
        obj = self.get_object()
        obj.status = FeePayment.Status.PENDING
        obj.save(update_fields=["status"])
        return Response({"id": obj.id, "status": "pending"})

    @action(detail=False, methods=["post"])
    def generate(self, request):
        """One pending challan per claimed student, using each class's fee structure."""
        due = parse_date(str(request.data.get("due_date", "")))
        if not due:
            return Response({"detail": "Send due_date as YYYY-MM-DD."}, status=400)
        structures = list(FeeStructure.objects.all())
        if not structures:
            return Response({"detail": "Add a fee structure for at least one class first."}, status=400)
        classes = {str(c): c for c in _class_model().objects.all()}
        created = skipped = 0
        missing = []
        with transaction.atomic():
            for st in structures:
                klass = classes.get(st.class_name)
                if klass is None:
                    missing.append(st.class_name)
                    continue
                profiles = StudentProfile.objects.select_related("user").filter(
                    roster_entry__school_class=klass, roster_entry__is_claimed=True
                )
                for p in profiles:
                    if FeePayment.objects.filter(student=p.user, due_date=due).exists():
                        skipped += 1
                        continue
                    FeePayment.objects.create(student=p.user, amount=st.amount, due_date=due)
                    created += 1
        return Response({"created": created, "skipped": skipped, "missing_classes": missing})

    @action(detail=False, methods=["get"])
    def summary(self, request):
        qs = FeePayment.objects.all()
        pending = qs.filter(status=FeePayment.Status.PENDING)
        overdue = pending.filter(due_date__lt=date.today())

        def total(q):
            return float(q.aggregate(s=Sum("amount"))["s"] or 0)

        return Response({
            "collected": total(qs.filter(status=FeePayment.Status.PAID)),
            "pending": total(pending),
            "overdue": total(overdue),
            "students_with_dues": pending.values("student").distinct().count(),
        })


@api_view(["GET"])
@permission_classes([IsAdmin])
def class_options(request):
    return Response([{"id": c.pk, "name": str(c)} for c in _class_model().objects.all()])