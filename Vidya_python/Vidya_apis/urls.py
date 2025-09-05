from django.urls import path
from .views import CreateFullUserView, UsersListView, UserDetailView,CreateUsageView, UserFullDetailView, UsageSummaryView,UpdateUserProfileView,UpdateUserSubscriptionPlanView

urlpatterns = [
    path('create-user-full/', CreateFullUserView.as_view(), name='create_full_user'), #create a new user
    path('users/', UsersListView.as_view(), name='users_list'), #list all users 
    path('users/<int:user_id>/', UserDetailView.as_view(), name='user_detail'), #list details of a user (limit)
    path('usage/', CreateUsageView.as_view(), name='create_usage'), #post usage
    path('user-full/<int:user_id>/', UserFullDetailView.as_view(), name='user_full_detail'), #list all details of user 
    path('usage-summary/', UsageSummaryView.as_view(), name='usage_summary'), # summary view of usage
    path('update-user-profile/', UpdateUserProfileView.as_view(), name='update_user_profile'), # update user profile
    path('update-subscription/', UpdateUserSubscriptionPlanView.as_view(), name='update_subscription'), #update the user subscription status

]
