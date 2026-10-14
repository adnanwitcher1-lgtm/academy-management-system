from rest_framework import viewsets

from accounts.permissions import IsAdmin

from .models import Inquiry
from .serializers import InquirySerializer


class InquiryViewSet(viewsets.ModelViewSet):
    """Staff only: the lead pipeline is internal to the front desk."""

    queryset = Inquiry.objects.all()
    serializer_class = InquirySerializer
    permission_classes = [IsAdmin]