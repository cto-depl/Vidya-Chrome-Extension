from django.shortcuts import render

# Create your views here.
from django.db.models import Sum
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Usage

from rest_framework import status, generics
from rest_framework.response import Response
from .models import Users, UserRole, UserSubscriptionPlan
from .serializers import UsersSerializer, UserRoleSerializer, UserSubscriptionPlanSerializer
from datetime import date
from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Users, UserRole, UserSubscriptionPlan, Usage
from .serializers import (
    UsersSerializer,
    UserRoleSerializer,
    UserSubscriptionPlanSerializer,
    UsageSerializer,
    UserFullDetailSerializer
)


class UsageSummaryView(APIView):
    def get(self, request):
        user_id = request.query_params.get('user_id')
        date_str = request.query_params.get('date')

        if not user_id or not date_str:
            return Response(
                {"error": "Both user_id and date are required parameters"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Filter usage for the user & date
        usage_qs = Usage.objects.filter(
            user_id=user_id,
            usage_date__date=date_str
        )

        summary = usage_qs.aggregate(
            total_input_tokens=Sum('input_tokens'),
            total_output_tokens=Sum('output_tokens'),
            total_tokens=Sum('input_tokens') + Sum('output_tokens')
        )

        # Handle no data
        if not usage_qs.exists():
            return Response(
                {"message": "No usage records found for given user and date"},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response({
            "user_id": int(user_id),
            "date": date_str,
            "total_input_tokens": summary["total_input_tokens"] or 0,
            "total_output_tokens": summary["total_output_tokens"] or 0,
            "total_tokens": (
                (summary["total_input_tokens"] or 0) +
                (summary["total_output_tokens"] or 0)
            )
        }, status=status.HTTP_200_OK)


class CreateFullUserView(generics.GenericAPIView):
    """
    POST: Creates a user, adds role, and adds subscription plan in one go.
    """
    serializer_class = UsersSerializer

    def post(self, request, *args, **kwargs):
        user_name = request.data.get("user_name")
        user_email = request.data.get("user_email")
        role_code = request.data.get("role_code", 0)
        role_name = request.data.get("role_name", "Student")
        user_type_id = request.data.get("user_type_id", 0)
        plan_name = request.data.get("plan_name", "Free")
        start_date = request.data.get("start_date")
        end_date = request.data.get("end_date", None)
        payment_status = request.data.get("payment_status", 0)
        amount_paid = request.data.get("amount_paid", 0.00)
        currency = request.data.get("currency", "INR")

        # 1. Create user
        user = Users.objects.create(user_name=user_name, user_email=user_email)

        # 2. Add role
        role = UserRole.objects.create(user=user, role_code=role_code, role_name=role_name)

        # 3. Add subscription plan
        subscription = UserSubscriptionPlan.objects.create(
            user=user,
            user_type_id=user_type_id,
            plan_name=plan_name,
            start_date=start_date,
            end_date=end_date,
            payment_status=payment_status,
            amount_paid=amount_paid,
            currency=currency
        )

        return Response({
            "user": UsersSerializer(user).data,
            "role": UserRoleSerializer(role).data,
            "subscription": UserSubscriptionPlanSerializer(subscription).data
        }, status=status.HTTP_201_CREATED)


class UsersListView(generics.ListAPIView):
    queryset = Users.objects.all()
    serializer_class = UsersSerializer


class UserDetailView(generics.RetrieveAPIView):
    queryset = Users.objects.all()
    serializer_class = UsersSerializer
    lookup_field = 'user_id'

class CreateUsageView(generics.CreateAPIView):
    """
    POST: Create a usage record.
    """
    serializer_class = UsageSerializer


class UserFullDetailView(APIView):
    """
    GET: Retrieve all details for a particular user_id.
    """
    def get(self, request, user_id):
        try:
            # Get user
            user = Users.objects.get(user_id=user_id)
            user_data = UsersSerializer(user).data

            # Get role
            role = UserRole.objects.filter(user=user).first()
            role_data = UserRoleSerializer(role).data if role else None

            # Get subscription
            subscription = UserSubscriptionPlan.objects.filter(user=user).first()
            subscription_data = UserSubscriptionPlanSerializer(subscription).data if subscription else None

            # Combine response
            combined_data = {
                "user": user_data,
                "role": role_data,
                "subscription": subscription_data
            }
            return Response(combined_data, status=status.HTTP_200_OK)

        except Users.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

class UpdateUserProfileView(APIView):
    """
    POST: Update user profile fields (name, email, class, navigation_status).
    """
    def post(self, request, *args, **kwargs):
        user_id = request.data.get("user_id")
        if not user_id:
            return Response({"error": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = Users.objects.get(user_id=user_id)
        except Users.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Update fields if provided
        user.user_name = request.data.get("user_name", user.user_name)
        user.user_email = request.data.get("user_email", user.user_email)
        user.user_class = request.data.get("user_class", user.user_class)
        user.navigation_status = request.data.get("navigation_status", user.navigation_status)

        user.save()

        return Response(
            {"message": "User profile updated successfully", "user": UsersSerializer(user).data},
            status=status.HTTP_200_OK
        )


class UpdateUserSubscriptionPlanView(APIView):
    """
    POST: Update a user's subscription plan by user_id.
    """
    def post(self, request, *args, **kwargs):
        user_id = request.data.get("user_id")
        if not user_id:
            return Response({"error": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            subscription = UserSubscriptionPlan.objects.get(user_id=user_id)
        except UserSubscriptionPlan.DoesNotExist:
            return Response({"error": "Subscription plan not found for this user"}, status=status.HTTP_404_NOT_FOUND)

        # Extract fields
        subscription.plan_name = request.data.get("plan_name", subscription.plan_name)
        subscription.start_date = request.data.get("start_date", subscription.start_date)
        subscription.end_date = request.data.get("end_date", subscription.end_date)
        subscription.payment_status = request.data.get("payment_status", subscription.payment_status)
        subscription.amount_paid = request.data.get("amount_paid", subscription.amount_paid)
        subscription.currency = request.data.get("currency", subscription.currency)

        subscription.save()

        return Response(
            {"message": "Subscription updated successfully",
             "subscription": UserSubscriptionPlanSerializer(subscription).data},
            status=status.HTTP_200_OK
        )