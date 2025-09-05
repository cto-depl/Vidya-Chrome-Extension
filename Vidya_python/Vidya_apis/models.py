from django.db import models

class Users(models.Model):
    user_id = models.AutoField(primary_key=True)
    user_name = models.CharField(max_length=255)
    user_email = models.CharField(max_length=255, null=True, blank=True)
    user_class = models.CharField(max_length=100, null=True, blank=True)
    navigation_status = models.BooleanField(null=True, blank=True)  # ✅ new field
    created_date = models.DateField(auto_now_add=True)
    timestamp = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'



class UserRole(models.Model):
    role_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(Users, on_delete=models.CASCADE)
    role_code = models.PositiveSmallIntegerField(help_text='0 = Student, 1 = Teacher, 2 = Admin, etc.')
    role_name = models.CharField(max_length=50)

    class Meta:
        db_table = 'user_role'


class UserSubscriptionPlan(models.Model):
    plan_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(Users, on_delete=models.CASCADE)
    user_type_id = models.PositiveSmallIntegerField(help_text='0 = Free, 1 = Trial, 2 = Paid')
    plan_name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    payment_status = models.PositiveSmallIntegerField(default=0, help_text='0 = Unpaid, 1 = Paid, 2 = Pending')
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    currency = models.CharField(max_length=10, default='INR')
    timestamp = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_subscription_plan'


class Usage(models.Model):
    usage_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(Users, on_delete=models.CASCADE)
    role = models.ForeignKey(UserRole, on_delete=models.CASCADE)
    purpose = models.CharField(max_length=255, null=True, blank=True)
    input_tokens = models.BigIntegerField(default=0)
    output_tokens = models.BigIntegerField(default=0)
    total_tokens = models.BigIntegerField(default=0)
    usage_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'usage'

    def save(self, *args, **kwargs):
        self.total_tokens = self.input_tokens + self.output_tokens
        super().save(*args, **kwargs)
