from rest_framework import serializers
from .models import Users, UserRole, UserSubscriptionPlan, Usage


class UsersSerializer(serializers.ModelSerializer):
    class Meta:
        model = Users
        fields = '__all__'


class UserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRole
        fields = '__all__'


class UserSubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSubscriptionPlan
        fields = '__all__'
class UsageSerializer(serializers.ModelSerializer):
    total_tokens = serializers.IntegerField(read_only=True)
    class Meta:
        model = Usage
        fields = '__all__'


# Serializer for combined user detail response
class UserFullDetailSerializer(serializers.Serializer):
    user = UsersSerializer()
    role = UserRoleSerializer()
    subscription = UserSubscriptionPlanSerializer()
