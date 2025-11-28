"""Custom Django admin site with logical app grouping."""

from django.contrib import admin
from django.contrib.admin import AdminSite


class AllThriveAdminSite(AdminSite):
    """Custom admin site with better organization."""

    site_header = 'AllThrive AI Administration'
    site_title = 'AllThrive AI Admin'
    index_title = 'Site Administration'

    def get_app_list(self, request, app_label=None):
        """
        Return a sorted list of all the installed apps that have been registered in this site.
        Reorganized into logical groups.
        """
        app_dict = self._build_app_dict(request, app_label)

        # Define custom app groups with labels and model mappings
        app_groups = [
            {'name': '👥 Users & Authentication', 'app_label': 'users_auth', 'models': []},
            {'name': '🎮 Gamification', 'app_label': 'gamification', 'models': []},
            {'name': '💬 AI Conversations', 'app_label': 'conversations', 'models': []},
            {'name': '🎯 Projects & Content', 'app_label': 'content', 'models': []},
            {'name': '🧠 Quizzes', 'app_label': 'quizzes', 'models': []},
            {'name': '🛠️ Tools', 'app_label': 'tools', 'models': []},
            {'name': '🏷️ Taxonomy & Tags', 'app_label': 'taxonomy_system', 'models': []},
            {'name': '🎪 Events & Community', 'app_label': 'community', 'models': []},
            {'name': '⚔️ Battles & Challenges', 'app_label': 'battles_app', 'models': []},
        ]

        # Model to group mapping
        # NOTE: Most models are registered under 'core' app label
        model_groups = {
            # Users & Authentication
            'core.user': 'users_auth',
            'core.userauditlog': 'users_auth',
            'account.emailaddress': 'users_auth',
            'socialaccount.socialaccount': 'users_auth',
            'socialaccount.socialapp': 'users_auth',
            'socialaccount.socialtoken': 'users_auth',
            'core.socialconnection': 'users_auth',
            # Gamification
            'thrive_circle.pointactivity': 'gamification',
            'thrive_circle.weeklygoal': 'gamification',
            'thrive_circle.sidequest': 'gamification',
            'thrive_circle.usersidequest': 'gamification',
            'achievements.achievement': 'gamification',
            'achievements.userachievement': 'gamification',
            'achievements.achievementprogress': 'gamification',
            'core.referralcode': 'gamification',
            'core.referral': 'gamification',
            # AI Conversations
            'core.conversation': 'conversations',
            'core.message': 'conversations',
            # Projects & Content
            'core.project': 'content',
            'core.projectcomment': 'content',
            'core.commentvote': 'content',
            'core.projectlike': 'content',
            # Quizzes
            'core.quiz': 'quizzes',
            'core.quizquestion': 'quizzes',
            'core.quizattempt': 'quizzes',
            # Tools
            'core.tool': 'tools',
            'core.toolreview': 'tools',
            'core.toolcomparison': 'tools',
            'core.toolbookmark': 'tools',
            # Taxonomy & Tags
            'core.taxonomy': 'taxonomy_system',
            'core.usertag': 'taxonomy_system',
            'core.userinteraction': 'taxonomy_system',
            # Events & Community
            'core.event': 'community',
            # Battles & Challenges
            'core.promptbattle': 'battles_app',
            'core.battleinvitation': 'battles_app',
            'core.battlesubmission': 'battles_app',
            # System models - intentionally not mapped to hide from main interface
            # These are available via direct URL if needed:
            # /admin/admin/logentry/, /admin/contenttypes/contenttype/, etc.
        }

        # Distribute models into groups
        print('\n=== DEBUG: Admin Model Discovery ===')
        for app_label, app_data in app_dict.items():
            for model in app_data['models']:
                model_key = f"{app_label}.{model['object_name'].lower()}"
                group_label = model_groups.get(model_key)
                print(f'Model: {model_key} -> Group: {group_label}')

                if group_label:
                    # Find the group and add the model
                    for group in app_groups:
                        if group['app_label'] == group_label:
                            group['models'].append(model)
                            break
                # System models and unmapped models are intentionally hidden
        print('=== END DEBUG ===')

        # Filter out empty groups and format for Django admin
        app_list = []
        for group in app_groups:
            if group['models']:
                # Sort models alphabetically within each group
                group['models'].sort(key=lambda x: x['name'])

                app_list.append(
                    {
                        'name': group['name'],
                        'app_label': group['app_label'],
                        'app_url': f"/admin/{group['app_label']}/",
                        'has_module_perms': True,
                        'models': group['models'],
                    }
                )

        return app_list


# Monkey-patch the default admin site with our custom get_app_list method

# Store the original get_app_list method
_original_get_app_list = admin.site.get_app_list

# Replace with our custom implementation
admin.site.get_app_list = AllThriveAdminSite('custom').get_app_list.__get__(admin.site, type(admin.site))

# Update site branding
admin.site.site_header = 'AllThrive AI Administration'
admin.site.site_title = 'AllThrive AI Admin'
admin.site.index_title = 'Site Administration'
