from django.core.management.base import BaseCommand
from forum.models import ForumCategory, CATEGORY_CHOICES
from django.utils.text import slugify
from uuid import uuid4

class Command(BaseCommand):
    help = "初始化默认论坛板块分类（若不存在）。"

    def handle(self, *args, **options):
        created = 0
        # 先修复已有的空 slug 记录
        for cat in ForumCategory.objects.filter(slug=''):
            tentative = slugify(cat.name) or uuid4().hex[:8]
            # 确保唯一
            base = tentative
            i = 1
            while ForumCategory.objects.filter(slug=tentative).exclude(pk=cat.pk).exists():
                tentative = f"{base}-{i}"
                i += 1
            cat.slug = tentative
            cat.save(update_fields=['slug'])

        for name, _ in CATEGORY_CHOICES:
            if not ForumCategory.objects.filter(name=name).exists():
                slug = slugify(name) or uuid4().hex[:8]
                base = slug
                i = 1
                while ForumCategory.objects.filter(slug=slug).exists():
                    slug = f"{base}-{i}"
                    i += 1
                ForumCategory.objects.create(name=name, slug=slug)
                created += 1
        if created:
            self.stdout.write(self.style.SUCCESS(f"创建 {created} 个默认板块分类."))
        else:
            self.stdout.write(self.style.WARNING("未创建新分类（可能已存在）。"))
